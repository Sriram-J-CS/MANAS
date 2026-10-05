"""
postgres_db.py - High-Performance PostgreSQL 16 + pgvector Adapter for MANAS
─────────────────────────────────────────────────────────────────────────────
Handles:
1. Connection pooling using asyncpg or SQLAlchemy / psycopg.
2. Vector similarity search on user_memories using cosine distance (<=>).
3. Automated schema initialization when connected to Postgres.
4. Seamless fallback to SQLite for local development.
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
import asyncio

logger = logging.getLogger("manas.postgres")

DATABASE_URL = os.environ.get("DATABASE_URL", "")
IS_POSTGRES = DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql://")

# Lazy initialized connection pool
_pg_pool = None

async def get_pg_pool():
    global _pg_pool
    if not IS_POSTGRES:
        return None
    if _pg_pool is None:
        try:
            import asyncpg
            # Standardize postgresql:// protocol for asyncpg
            dsn = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
            _pg_pool = await asyncpg.create_pool(dsn, min_size=5, max_size=25, timeout=10)
            logger.info("Connected to PostgreSQL pool with asyncpg.")
        except Exception as e:
            logger.warning("Failed to initialize asyncpg pool: %s", e)
            _pg_pool = None
    return _pg_pool

async def init_postgres_schema():
    """Initializes tables and vector extension if running on PostgreSQL."""
    if not IS_POSTGRES:
        return
    pool = await get_pg_pool()
    if not pool:
        return
    schema_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "schema_pgvector.sql")
    if os.path.exists(schema_path):
        try:
            with open(schema_path, "r", encoding="utf-8") as f:
                sql = f.read()
            async with pool.acquire() as conn:
                await conn.execute(sql)
            logger.info("PostgreSQL schema + pgvector verified.")
        except Exception as e:
            logger.error("Error initializing PostgreSQL schema: %s", e)

async def search_similar_memories_pgvector(
    user_id: str,
    query_embedding: List[float],
    category: Optional[str] = None,
    limit: int = 5
) -> List[Dict[str, Any]]:
    """
    Performs cosine similarity search using HNSW vector index:
    SELECT fact, category, 1 - (embedding <=> $1) as similarity FROM user_memories
    """
    if not IS_POSTGRES:
        return []
    pool = await get_pg_pool()
    if not pool or not query_embedding:
        return []

    try:
        embedding_str = "[" + ",".join(str(f) for f in query_embedding) + "]"
        query = """
            SELECT id, category, fact, confidence, 
                   (1 - (embedding <=> $2::vector)) AS similarity
            FROM user_memories
            WHERE user_id = $1 AND embedding IS NOT NULL
        """
        params = [user_id, embedding_str]
        if category:
            query += " AND category = $3"
            params.append(category)

        query += " ORDER BY embedding <=> $2::vector ASC LIMIT $limit"
        limit_param = f"${len(params) + 1}"
        query = query.replace("$limit", limit_param)
        params.append(limit)

        async with pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [dict(r) for r in rows]
    except Exception as e:
        logger.debug("pgvector search failed: %s", e)
        return []

def is_postgres_active() -> bool:
    return bool(IS_POSTGRES)
