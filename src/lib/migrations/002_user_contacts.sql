-- Migration 002: Secure Contact Storage with AES-256-GCM & HMAC-SHA256
-- Compliant with DPDP Act 2023 & Zero-PII leak standards

CREATE TABLE IF NOT EXISTS user_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email_ciphertext TEXT NOT NULL,
    email_hash TEXT NOT NULL UNIQUE,
    phone_ciphertext TEXT,
    phone_hash TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consent_version TEXT NOT NULL DEFAULT 'v1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on email_hash and phone_hash for O(1) keyed lookups without decrypting
CREATE INDEX IF NOT EXISTS idx_user_contacts_email_hash ON user_contacts(email_hash);
CREATE INDEX IF NOT EXISTS idx_user_contacts_phone_hash ON user_contacts(phone_hash);
CREATE INDEX IF NOT EXISTS idx_user_contacts_user_id ON user_contacts(user_id);

-- Access Audit Log Table (Tracking all decryption / access events without storing PII)
CREATE TABLE IF NOT EXISTS contact_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action TEXT NOT NULL, -- 'contact_stored', 'otp_sent', 'otp_verified', 'data_deleted'
    ip_hash TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OTP Verifications Table (Temporary hashes for one-time code verification, TTL 10 mins)
CREATE TABLE IF NOT EXISTS contact_otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_hash TEXT NOT NULL, -- HMAC-SHA256 of email or phone
    code_hash TEXT NOT NULL,    -- HMAC-SHA256 of 6-digit OTP
    attempts INT DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_contact_hash ON contact_otp_verifications(contact_hash);

-- Enable Row Level Security (RLS) on user_contacts
ALTER TABLE user_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_otp_verifications ENABLE ROW LEVEL SECURITY;

-- Deny all direct client access by default; all access goes through authenticated server routes
DROP POLICY IF EXISTS deny_all_client_user_contacts ON user_contacts;
CREATE POLICY deny_all_client_user_contacts ON user_contacts
    FOR ALL
    USING (false);

DROP POLICY IF EXISTS deny_all_client_audit_logs ON contact_audit_logs;
CREATE POLICY deny_all_client_audit_logs ON contact_audit_logs
    FOR ALL
    USING (false);
