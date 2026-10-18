-- schema_pgvector.sql - Enterprise PostgreSQL 16 + pgvector Schema for MANAS
-- Supports: High-concurrency relational data, vector search for memories, DPDP audit logs

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Core Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(100) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    role VARCHAR(32) DEFAULT 'user',
    preferred_language VARCHAR(16) DEFAULT 'en',
    age INTEGER DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. India DPDP Act 2023 Consent Records
CREATE TABLE IF NOT EXISTS user_consents (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_disclaimer BOOLEAN DEFAULT TRUE,
    consent_chat BOOLEAN DEFAULT TRUE,
    consent_mood BOOLEAN DEFAULT TRUE,
    consent_cadence BOOLEAN DEFAULT TRUE,
    consent_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_hash VARCHAR(64),
    withdrawn BOOLEAN DEFAULT FALSE,
    withdrawn_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_consents_user_id ON user_consents(user_id);

-- 4. Chat Sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    language VARCHAR(16) DEFAULT 'en',
    total_turns INTEGER DEFAULT 0,
    rolling_summary TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON chat_sessions(user_id);

-- 5. Chat Messages (Encrypted at rest per-user)
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    session_id VARCHAR(64),
    sender VARCHAR(16) NOT NULL, -- 'user' | 'mascot'
    text TEXT NOT NULL,          -- AES-256-GCM encrypted
    language VARCHAR(16) DEFAULT 'en',
    emotion VARCHAR(32) DEFAULT 'calm',
    risk_level VARCHAR(16) DEFAULT 'none',
    expression VARCHAR(32) DEFAULT 'calm',
    suggested_exercise VARCHAR(64) DEFAULT 'none',
    helplines JSONB,
    typing_speed DOUBLE PRECISION DEFAULT 0.0,
    token_count INTEGER DEFAULT 0,
    estimated_cost_usd DOUBLE PRECISION DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_messages_user_time ON chat_messages(user_id, created_at DESC);

-- 6. Long-Term Memories with 768-dim Vector Embeddings
CREATE TABLE IF NOT EXISTS user_memories (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id VARCHAR(64) NOT NULL,
    category VARCHAR(32) NOT NULL, -- 'people' | 'goals' | 'triggers' | 'coping' | 'preferences'
    fact TEXT NOT NULL,            -- AES-256-GCM encrypted
    confidence DOUBLE PRECISION DEFAULT 0.85,
    source VARCHAR(32) DEFAULT 'chat_extraction',
    embedding vector(768),         -- Vector representation for semantic cosine similarity
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_memories_user ON user_memories(user_id);
-- HNSW Vector Index for sub-10ms semantic retrieval
CREATE INDEX IF NOT EXISTS idx_memories_vector_hnsw ON user_memories 
USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- 7. Mood Entries
CREATE TABLE IF NOT EXISTS mood_entries (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    emotions JSONB,
    note TEXT,                     -- AES-256-GCM encrypted
    source VARCHAR(32) DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mood_user_time ON mood_entries(user_id, created_at DESC);

-- 8. Digital Mental Twin Wellness Entries
CREATE TABLE IF NOT EXISTS wellness_entries (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    dimension VARCHAR(32) NOT NULL, -- 'stress' | 'sleep' | 'energy' | 'focus' | 'workload' | 'activity'
    value DOUBLE PRECISION NOT NULL,
    note TEXT,                     -- AES-256-GCM encrypted
    source VARCHAR(32) DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wellness_user_dim ON wellness_entries(user_id, dimension, created_at DESC);

-- 9. Goals
CREATE TABLE IF NOT EXISTS goals (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    title TEXT NOT NULL,           -- AES-256-GCM encrypted
    status VARCHAR(32) DEFAULT 'in_progress',
    source VARCHAR(32) DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);

-- 10. Reflective Journal Entries
CREATE TABLE IF NOT EXISTS journal_entries (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    content TEXT NOT NULL,         -- AES-256-GCM encrypted
    sentiment VARCHAR(32) DEFAULT 'neutral',
    tags JSONB,
    source VARCHAR(32) DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id, created_at DESC);

-- 11. Scheduled Reminders & Push Subscriptions
CREATE TABLE IF NOT EXISTS user_reminders (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    reminder_text TEXT NOT NULL,
    time_or_recurrence VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reminders_user ON user_reminders(user_id, status);

CREATE TABLE IF NOT EXISTS web_push_subscriptions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS in_app_notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON in_app_notifications(user_id, is_read, created_at DESC);

-- 12. Auto-Save Audit Table (1-click Undo support)
CREATE TABLE IF NOT EXISTS auto_save_audit (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    tool VARCHAR(64) NOT NULL,
    item_id VARCHAR(64) NOT NULL,
    target_screen VARCHAR(64) NOT NULL,
    summary TEXT NOT NULL,
    details_json JSONB,
    is_undone BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auto_save_user ON auto_save_audit(user_id, is_undone, created_at DESC);

-- 13. Privacy & Append-Only Audit Log
CREATE TABLE IF NOT EXISTS privacy_events (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    details JSONB,
    ip_hash VARCHAR(64),
    hmac_signature VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_privacy_events_user ON privacy_events(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS data_exports (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'completed',
    export_json TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deletion_requests (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'completed',
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. Per-User Interaction Style Profile & Feedback Learning
CREATE TABLE IF NOT EXISTS user_style_profiles (
    user_id VARCHAR(64) PRIMARY KEY,
    preferred_reply_length VARCHAR(32) DEFAULT 'balanced',
    directness VARCHAR(32) DEFAULT 'gentle',
    humour VARCHAR(32) DEFAULT 'light',
    language_mix VARCHAR(32) DEFAULT 'pure',
    techniques_helped JSONB DEFAULT '[]'::jsonb,
    techniques_unhelpful JSONB DEFAULT '[]'::jsonb,
    triggers JSONB DEFAULT '[]'::jsonb,
    low_times_of_day JSONB DEFAULT '[]'::jsonb,
    last_mood_mode VARCHAR(32) DEFAULT 'calm',
    total_turns INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_style_profiles ON user_style_profiles(user_id);

