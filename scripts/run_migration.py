import os
import ssl
import sys
import pg8000.native

def run():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    # Use Supabase Pooler (IPv4 compatible on port 5432 session mode)
    host = "aws-0-ap-northeast-1.pooler.supabase.com"
    user = "postgres.srrpzjnasuodtdwdhjmk"
    port = 5432
    database = "postgres"
    password = os.environ.get("SUPABASE_DB_PASSWORD", "sriramlovesdiya")

    print(f"Connecting to Supabase at {host}:{port}...")
    conn = pg8000.native.Connection(
        user=user,
        host=host,
        port=port,
        database=database,
        password=password,
        ssl_context=ctx
    )
    print("Connected successfully!")

    # 1. Ensure users table exists so foreign keys in migrations resolve cleanly
    users_table_sql = """
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL DEFAULT 'User',
        age INTEGER DEFAULT 20,
        is_minor BOOLEAN DEFAULT FALSE,
        guardian_consent BOOLEAN DEFAULT FALSE,
        reasons JSONB DEFAULT '[]'::jsonb,
        tone TEXT DEFAULT 'gentle',
        role TEXT,
        language TEXT DEFAULT 'en',
        style_pref TEXT DEFAULT 'reflective',
        avatar_data TEXT,
        voice_pref TEXT,
        consent_chat BOOLEAN DEFAULT TRUE,
        consent_mood BOOLEAN DEFAULT TRUE,
        consent_cadence BOOLEAN DEFAULT TRUE,
        consent_timestamp TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    """
    conn.run(users_table_sql)
    print("Table 'users' verified/created.")

    # 2. Execute migration 002_user_contacts.sql
    migration_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src", "lib", "migrations", "002_user_contacts.sql")
    with open(migration_file, "r", encoding="utf-8") as f:
        migration_sql = f.read()

    conn.run(migration_sql)
    print("Migration 002_user_contacts.sql executed successfully!")

    # 3. Verify tables and indexes
    tables = conn.run("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;")
    print("\nVerified Public Tables in Supabase Database:")
    for t in tables:
        print(f"  [x] {t[0]}")

    indexes = conn.run("SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname;")
    print("\nVerified Indexes:")
    for idx in indexes:
        print(f"  [x] {idx[0]}")

    policies = conn.run("SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;")
    print("\nVerified Row Level Security Policies:")
    for pol in policies:
        print(f"  [x] {pol[0]} -> {pol[1]}")

    conn.close()
    print("\nAll database migrations completed and verified.")

if __name__ == "__main__":
    run()
