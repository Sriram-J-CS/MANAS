"""
telemetry.py - Structured JSON Logging, OpenTelemetry-Compatible Tracing & Error Monitoring
─────────────────────────────────────────────────────────────────────────────
Handles:
1. Structured JSON log formatting with correlation IDs (`trace_id`).
2. Request tracing middleware injecting `X-Trace-ID` and timing latency.
3. In-memory error metrics and stack trace hashing for error monitoring.
4. System health and telemetry stats aggregation for /api/status.
"""

import time
import json
import uuid
import hashlib
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("manas.telemetry")

START_TIME = time.time()

# In-memory error monitor stats
ERROR_STATS: Dict[str, Any] = {
    "total_requests": 0,
    "total_errors": 0,
    "error_counts_by_type": {},
    "recent_error_traces": []
}

class StructuredJsonFormatter(logging.Formatter):
    """Formats Python logs as JSON objects suitable for Datadog / CloudWatch / GCP Cloud Logging."""
    def format(self, record: logging.LogRecord) -> str:
        log_obj = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "line": record.lineno,
        }
        if hasattr(record, "trace_id"):
            log_obj["trace_id"] = getattr(record, "trace_id")
        if hasattr(record, "user_id"):
            log_obj["user_id"] = getattr(record, "user_id")
        if hasattr(record, "latency_ms"):
            log_obj["latency_ms"] = getattr(record, "latency_ms")
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_obj)

def setup_structured_logging():
    """Configures root logger with JSON formatting in production."""
    root_logger = logging.getLogger()
    handler = logging.StreamHandler()
    handler.setFormatter(StructuredJsonFormatter())
    root_logger.handlers = [handler]
    root_logger.setLevel(logging.INFO)

class TracingMiddleware(BaseHTTPMiddleware):
    """
    HTTP middleware attaching X-Trace-ID correlation IDs and timing request latencies.
    """
    async def dispatch(self, request: Request, call_next):
        start_ts = time.time()
        trace_id = request.headers.get("X-Trace-ID") or request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.trace_id = trace_id

        ERROR_STATS["total_requests"] += 1

        try:
            response: Response = await call_next(request)
            duration_ms = round((time.time() - start_ts) * 1000, 2)
            response.headers["X-Trace-ID"] = trace_id

            # Log non-health checks
            if not request.url.path.endswith("/health") and not request.url.path.endswith("/status"):
                logger.info(
                    "HTTP %s %s status=%d latency=%sms",
                    request.method,
                    request.url.path,
                    response.status_code,
                    duration_ms,
                    extra={"trace_id": trace_id, "latency_ms": duration_ms}
                )

            if response.status_code >= 500:
                ERROR_STATS["total_errors"] += 1
                ERROR_STATS["error_counts_by_type"]["HTTP5xx"] = ERROR_STATS["error_counts_by_type"].get("HTTP5xx", 0) + 1

            return response

        except Exception as exc:
            duration_ms = round((time.time() - start_ts) * 1000, 2)
            ERROR_STATS["total_errors"] += 1
            err_type = type(exc).__name__
            ERROR_STATS["error_counts_by_type"][err_type] = ERROR_STATS["error_counts_by_type"].get(err_type, 0) + 1

            trace_hash = hashlib.sha256(str(exc).encode("utf-8")).hexdigest()[:16]
            if len(ERROR_STATS["recent_error_traces"]) >= 50:
                ERROR_STATS["recent_error_traces"].pop(0)

            ERROR_STATS["recent_error_traces"].append({
                "trace_id": trace_id,
                "error_type": err_type,
                "error_hash": trace_hash,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "path": request.url.path
            })

            logger.error(
                "Unhandled exception on %s %s: %s",
                request.method,
                request.url.path,
                exc,
                exc_info=True,
                extra={"trace_id": trace_id, "latency_ms": duration_ms}
            )
            raise exc

def track_system_error(err_type: str, message: str, path: str = "internal"):
    """Explicitly tracks and hashes internal errors for monitoring dashboard."""
    ERROR_STATS["total_errors"] += 1
    ERROR_STATS["error_counts_by_type"][err_type] = ERROR_STATS["error_counts_by_type"].get(err_type, 0) + 1
    if len(ERROR_STATS["recent_error_traces"]) >= 50:
        ERROR_STATS["recent_error_traces"].pop(0)
    ERROR_STATS["recent_error_traces"].append({
        "trace_id": str(uuid.uuid4()),
        "error_type": err_type,
        "error_hash": hashlib.sha256(message.encode("utf-8")).hexdigest()[:16],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "path": path
    })

def get_system_telemetry_stats() -> Dict[str, Any]:
    """Aggregates real-time system uptime, memory, error rates, and health for /api/status."""
    uptime_sec = round(time.time() - START_TIME, 1)
    tot_req = max(1, ERROR_STATS["total_requests"])
    tot_err = ERROR_STATS["total_errors"]
    err_rate = round((tot_err / tot_req) * 100, 3)

    return {
        "status": "healthy" if err_rate < 5.0 else "degraded",
        "uptime_seconds": uptime_sec,
        "total_requests": ERROR_STATS["total_requests"],
        "total_errors": tot_err,
        "error_rate_percentage": err_rate,
        "error_counts": ERROR_STATS["error_counts_by_type"],
        "recent_errors": ERROR_STATS["recent_error_traces"][-10:]
    }
