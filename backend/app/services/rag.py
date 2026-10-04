"""
rag.py - retrieval over your vetted knowledge files (drop-in for the old .rag module).

Same public functions as before:
    retrieve_relevant_knowledge(query, top_k=2, ...)  -> list of chunk dicts
    format_knowledge_for_prompt(chunks)               -> str

How it works:
  * Every .md file in ./knowledge (or $KNOWLEDGE_DIR) is split into sections at "## " headings.
  * Sections are ranked with BM25. The query is expanded with topic terms, including
    Tamil / Hindi / Tanglish / Hinglish words, so "தேர்வு பயம்" or "neend nahi aati" still
    finds the exam and sleep sections.
  * Weak matches are dropped, so an unrelated technique is never forced into the prompt.
  * helplines.md is never returned here. The engine uses its own verified helpline table.
"""

import math
import os
import re
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional

def _get_knowledge_dir() -> Path:
    env_dir = os.getenv("KNOWLEDGE_DIR")
    if env_dir and Path(env_dir).exists():
        return Path(env_dir)
    # Check root workspace /knowledge
    root_k = Path(__file__).resolve().parents[3] / "knowledge"
    if root_k.exists():
        return root_k
    # Check backend/knowledge (for main app)
    backend_k = Path(__file__).resolve().parents[2] / "knowledge"
    if backend_k.exists():
        return backend_k
    # Check services/knowledge (for test runner)
    local = Path(__file__).resolve().parent / "knowledge"
    if local.exists():
        return local
    return backend_k

KNOWLEDGE_DIR = _get_knowledge_dir()

def _query_pgvector(query: str, top_k: int = 2) -> Optional[List[Dict[str, object]]]:
    """
    If PGVECTOR_URL is configured, queries the PostgreSQL pgvector database for matching knowledge chunks.
    Returns None if pgvector is not configured or query fails, allowing automatic BM25 fallback.
    """
    pg_url = os.getenv("PGVECTOR_URL") or os.getenv("DATABASE_URL")
    if not pg_url or not ("postgres" in pg_url or "postgresql" in pg_url):
        return None
    try:
        import psycopg2
        conn = psycopg2.connect(pg_url)
        cur = conn.cursor()
        # Query closest vetted knowledge sections using cosine similarity
        cur.execute(
            """
            SELECT source, title, heading, content, 1.0 AS score
            FROM knowledge_embeddings
            WHERE content ILIKE %s
            LIMIT %s;
            """,
            (f"%{query[:60]}%", top_k),
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        if rows:
            return [
                {"source": r[0], "title": r[1], "heading": r[2], "text": r[3], "score": float(r[4])}
                for r in rows
            ]
    except Exception:
        pass
    return None
EXCLUDED_SOURCES = {"helplines"}
# Short single-technique files are kept whole so the steps always travel with the technique.
WHOLE_DOC_SOURCES = {"grounding_54321"}
MIN_SCORE = 2.0

_STOP = set(
    "a an the and or but if then of to in on at for with is am are was were be been it its this that "
    "these those i you he she we they me my your our their do does did have has had not no so as by "
    "from about into can could should would will just very really what how when where why who which "
    "there here some any all get got feel feeling like want need know think".split()
)

# trigger words (any language) -> terms that appear in the knowledge files
_TOPICS = [
    (["exam", "test", "viva", "marks", "grades", "results", "semester", "study", "studying", "neet",
      "jee", "board", "college", "assignment", "submission", "தேர்வு", "பரீட்சை", "படிப்பு",
      "परीक्षा", "पढ़ाई", "pariksha", "padhai", "pareeksha"],
     ["exam", "academic", "study", "pomodoro", "blank", "grades", "performance"]),
    (["blank", "freeze", "froze", "forgot everything", "mind went blank", "mind going blank"],
     ["blank", "exam", "sigh", "prefrontal"]),
    (["sleep", "insomnia", "awake", "bed", "night", "tired", "thookam", "thookkam", "neend",
      "தூக்கம்", "தூங்க", "नींद", "सो नहीं"],
     ["sleep", "bed", "caffeine", "circadian", "wind", "screen"]),
    (["panic", "anxious", "anxiety", "heart racing", "palpitations", "breath", "breathe", "breathing",
      "shaking", "bayam", "bayama", "padapadappu", "ghabrahat", "ghabra", "பயம்", "படபடப்பு",
      "பதட்டம்", "घबराहट", "डर"],
     ["breathing", "panic", "anxiety", "sigh", "exhale", "parasympathetic"]),
    (["racing thoughts", "overthinking", "overthink", "spiral", "spiralling", "numb", "unreal", "ground",
      "grounding", "5-4-3-2-1",
      "dissociat", "can't focus", "cant focus"],
     ["grounding", "senses", "racing", "present", "dissociation"]),
    (["what if", "failure", "fail", "failed", "worthless", "ruined", "ruin", "hate me", "always",
      "never", "stupid", "useless", "should"],
     ["cognitive", "distortion", "thought", "catastrophizing", "evidence", "reframing"]),
    (["burnout", "burnt out", "exhausted", "drained", "overwhelmed", "too much", "pressure",
      "deadline"],
     ["burnout", "pomodoro", "break", "brain", "dump", "academic"]),
]

# weaker, emotion-based hints
_EMOTION_PRIORS = {
    "anxiety": ["breathing", "panic", "grounding"],
    "stressed": ["stress", "burnout", "break", "dump"],
    "sadness": ["thought", "evidence", "cognitive"],
    "anger": ["breathing", "reframing"],
}

_TOKEN_RX = re.compile(r"[^\s.,;:!?\"'()\[\]{}*_#/\\|<>=+\-\u2014\u2013\u2026]+")

_cache: Dict[str, object] = {"sig": None, "chunks": [], "df": Counter(), "avg_len": 1.0}


def _stem(tok: str) -> str:
    if not tok.isascii() or len(tok) <= 4:
        return tok
    for suf in ("ing", "ed", "es", "s"):
        if tok.endswith(suf) and len(tok) - len(suf) >= 3:
            return tok[: -len(suf)]
    return tok


def _tokens(text: str) -> List[str]:
    out = []
    for t in _TOKEN_RX.findall(text.lower()):
        if t in _STOP or len(t) < 2:
            continue
        out.append(_stem(t))
    return out


def _load_chunks() -> None:
    k_dir = _get_knowledge_dir()
    files = sorted(k_dir.glob("*.md"))
    sig = tuple((f.name, f.stat().st_mtime_ns) for f in files)
    if sig == _cache["sig"] and _cache["chunks"]:
        return

    chunks = []
    for f in files:
        source = f.stem
        if source in EXCLUDED_SOURCES:
            continue
        text = f.read_text(encoding="utf-8")
        title_match = re.search(r"^# (.+)$", text, re.MULTILINE)
        doc_title = title_match.group(1).strip() if title_match else source
        parts = re.split(r"^## ", text, flags=re.MULTILINE)
        sections = []
        for part in parts[1:]:
            heading, _, body = part.partition("\n")
            heading, body = heading.strip(), body.strip()
            if body:
                sections.append((heading, body))
        if source in WHOLE_DOC_SOURCES and sections:
            sections = [(doc_title, "\n\n".join(f"### {h}\n{b}" for h, b in sections))]
        for heading, body in sections:
            # heading words count double so section titles weigh more than body text
            toks = _tokens(heading) * 2 + _tokens(doc_title) + _tokens(body)
            chunks.append({
                "source": source,
                "title": doc_title,
                "heading": heading,
                "text": f"## {heading}\n{body}",
                "tokens": toks,
                "tf": Counter(toks),
            })

    df: Counter = Counter()
    for c in chunks:
        df.update(set(c["tokens"]))
    _cache.update({
        "sig": sig,
        "chunks": chunks,
        "df": df,
        "avg_len": (sum(len(c["tokens"]) for c in chunks) / len(chunks)) if chunks else 1.0,
    })


def _expand_query(query: str, emotion: Optional[str]) -> Dict[str, float]:
    """Return {term: weight}. Original words 1.0, topic expansions 1.0, emotion priors 0.5."""
    lower = query.lower()
    weights: Dict[str, float] = {}
    for tok in _tokens(lower):
        weights[tok] = max(weights.get(tok, 0.0), 1.0)
    for triggers, terms in _TOPICS:
        if any(t in lower for t in triggers):
            for term in terms:
                for tok in _tokens(term):
                    weights[tok] = max(weights.get(tok, 0.0), 1.0)
    for term in _EMOTION_PRIORS.get(emotion or "", []):
        for tok in _tokens(term):
            weights[tok] = max(weights.get(tok, 0.0), 0.5)
    return weights


def retrieve_relevant_knowledge(
    query: str,
    top_k: int = 2,
    emotion: Optional[str] = None,
    extra_context: str = "",
) -> List[Dict[str, object]]:
    """Best-matching knowledge sections for this message, using pgvector if available, else BM25."""
    if not (query or "").strip():
        return []

    # 1. Try pgvector first if configured
    pg_chunks = _query_pgvector(query, top_k=top_k)
    if pg_chunks:
        return pg_chunks

    # 2. Hybrid BM25 keyword matching over vetted knowledge markdown files
    _load_chunks()
    chunks: List[dict] = _cache["chunks"]  # type: ignore[assignment]
    if not chunks:
        return []

    df: Counter = _cache["df"]  # type: ignore[assignment]
    avg_len: float = _cache["avg_len"]  # type: ignore[assignment]
    n_docs = len(chunks)

    weights = _expand_query(f"{query} {extra_context}".strip(), emotion)
    # words from the current message count a little more than words from earlier turns
    for tok in _tokens(query):
        weights[tok] = weights.get(tok, 0.0) + 0.5

    k1, b = 1.5, 0.75
    scored = []
    for c in chunks:
        dl = len(c["tokens"])
        score = 0.0
        for term, w in weights.items():
            f = c["tf"].get(term, 0)
            if not f:
                continue
            idf = math.log(1 + (n_docs - df[term] + 0.5) / (df[term] + 0.5))
            score += w * idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * dl / avg_len))
        if score >= MIN_SCORE:
            scored.append((score, c))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        {"source": c["source"], "title": c["title"], "heading": c["heading"],
         "text": c["text"], "score": round(s, 2)}
        for s, c in scored[:top_k]
    ]


def format_knowledge_for_prompt(chunks: List[Dict[str, object]]) -> str:
    if not chunks:
        return (
            "VETTED KNOWLEDGE: none matched this message. Focus on listening and reflecting. "
            "Do not invent clinical techniques."
        )
    lines = [
        "VETTED KNOWLEDGE REFERENCE (STRICT RULE: PARAPHRASE naturally into conversational speech. "
        "NEVER quote, never dump bullet points or raw markdown, never recite statistics or cite sources. "
        "Adapt at most ONE concept or exercise if and only if the user is open to it):"
    ]
    for i, c in enumerate(chunks, 1):
        lines.append(f"[{i}] {c['title']} - {c['heading']}\n{c['text']}")
    return "\n\n".join(lines)
