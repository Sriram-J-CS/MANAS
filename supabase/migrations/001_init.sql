-- ==============================================================================
-- MANAS / EmotiCare AI — Multi-User Strict Isolation Migration
-- Migration: 001_init.sql
-- All 16 tables enforce:
--   1. user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
--   2. ROW LEVEL SECURITY (RLS) ENABLED
--   3. Strict RLS Policies: (user_id = auth.uid()) for SELECT, INSERT, UPDATE, DELETE
-- ==============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. PROFILES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    name TEXT NOT NULL,
    age INTEGER CHECK (age >= 13 AND age <= 100),
    is_minor BOOLEAN DEFAULT FALSE,
    guardian_consent BOOLEAN DEFAULT FALSE,
    language TEXT DEFAULT 'en',
    companion TEXT DEFAULT 'girl' CHECK (companion IN ('girl', 'boy')),
    voice_gender TEXT DEFAULT 'girl' CHECK (voice_gender IN ('girl', 'boy')),
    voice_tone TEXT DEFAULT 'ananya',
    avatar_url TEXT,
    avatar_type TEXT DEFAULT '3d_vrm',
    style_pref TEXT DEFAULT 'reflective',
    tone TEXT DEFAULT 'gentle',
    role TEXT DEFAULT 'student',
    reasons JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- ------------------------------------------------------------------------------
-- 2. CONVERSATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
CREATE POLICY "conversations_select" ON public.conversations FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "conversations_update" ON public.conversations;
CREATE POLICY "conversations_update" ON public.conversations FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "conversations_delete" ON public.conversations;
CREATE POLICY "conversations_delete" ON public.conversations FOR DELETE USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);

-- ------------------------------------------------------------------------------
-- 3. MESSAGES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    emotion TEXT DEFAULT 'neutral',
    tool TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "messages_update" ON public.messages;
CREATE POLICY "messages_update" ON public.messages FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "messages_delete" ON public.messages;
CREATE POLICY "messages_delete" ON public.messages FOR DELETE USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at ASC);

-- ------------------------------------------------------------------------------
-- 4. MEMORIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'general',
    fact TEXT NOT NULL,
    source TEXT DEFAULT 'chat_auto',
    importance REAL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "memories_select" ON public.memories;
CREATE POLICY "memories_select" ON public.memories FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "memories_insert" ON public.memories;
CREATE POLICY "memories_insert" ON public.memories FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "memories_update" ON public.memories;
CREATE POLICY "memories_update" ON public.memories FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "memories_delete" ON public.memories;
CREATE POLICY "memories_delete" ON public.memories FOR DELETE USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON public.memories(user_id);

-- ------------------------------------------------------------------------------
-- 5. MOOD_EVENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mood_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    valence REAL DEFAULT 0.0,
    arousal REAL DEFAULT 0.0,
    emotions JSONB DEFAULT '[]'::jsonb,
    note TEXT,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mood_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mood_events_select" ON public.mood_events;
CREATE POLICY "mood_events_select" ON public.mood_events FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "mood_events_insert" ON public.mood_events;
CREATE POLICY "mood_events_insert" ON public.mood_events FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "mood_events_update" ON public.mood_events;
CREATE POLICY "mood_events_update" ON public.mood_events FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "mood_events_delete" ON public.mood_events;
CREATE POLICY "mood_events_delete" ON public.mood_events FOR DELETE USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_mood_events_user_id ON public.mood_events(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_events_created_at ON public.mood_events(created_at DESC);

-- ------------------------------------------------------------------------------
-- 6. TWIN_SNAPSHOTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.twin_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    stress REAL DEFAULT 5.0,
    sleep REAL DEFAULT 7.0,
    energy REAL DEFAULT 5.0,
    focus REAL DEFAULT 5.0,
    workload REAL DEFAULT 5.0,
    activity REAL DEFAULT 5.0,
    baseline_variance JSONB DEFAULT '{}'::jsonb,
    source TEXT DEFAULT 'chat_auto',
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.twin_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "twin_snapshots_select" ON public.twin_snapshots;
CREATE POLICY "twin_snapshots_select" ON public.twin_snapshots FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "twin_snapshots_insert" ON public.twin_snapshots;
CREATE POLICY "twin_snapshots_insert" ON public.twin_snapshots FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "twin_snapshots_update" ON public.twin_snapshots;
CREATE POLICY "twin_snapshots_update" ON public.twin_snapshots FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "twin_snapshots_delete" ON public.twin_snapshots;
CREATE POLICY "twin_snapshots_delete" ON public.twin_snapshots FOR DELETE USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_twin_snapshots_user_id ON public.twin_snapshots(user_id);

-- ------------------------------------------------------------------------------
-- 7. EMPATHY_SCORES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.empathy_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    validation_score REAL DEFAULT 5.0,
    reflection_score REAL DEFAULT 5.0,
    non_judgment_score REAL DEFAULT 5.0,
    safety_score REAL DEFAULT 5.0,
    language_match_score REAL DEFAULT 5.0,
    overall_score REAL DEFAULT 5.0,
    critic_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.empathy_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empathy_scores_select" ON public.empathy_scores;
CREATE POLICY "empathy_scores_select" ON public.empathy_scores FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "empathy_scores_insert" ON public.empathy_scores;
CREATE POLICY "empathy_scores_insert" ON public.empathy_scores FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "empathy_scores_update" ON public.empathy_scores;
CREATE POLICY "empathy_scores_update" ON public.empathy_scores FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "empathy_scores_delete" ON public.empathy_scores;
CREATE POLICY "empathy_scores_delete" ON public.empathy_scores FOR DELETE USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_empathy_scores_user_id ON public.empathy_scores(user_id);

-- ------------------------------------------------------------------------------
-- 8. FEEDBACK
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    rating TEXT NOT NULL CHECK (rating IN ('thumbs_up', 'thumbs_down', 'not_understood')),
    felt_understood INTEGER DEFAULT 1,
    comment TEXT,
    user_consent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feedback_select" ON public.feedback;
CREATE POLICY "feedback_select" ON public.feedback FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "feedback_insert" ON public.feedback;
CREATE POLICY "feedback_insert" ON public.feedback FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "feedback_update" ON public.feedback;
CREATE POLICY "feedback_update" ON public.feedback FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "feedback_delete" ON public.feedback;
CREATE POLICY "feedback_delete" ON public.feedback FOR DELETE USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);

-- ------------------------------------------------------------------------------
-- 9. INSIGHTS (WHAT-WORKS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    strategy_name TEXT NOT NULL,
    suggestion_text TEXT NOT NULL,
    evidence_message TEXT,
    action_type TEXT DEFAULT 'try_this',
    effectiveness_score REAL DEFAULT 1.0,
    times_used INTEGER DEFAULT 1,
    is_helpful BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "insights_select" ON public.insights;
CREATE POLICY "insights_select" ON public.insights FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "insights_insert" ON public.insights;
CREATE POLICY "insights_insert" ON public.insights FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "insights_update" ON public.insights;
CREATE POLICY "insights_update" ON public.insights FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "insights_delete" ON public.insights;
CREATE POLICY "insights_delete" ON public.insights FOR DELETE USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_insights_user_id ON public.insights(user_id);

-- ------------------------------------------------------------------------------
-- 10. PERSONALITY (OCEAN / BIG FIVE)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.personality (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    openness REAL DEFAULT 0.5,
    conscientiousness REAL DEFAULT 0.5,
    extraversion REAL DEFAULT 0.5,
    agreeableness REAL DEFAULT 0.5,
    neuroticism REAL DEFAULT 0.5,
    adaptation_enabled BOOLEAN DEFAULT TRUE,
    answers_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.personality ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "personality_select" ON public.personality;
CREATE POLICY "personality_select" ON public.personality FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "personality_insert" ON public.personality;
CREATE POLICY "personality_insert" ON public.personality FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "personality_update" ON public.personality;
CREATE POLICY "personality_update" ON public.personality FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "personality_delete" ON public.personality;
CREATE POLICY "personality_delete" ON public.personality FOR DELETE USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_personality_user_id ON public.personality(user_id);

-- ------------------------------------------------------------------------------
-- 11. JOURNAL_ENTRIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    content TEXT NOT NULL,
    tags JSONB DEFAULT '[]'::jsonb,
    mood_score INTEGER,
    is_private BOOLEAN DEFAULT FALSE,
    ai_reflection TEXT,
    is_auto_summary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "journal_entries_select" ON public.journal_entries;
CREATE POLICY "journal_entries_select" ON public.journal_entries FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "journal_entries_insert" ON public.journal_entries;
CREATE POLICY "journal_entries_insert" ON public.journal_entries FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "journal_entries_update" ON public.journal_entries;
CREATE POLICY "journal_entries_update" ON public.journal_entries FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "journal_entries_delete" ON public.journal_entries;
CREATE POLICY "journal_entries_delete" ON public.journal_entries FOR DELETE USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON public.journal_entries(user_id);

-- ------------------------------------------------------------------------------
-- 12. GOALS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'mindfulness',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
    progress_pct INTEGER DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
    is_suggested BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "goals_select" ON public.goals;
CREATE POLICY "goals_select" ON public.goals FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "goals_insert" ON public.goals;
CREATE POLICY "goals_insert" ON public.goals FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "goals_update" ON public.goals;
CREATE POLICY "goals_update" ON public.goals FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "goals_delete" ON public.goals;
CREATE POLICY "goals_delete" ON public.goals FOR DELETE USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);

-- ------------------------------------------------------------------------------
-- 13. SAFETY_PLAN
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.safety_plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    warning_signs JSONB DEFAULT '[]'::jsonb,
    internal_coping JSONB DEFAULT '[]'::jsonb,
    distraction_places JSONB DEFAULT '[]'::jsonb,
    trusted_people JSONB DEFAULT '[]'::jsonb,
    professional_contacts JSONB DEFAULT '[]'::jsonb,
    safe_environment_steps JSONB DEFAULT '[]'::jsonb,
    emergency_hotlines JSONB DEFAULT '["Tele-MANAS: 14416", "Emergency: 112", "Childline: 1098"]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.safety_plan ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "safety_plan_select" ON public.safety_plan;
CREATE POLICY "safety_plan_select" ON public.safety_plan FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "safety_plan_insert" ON public.safety_plan;
CREATE POLICY "safety_plan_insert" ON public.safety_plan FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "safety_plan_update" ON public.safety_plan;
CREATE POLICY "safety_plan_update" ON public.safety_plan FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "safety_plan_delete" ON public.safety_plan;
CREATE POLICY "safety_plan_delete" ON public.safety_plan FOR DELETE USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_safety_plan_user_id ON public.safety_plan(user_id);

-- ------------------------------------------------------------------------------
-- 14. AVATAR_ATTRS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.avatar_attrs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    companion TEXT NOT NULL DEFAULT 'girl' CHECK (companion IN ('girl', 'boy')),
    skin_tone TEXT DEFAULT '#D4A373',
    hair_color TEXT DEFAULT '#1A1110',
    hair_style TEXT DEFAULT 'short_fade',
    outfit_color TEXT DEFAULT '#6366F1',
    glasses BOOLEAN DEFAULT FALSE,
    photo_extracted BOOLEAN DEFAULT FALSE,
    attributes_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.avatar_attrs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "avatar_attrs_select" ON public.avatar_attrs;
CREATE POLICY "avatar_attrs_select" ON public.avatar_attrs FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "avatar_attrs_insert" ON public.avatar_attrs;
CREATE POLICY "avatar_attrs_insert" ON public.avatar_attrs FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "avatar_attrs_update" ON public.avatar_attrs;
CREATE POLICY "avatar_attrs_update" ON public.avatar_attrs FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "avatar_attrs_delete" ON public.avatar_attrs;
CREATE POLICY "avatar_attrs_delete" ON public.avatar_attrs FOR DELETE USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_avatar_attrs_user_id ON public.avatar_attrs(user_id);

-- ------------------------------------------------------------------------------
-- 15. CONSENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL,
    granted BOOLEAN NOT NULL DEFAULT TRUE,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, consent_type)
);

ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "consents_select" ON public.consents;
CREATE POLICY "consents_select" ON public.consents FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "consents_insert" ON public.consents;
CREATE POLICY "consents_insert" ON public.consents FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "consents_update" ON public.consents;
CREATE POLICY "consents_update" ON public.consents FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "consents_delete" ON public.consents;
CREATE POLICY "consents_delete" ON public.consents FOR DELETE USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_consents_user_id ON public.consents(user_id);

-- ------------------------------------------------------------------------------
-- 16. NOTIFICATION_PREFS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_prefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    quiet_hours_start TEXT DEFAULT '22:00',
    quiet_hours_end TEXT DEFAULT '07:00',
    checkin_reminders BOOLEAN DEFAULT TRUE,
    reflection_prompts BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notification_prefs_select" ON public.notification_prefs;
CREATE POLICY "notification_prefs_select" ON public.notification_prefs FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notification_prefs_insert" ON public.notification_prefs;
CREATE POLICY "notification_prefs_insert" ON public.notification_prefs FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "notification_prefs_update" ON public.notification_prefs;
CREATE POLICY "notification_prefs_update" ON public.notification_prefs FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "notification_prefs_delete" ON public.notification_prefs;
CREATE POLICY "notification_prefs_delete" ON public.notification_prefs FOR DELETE USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id ON public.notification_prefs(user_id);
