"""
redis_cache.py - Redis In-Memory Fabric: Sessions, Rate Limiting, and Cost Caps
─────────────────────────────────────────────────────────────────────────────
Handles:
1. Redis connection pooling (redis.asyncio) with transparent in-memory fallback.
2. Sliding-window rate limiting (sorted sets) for users and IPs.
3. Daily token cost tracking & hard budget caps ($0.50 USD / user / day default).
4. Session context and hot memory caching (TTL 1 hour).
"""

import os
import time
import json
import logging
from typing import Dict, List, Optional, Tuple, Any

logger = logging.getLogger("manas.redis")

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# In-Memory fallback store if Redis is unconfigured or unreachable
_IN_MEMORY_SESSIONS: Dict[str, Dict[str, Any]] = {}
_IN_MEMORY_RATE_LIMITS: Dict[str, List[float]] = {}
_IN_MEMORY_COSTS: Dict[str, float] = {}

_redis_client = None

async def get_redis_client():
    global _redis_client
    if _redis_client is None:
        try:
            import redis.asyncio as aioredis
            _redis_client = aioredis.from_url(
                REDIS_URL,
                decode_responses=True,
                socket_timeout=2.0,
                socket_connect_timeout=2.0,
                max_connections=50
            )
            # Ping to verify
            await _redis_client.ping()
            logger.info("Connected to Redis at %s", REDIS_URL)
        except Exception as e:
            logger.debug("Redis unavailable (%s), using fast in-memory fallback fabric.", e)
            _redis_client = False
    return _redis_client if _redis_client is not False else None

async def is_redis_connected() -> bool:
    """Returns True if live Redis instance is connected, False if using in-memory fallback."""
    client = await get_redis_client()
    return client is not None


# ─────────────────────────────────────────────────────────────────────────────
# 1. Sliding-Window Rate Limiting
# ─────────────────────────────────────────────────────────────────────────────

async def check_rate_limit(
    identifier: str,
    max_requests: int = 30,
    window_seconds: int = 60,
    limit: Optional[int] = None
) -> Tuple[bool, int, int]:
    """
    Evaluates sliding-window rate limit using sorted sets or in-memory timestamps.
    Returns: (is_allowed, remaining_requests, retry_after_seconds)
    """
    if limit is not None:
        max_requests = limit

    now = time.time()
    cutoff = now - window_seconds
    key = f"rate_limit:{identifier}"

    client = await get_redis_client()
    if client:
        try:
            pipe = client.pipeline()
            pipe.zremrangebyscore(key, 0, cutoff)
            pipe.zcard(key)
            pipe.zadd(key, {str(now): now})
            pipe.expire(key, window_seconds + 5)
            results = await pipe.execute()

            current_count = results[1]
            if current_count >= max_requests:
                # Over limit
                oldest_items = await client.zrange(key, 0, 0, withscores=True)
                retry_after = int(window_seconds - (now - oldest_items[0][1])) if oldest_items else window_seconds
                return False, 0, max(1, retry_after)

            remaining = max(0, max_requests - current_count - 1)
            return True, remaining, 0
        except Exception as e:
            logger.debug("Redis rate limit fallback to in-memory: %s", e)

    # In-memory fallback
    timestamps = _IN_MEMORY_RATE_LIMITS.setdefault(identifier, [])
    # Evict expired
    timestamps[:] = [t for t in timestamps if t > cutoff]

    if len(timestamps) >= max_requests:
        oldest = timestamps[0]
        retry_after = int(window_seconds - (now - oldest))
        return False, 0, max(1, retry_after)

    timestamps.append(now)
    remaining = max_requests - len(timestamps)
    return True, remaining, 0


# ─────────────────────────────────────────────────────────────────────────────
# 2. Per-User Daily Cost Cap Enforcement
# ─────────────────────────────────────────────────────────────────────────────

# Gemini 3.8 Flash Pricing per 1M tokens ($0.075 prompt, $0.30 response)
COST_PER_MILLION_PROMPT = 0.075
COST_PER_MILLION_RESPONSE = 0.30

def estimate_turn_cost_usd(prompt_tokens: int, response_tokens: int) -> float:
    prompt_cost = (prompt_tokens / 1_000_000.0) * COST_PER_MILLION_PROMPT
    response_cost = (response_tokens / 1_000_000.0) * COST_PER_MILLION_RESPONSE
    return round(prompt_cost + response_cost, 6)

async def check_and_record_cost(
    user_id: str,
    prompt_tokens: int = 0,
    response_tokens: int = 0,
    max_daily_budget_usd: float = 0.50
) -> Tuple[bool, float, float]:
    """
    Records turn cost and enforces user's daily budget cap ($0.50 USD default).
    Returns: (is_within_budget, current_total_usd, max_daily_budget_usd)
    """
    today_str = time.strftime("%Y-%m-%d")
    cost_key = f"cost:{user_id}:{today_str}"
    turn_cost = estimate_turn_cost_usd(prompt_tokens, response_tokens)

    client = await get_redis_client()
    if client:
        try:
            curr_str = await client.get(cost_key)
            current_total = float(curr_str) if curr_str else 0.0

            if current_total + turn_cost > max_daily_budget_usd:
                return False, current_total, max_daily_budget_usd

            # Increment
            new_total = round(current_total + turn_cost, 6)
            await client.set(cost_key, str(new_total), ex=86400 * 2)
            return True, new_total, max_daily_budget_usd
        except Exception as e:
            logger.debug("Redis cost tracker fallback: %s", e)

    # In-memory fallback
    current_total = _IN_MEMORY_COSTS.get(cost_key, 0.0)
    if current_total + turn_cost > max_daily_budget_usd:
        return False, current_total, max_daily_budget_usd

    new_total = round(current_total + turn_cost, 6)
    _IN_MEMORY_COSTS[cost_key] = new_total
    return True, new_total, max_daily_budget_usd


# ─────────────────────────────────────────────────────────────────────────────
# 3. Session & Context Caching
# ─────────────────────────────────────────────────────────────────────────────

async def cache_session_context(session_id: str, context: Dict[str, Any], ttl: int = 3600):
    client = await get_redis_client()
    key = f"session:{session_id}:context"
    data = json.dumps(context)
    if client:
        try:
            await client.set(key, data, ex=ttl)
            return
        except Exception:
            pass
    _IN_MEMORY_SESSIONS[session_id] = {"data": context, "expires": time.time() + ttl}

async def get_session_context(session_id: str) -> Optional[Dict[str, Any]]:
    client = await get_redis_client()
    key = f"session:{session_id}:context"
    if client:
        try:
            raw = await client.get(key)
            if raw:
                return json.loads(raw)
        except Exception:
            pass
    entry = _IN_MEMORY_SESSIONS.get(session_id)
    if entry and entry["expires"] > time.time():
        return entry["data"]
    return None
