"""
job_queue.py - Distributed Asynchronous Job Queue for MANAS
─────────────────────────────────────────────────────────────────────────────
Decouples heavy background operations from real-time SSE streaming chat:
1. Pushes jobs to Redis Queue (`manas:job_queue`) with fallback to in-memory queue.
2. Handled job types:
   - `chat_background_extraction`: Gemini 3.8 function calling extraction
   - `send_push_notification`: Web Push dispatch with quiet hours enforcement
   - `prewarm_tts_cache`: Pre-synthesizes audio for fast repeat playback
3. Worker process runs concurrently or via standalone `worker.py`.
"""

import os
import json
import time
import uuid
import asyncio
import logging
from typing import Dict, List, Optional, Any, Tuple

from .redis_cache import get_redis_client

logger = logging.getLogger("manas.job_queue")

QUEUE_NAME = "manas:job_queue"
DEAD_LETTER_QUEUE = "manas:job_dlq"

# In-memory async fallback queue & stats
_ASYNC_MEMORY_QUEUE: asyncio.Queue = asyncio.Queue()
_PROCESSED_JOB_COUNT = 0
_FAILED_JOB_COUNT = 0

class JobQueueManager:
    """Manager providing queue inspection and metrics for telemetry & status page."""
    async def get_queue_stats(self) -> Dict[str, Any]:
        client = await get_redis_client()
        if client:
            try:
                q_len = await client.llen(QUEUE_NAME)
                dlq_len = await client.llen(DEAD_LETTER_QUEUE)
                return {
                    "backend": "Redis 7 Distributed Queue",
                    "pending_jobs": q_len,
                    "processed_jobs": _PROCESSED_JOB_COUNT,
                    "failed_jobs": dlq_len,
                }
            except Exception as e:
                logger.debug("Redis queue stats query note: %s", e)

        return {
            "backend": "In-Memory High-Speed Queue",
            "pending_jobs": _ASYNC_MEMORY_QUEUE.qsize(),
            "processed_jobs": _PROCESSED_JOB_COUNT,
            "failed_jobs": _FAILED_JOB_COUNT,
        }

_QUEUE_MANAGER = JobQueueManager()

def get_job_queue() -> JobQueueManager:
    return _QUEUE_MANAGER

async def enqueue_job(
    task_type: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
    job_type: Optional[str] = None,
    priority: int = 1
) -> str:
    """Enqueues a background task into Redis or in-memory fallback queue."""
    actual_type = task_type or job_type or "generic"
    payload = payload or {}
    job_id = str(uuid.uuid4())
    job_record = {
        "job_id": job_id,
        "task_type": actual_type,
        "payload": payload,
        "priority": priority,
        "enqueued_at": time.time(),
        "status": "queued"
    }

    client = await get_redis_client()
    if client:
        try:
            await client.lpush(QUEUE_NAME, json.dumps(job_record))
            logger.debug("Enqueued job %s (%s) to Redis queue", job_id, actual_type)
            return job_id
        except Exception as e:
            logger.debug("Redis enqueue fallback to in-memory: %s", e)

    await _ASYNC_MEMORY_QUEUE.put(job_record)
    return job_id

async def dequeue_job(timeout: int = 2) -> Optional[Dict[str, Any]]:
    """Retrieves next job from Redis (BRPOP) or in-memory queue."""
    client = await get_redis_client()
    if client:
        try:
            res = await client.brpop(QUEUE_NAME, timeout=timeout)
            if res:
                _, job_json = res
                return json.loads(job_json)
        except Exception as e:
            logger.debug("Redis dequeue fallback: %s", e)

    try:
        job = await asyncio.wait_for(_ASYNC_MEMORY_QUEUE.get(), timeout=float(timeout))
        return job
    except asyncio.TimeoutError:
        return None

async def execute_job(job: Dict[str, Any]) -> bool:
    """Executes a single job by routing to appropriate service handler."""
    global _PROCESSED_JOB_COUNT, _FAILED_JOB_COUNT
    task_type = job.get("task_type")
    payload = job.get("payload", {})
    job_id = job.get("job_id")

    try:
        if task_type == "chat_background_extraction":
            from .chat_extractor import run_chat_background_extraction
            user_id = payload.get("user_id")
            message = payload.get("user_message") or payload.get("message")
            history = payload.get("recent_history") or payload.get("history")
            await run_chat_background_extraction(user_id=user_id, user_message=message, recent_history=history)
            _PROCESSED_JOB_COUNT += 1
            logger.info("Executed background extraction job %s", job_id)
            return True

        elif task_type == "send_push_notification":
            from .notifications import send_web_push_notification
            user_id = payload.get("user_id")
            notif_type = payload.get("type", "checkin")
            custom_title = payload.get("title")
            custom_msg = payload.get("message")
            send_web_push_notification(user_id, notif_type=notif_type, custom_title=custom_title, custom_message=custom_msg)
            _PROCESSED_JOB_COUNT += 1
            logger.info("Executed push notification job %s", job_id)
            return True

        elif task_type == "prewarm_tts_cache":
            from .voice import synthesize_speech_provider
            text = payload.get("text")
            lang = payload.get("language", "en")
            gender = payload.get("gender", "female")
            await synthesize_speech_provider(text=text, language=lang, gender=gender)
            _PROCESSED_JOB_COUNT += 1
            return True

        else:
            logger.warning("Unknown job task_type: %s", task_type)
            return False

    except Exception as e:
        _FAILED_JOB_COUNT += 1
        logger.error("Job %s failed with exception: %s", job_id, e)
        # Push to DLQ if Redis available
        client = await get_redis_client()
        if client:
            job["failed_at"] = time.time()
            job["error"] = str(e)
            try:
                await client.lpush(DEAD_LETTER_QUEUE, json.dumps(job))
            except Exception:
                pass
        return False

async def run_worker_loop(stop_event: Optional[asyncio.Event] = None):
    """Continuous worker loop polling and executing tasks."""
    logger.info("MANAS Background Worker loop started.")
    while stop_event is None or not stop_event.is_set():
        try:
            job = await dequeue_job(timeout=1)
            if job:
                await execute_job(job)
            else:
                await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Error in worker loop: %s", e)
            await asyncio.sleep(1.0)
