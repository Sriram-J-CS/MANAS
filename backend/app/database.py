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
    
    # Auth users table (email + bcrypt password hash — no plaintext passwords)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS auth_users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        phone TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Try adding phone column to auth_users if table already existed
    try:
        cursor.execute("ALTER TABLE auth_users ADD COLUMN phone TEXT")
    except Exception:
        pass

    # Mobile OTP store
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mobile_otps (
        phone TEXT PRIMARY KEY,
        otp_code TEXT NOT NULL,
        expires_at REAL NOT NULL,
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Users table (application profile, linked to auth_users.id)
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

    # Voice Ratings table for native speaker evaluation across all 8 Indian languages
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS voice_ratings (
        id TEXT PRIMARY KEY,
        language TEXT NOT NULL,
        voice_gender TEXT NOT NULL,
        voice_name TEXT,
        overall_rating INTEGER NOT NULL,
        naturalness INTEGER,
        pronunciation INTEGER,
        pacing INTEGER,
        native_speaker INTEGER DEFAULT 1,
        feedback_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # -----------------------------------------------------------------------
    # PRODUCTION COMPREHENSIVE SCHEMAS
    # -----------------------------------------------------------------------

    # User Granular Consents
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_consents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        consent_type TEXT NOT NULL,
        granted INTEGER DEFAULT 1,
        revoked_at TIMESTAMP,
        ip_hash TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, consent_type)
    )
    """)

    # Avatar Profiles
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS avatar_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        base_mascot TEXT DEFAULT 'boy',
        skin_tone TEXT DEFAULT '#D4A373',
        hair_color TEXT DEFAULT '#1A1110',
        hair_style TEXT DEFAULT 'short_fade',
        glasses INTEGER DEFAULT 0,
        outfit_color TEXT DEFAULT '#6366F1',
        outfit_style TEXT DEFAULT 'hoodie',
        is_customized INTEGER DEFAULT 0,
        generation_provider TEXT DEFAULT 'local_vision',
        photo_retained INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Voice Profiles
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS voice_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        provider TEXT DEFAULT 'sarvam_bulbul_v2',
        voice_name TEXT DEFAULT 'achal',
        gender TEXT DEFAULT 'male',
        pitch REAL DEFAULT 0.0,
        pace REAL DEFAULT 1.0,
        has_custom_sample INTEGER DEFAULT 0,
        consent_granted INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Voice Samples (Quality verified, zero unauthorized retention)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS voice_samples (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        duration_sec REAL DEFAULT 0.0,
        sample_rate INTEGER DEFAULT 22050,
        quality_score REAL DEFAULT 1.0,
        status TEXT DEFAULT 'processed',
        consent_granted INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Chat Sessions (with Incognito support)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT DEFAULT 'Conversation',
        is_incognito INTEGER DEFAULT 0,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP
    )
    """)

    # Typing Behavioral Telemetry & Personal Baseline Observations
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS typing_observations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT,
        wpm REAL DEFAULT 0.0,
        cps REAL DEFAULT 0.0,
        pause_count INTEGER DEFAULT 0,
        avg_pause_sec REAL DEFAULT 0.0,
        backspace_count INTEGER DEFAULT 0,
        correction_ratio REAL DEFAULT 0.0,
        message_len INTEGER DEFAULT 0,
        baseline_deviation REAL DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Voice Behavioral Observations
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS voice_observations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT,
        speech_rate_wpm REAL DEFAULT 0.0,
        pause_duration_sec REAL DEFAULT 0.0,
        pitch_hz REAL DEFAULT 0.0,
        energy_db REAL DEFAULT 0.0,
        baseline_deviation REAL DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Longitudinal Wellness Metric Entries (stress, energy, sleep, focus, workload, activity)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS wellness_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        metric_type TEXT NOT NULL,
        score REAL NOT NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # User Goals & Habit Connections
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT DEFAULT 'mindfulness',
        target_date TEXT,
        status TEXT DEFAULT 'active',
        progress_pct INTEGER DEFAULT 0,
        habit_linked TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Goal Milestones
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS goal_milestones (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL,
        title TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Journal Entries (Private reflection, tags, mood association)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        mood_score INTEGER,
        is_private INTEGER DEFAULT 0,
        ai_reflection TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Weekly Longitudinal Reflections
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS weekly_reflections (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        week_start TEXT NOT NULL,
        summary_text TEXT NOT NULL,
        wins TEXT DEFAULT '[]',
        challenges TEXT DEFAULT '[]',
        next_intentions TEXT DEFAULT '[]',
        data_evidence_json TEXT DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Future Self Entries
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS future_self_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        horizon TEXT DEFAULT '6_months',
        aspirations TEXT NOT NULL,
        habits_commitment TEXT,
        emotional_vision TEXT,
        reflection_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # OCEAN / Big Five Personality Assessments
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS personality_assessments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        openness REAL DEFAULT 0.5,
        conscientiousness REAL DEFAULT 0.5,
        extraversion REAL DEFAULT 0.5,
        agreeableness REAL DEFAULT 0.5,
        neuroticism REAL DEFAULT 0.5,
        confidence TEXT DEFAULT 'provisional',
        answers_json TEXT DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # What Works For Me: Intervention Effectiveness Tracking
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS what_works_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        strategy_name TEXT NOT NULL,
        total_uses INTEGER DEFAULT 0,
        positive_feedback_count INTEGER DEFAULT 0,
        negative_feedback_count INTEGER DEFAULT 0,
        success_rate REAL DEFAULT 0.0,
        last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, strategy_name)
    )
    """)

    # Music Preferences & Ambient Listening History
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS music_preferences (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        favorite_genres TEXT DEFAULT '["ambient", "rain", "lofi"]',
        saved_tracks_json TEXT DEFAULT '[]',
        play_history_json TEXT DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Structured Safety Plans
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS safety_plans (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        warning_signs TEXT DEFAULT '[]',
        internal_coping TEXT DEFAULT '[]',
        distraction_places TEXT DEFAULT '[]',
        trusted_people TEXT DEFAULT '[]',
        professional_contacts TEXT DEFAULT '[]',
        safe_environment_steps TEXT DEFAULT '[]',
        emergency_hotlines TEXT DEFAULT '["Tele-MANAS: 14416", "Emergency: 112", "Vandrevala: 9999 666 555"]',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Trusted Contacts (with verified OTP & explicit consent)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS trusted_contacts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        relationship TEXT DEFAULT 'friend',
        email TEXT,
        phone TEXT,
        is_verified INTEGER DEFAULT 0,
        consent_to_alert INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Data Exports (DPDP Act machine-readable JSON exports)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS data_exports (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        status TEXT DEFAULT 'completed',
        export_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Deletion Requests (Auditable privacy deletion records)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS deletion_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        status TEXT DEFAULT 'completed',
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Privacy Audit Events
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS privacy_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        details TEXT,
        ip_hash TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # -----------------------------------------------------------------------
    # PERFORMANCE INDEXES
    # -----------------------------------------------------------------------
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_user_time ON chat_messages(user_id, created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_mood_entries_user_time ON mood_entries(user_id, created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_wellness_user_metric ON wellness_entries(user_id, metric_type, created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_typing_user_time ON typing_observations(user_id, created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_voice_obs_user_time ON voice_observations(user_id, created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_journal_user_time ON journal_entries(user_id, created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_memories_user_cat ON user_memories(user_id, category)")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at", DB_PATH)
