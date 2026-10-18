"""
embedding_service.py - Semantic Vector Embeddings & Hybrid Retrieval for MANAS
─────────────────────────────────────────────────────────────────────────────
Handles:
1. Generating 768-dim embeddings via Gemini embedding API (GEMINI_EMBEDDING_MODEL).
2. Local deterministic fallback embeddings when offline or unconfigured.
3. Fast vector cosine similarity and 5-gram overlap calculations.
4. Hybrid memory retrieval (semantic similarity + recency) from PostgreSQL/pgvector or SQLite.
5. Anti-repetition opening sentence checks.
"""

import os
import re
import math
import json
import hashlib
import logging
from typing import List, Dict, Any, Optional
import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("manas.embedding_service")

EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "text-embedding-004")
DIMENSION = 768

# In-memory LRU-like cache for embeddings
_EMBEDDING_CACHE: Dict[str, List[float]] = {}
_MAX_CACHE_SIZE = 500


def _pseudo_semantic_embedding(text: str, dim: int = DIMENSION) -> List[float]:
    """
    Deterministic pseudo-semantic embedding fallback when Gemini API is offline.
    Uses character n-grams and token hashing to produce a stable, normalized unit vector.
    Similar texts will have high cosine similarity.
    """
    vec = [0.0] * dim
    clean_text = text.lower().strip()
    if not clean_text:
        vec[0] = 1.0
        return vec

    # Hash words into vector bins
    words = re.findall(r"\w+", clean_text)
    for i, w in enumerate(words):
        h = int(hashlib.sha256(w.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        weight = 1.0 / (1.0 + math.log1p(i))
        vec[idx] += weight

        # Hash character bi-grams and tri-grams
        for n in range(2, 4):
            for c_idx in range(len(w) - n + 1):
                gram = w[c_idx:c_idx + n]
                g_h = int(hashlib.md5(gram.encode("utf-8")).hexdigest(), 16)
                vec[g_h % dim] += 0.4 * weight

    # Normalize to unit vector (L2 norm)
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 1e-9:
        vec = [x / norm for x in vec]
    else:
        vec[0] = 1.0
    return vec


async def get_embedding(text: str) -> List[float]:
    """
    Generates a 768-dim float embedding vector for the given text.
    First checks cache, then calls Gemini API if key is present, falls back gracefully.
    """
    clean_text = text.strip()[:2000]
    if not clean_text:
        return [0.0] * DIMENSION

    cache_key = f"{EMBEDDING_MODEL}:{clean_text}"
    if cache_key in _EMBEDDING_CACHE:
        return _EMBEDDING_CACHE[cache_key]

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("AI_PROVIDER_API_KEY") or ""
    if api_key and len(api_key.strip()) > 15:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{EMBEDDING_MODEL}:embedContent?key={api_key}"
        payload = {
            "model": f"models/{EMBEDDING_MODEL}",
            "content": {"parts": [{"text": clean_text}]}
        }
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    values = data.get("embedding", {}).get("values", [])
                    if values and len(values) == DIMENSION:
                        if len(_EMBEDDING_CACHE) >= _MAX_CACHE_SIZE:
                            _EMBEDDING_CACHE.pop(next(iter(_EMBEDDING_CACHE)))
                        _EMBEDDING_CACHE[cache_key] = values
                        return values
                    elif values:
                        # Pad or truncate to target dimension
                        if len(values) < DIMENSION:
                            values = values + [0.0] * (DIMENSION - len(values))
                        else:
                            values = values[:DIMENSION]
                        _EMBEDDING_CACHE[cache_key] = values
                        return values
                else:
                    logger.debug("Gemini embedContent returned status %d", res.status_code)
        except Exception as e:
            logger.debug("Gemini embedding call note: %s. Using pseudo-semantic fallback.", e)

    # Local fallback
    vec = _pseudo_semantic_embedding(clean_text, DIMENSION)
    if len(_EMBEDDING_CACHE) >= _MAX_CACHE_SIZE:
        _EMBEDDING_CACHE.pop(next(iter(_EMBEDDING_CACHE)))
    _EMBEDDING_CACHE[cache_key] = vec
    return vec


def get_embedding_sync(text: str) -> List[float]:
    """Synchronous version using cached or pseudo-semantic embedding for synchronous paths."""
    clean_text = text.strip()[:2000]
    if not clean_text:
        return [0.0] * DIMENSION
    cache_key = f"{EMBEDDING_MODEL}:{clean_text}"
    if cache_key in _EMBEDDING_CACHE:
        return _EMBEDDING_CACHE[cache_key]
    vec = _pseudo_semantic_embedding(clean_text, DIMENSION)
    return vec


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Computes cosine similarity between two vector lists."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm_a = math.sqrt(sum(a * a for a in v1))
    norm_b = math.sqrt(sum(b * b for b in v2))
    if norm_a <= 1e-9 or norm_b <= 1e-9:
        return 0.0
    return dot / (norm_a * norm_b)


def extract_word_ngrams(text: str, n: int = 5) -> List[str]:
    """Extracts word n-grams from a sentence."""
    tokens = [w.lower() for w in re.findall(r"\w+", text)]
    if len(tokens) < n:
        return [" ".join(tokens)] if tokens else []
    return [" ".join(tokens[i:i + n]) for i in range(len(tokens) - n + 1)]


def ngram_overlap_ratio(s1: str, s2: str, n: int = 5) -> float:
    """Calculates n-gram overlap ratio (Jaccard or Dice coefficient) between two sentences."""
    ng1 = set(extract_word_ngrams(s1, n))
    ng2 = set(extract_word_ngrams(s2, n))
    if not ng1 or not ng2:
        # Fall back to word overlap for very short sentences
        w1 = set(re.findall(r"\w+", s1.lower()))
        w2 = set(re.findall(r"\w+", s2.lower()))
        if not w1 or not w2:
            return 0.0
        return len(w1 & w2) / max(len(w1 | w2), 1)

    intersection = len(ng1 & ng2)
    return (2.0 * intersection) / (len(ng1) + len(ng2))


def is_too_similar(first_sentence: str, past_openings: List[str], threshold: float = 0.55) -> bool:
    """
    Checks if a candidate opening sentence is too similar to any of the past bot openings
    using 5-gram overlap (> 0.55) or high cosine similarity (> 0.88).
    """
    s_clean = first_sentence.strip()
    if not s_clean or not past_openings:
        return False

    v_candidate = None
    for past in past_openings:
        p_clean = past.strip()
        if not p_clean:
            continue

        # 1. Check n-gram overlap
        overlap = ngram_overlap_ratio(s_clean, p_clean, n=5)
        if overlap >= threshold:
            return True

        # 2. Check exact prefix match (first 6 words)
        words_c = re.findall(r"\w+", s_clean.lower())[:6]
        words_p = re.findall(r"\w+", p_clean.lower())[:6]
        if words_c and words_c == words_p and len(words_c) >= 4:
            return True

        # 3. Embedding cosine check
        if v_candidate is None:
            v_candidate = get_embedding_sync(s_clean)
        v_past = get_embedding_sync(p_clean)
        sim = cosine_similarity(v_candidate, v_past)
        if sim >= 0.88:
            return True

    return False


async def search_memories_hybrid(
    user_id: str,
    query_text: str,
    db_conn: Any,
    top_k: int = 5
) -> List[Dict[str, Any]]:
    """
    Retrieves the top memories for a user ranked by semantic similarity and recency.
    Queries PostgreSQL/pgvector if active; otherwise computes hybrid scores over SQLite memories.
    """
    from .postgres_db import is_postgres_active, search_similar_memories_pgvector
    query_emb = await get_embedding(query_text)

    # 1. Check PostgreSQL + pgvector
    if is_postgres_active():
        try:
            pg_results = await search_similar_memories_pgvector(
                user_id=user_id,
                query_embedding=query_emb,
                limit=top_k
            )
            if pg_results:
                return [
                    {"category": r.get("category", "fact"), "fact": r.get("fact", "")}
                    for r in pg_results
                ]
        except Exception as e:
            logger.debug("pgvector search failed in hybrid: %s", e)

    # 2. SQLite hybrid retrieval
    try:
        cur = db_conn.cursor()
        cur.execute("""
            SELECT category, fact, importance, created_at
            FROM user_memories
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 30
        """, (user_id,))
        rows = cur.fetchall()
        if not rows:
            return []

        scored_memories = []
        for idx, r in enumerate(rows):
            fact_text = r["fact"]
            # Recency factor: newest items score higher
            recency_weight = 1.0 - (idx / max(len(rows), 1)) * 0.3
            emb_mem = get_embedding_sync(fact_text)
            sim = cosine_similarity(query_emb, emb_mem)
            combined_score = (0.75 * sim) + (0.25 * recency_weight)
            scored_memories.append({
                "category": r["category"],
                "fact": fact_text,
                "score": combined_score
            })

        scored_memories.sort(key=lambda m: m["score"], reverse=True)
        return [{"category": m["category"], "fact": m["fact"]} for m in scored_memories[:top_k]]
    except Exception as e:
        logger.warning("SQLite memory retrieval note: %s", e)
        return []
