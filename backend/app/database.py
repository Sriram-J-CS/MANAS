import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "manas_twin.db")

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        age INTEGER DEFAULT 20,
        is_minor INTEGER DEFAULT 0,
        reasons TEXT DEFAULT '[]',
        tone TEXT DEFAULT 'gentle',
        role TEXT,
        language TEXT DEFAULT 'en',
        style_pref TEXT DEFAULT 'reflective',
        avatar_data TEXT,
        voice_pref TEXT,
        consent_chat INTEGER DEFAULT 1,
        consent_mood INTEGER DEFAULT 1,
        consent_cadence INTEGER DEFAULT 1,
        consent_timestamp TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Try adding columns if table already existed
    for col, col_type in [
        ("age", "INTEGER DEFAULT 20"),
        ("is_minor", "INTEGER DEFAULT 0"),
        ("guardian_consent", "INTEGER DEFAULT 0"),
        ("reasons", "TEXT DEFAULT '[]'"),
        ("tone", "TEXT DEFAULT 'gentle'"),
        ("consent_timestamp", "TEXT"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col} {col_type}")
        except Exception:
            pass

    # Access Audit Log Table (Tracking all contact operations without storing PII)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS contact_audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # User Retention Settings Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_retention_settings (
        user_id TEXT PRIMARY KEY,
        retention_days INTEGER DEFAULT 365,
        auto_purge_enabled INTEGER DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # User contacts table (Encrypted PII, zero plain text)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_contacts (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        email_ciphertext TEXT NOT NULL,
        email_hash TEXT NOT NULL UNIQUE,
        phone_ciphertext TEXT,
        phone_hash TEXT,
        email_verified INTEGER DEFAULT 0,
        phone_verified INTEGER DEFAULT 0,
        consent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        consent_version TEXT DEFAULT 'v1.0',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Long-term memory table for persistent user facts & coping methods
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        fact TEXT NOT NULL,
        importance REAL DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Chat messages table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        sender TEXT NOT NULL,
        text TEXT NOT NULL,
        language TEXT DEFAULT 'en',
        emotion TEXT DEFAULT 'neutral',
        risk_level TEXT DEFAULT 'none',
        expression TEXT DEFAULT 'neutral',
        typing_speed REAL DEFAULT 0.0,
        strategy_used TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Try adding additional columns if table existed before migration
    for col, col_type in [
        ("strategy_used", "TEXT DEFAULT NULL"),
        ("state_label", "TEXT DEFAULT 'Attuned & Present'"),
        ("stress_level", "INTEGER DEFAULT NULL"),
        ("suggested_exercise", "TEXT DEFAULT 'none'"),
        ("helplines", "TEXT DEFAULT '[]'"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE chat_messages ADD COLUMN {col} {col_type}")
        except Exception:
            pass

    # Strategy rotation log: stores last N strategies per user for anti-repetition enforcement
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS strategy_log (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        strategy TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Mood tracking table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mood_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        score INTEGER NOT NULL,
        tags TEXT,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Safety events table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS safety_events (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        trigger_word TEXT,
        risk_level TEXT,
        action_taken TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Feedback table (with explicit opt-in privacy consent)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS message_feedback (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        user_id TEXT,
        rating INTEGER,
        felt_understood INTEGER DEFAULT 1,
        comment TEXT,
        user_consent INTEGER DEFAULT 0,
        user_message TEXT,
        bot_reply TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Pipeline Traces table (zero PII: anonymous telemetry, strategy, risk, timings)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS pipeline_traces (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        language TEXT,
        risk_level TEXT,
        primary_emotion TEXT,
        intensity INTEGER,
        topic TEXT,
        intent TEXT,
        strategy_used TEXT,
        critic_passed INTEGER DEFAULT 1,
        regeneration_count INTEGER DEFAULT 0,
        duration_ms REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at", DB_PATH)
