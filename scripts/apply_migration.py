import os
import ssl
import sys
import pg8000.native

def run():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    host = "aws-0-ap-northeast-1.pooler.supabase.com"
    user = "postgres.srrpzjnasuodtdwdhjmk"
    port = 5432
    database = "postgres"
    password = os.environ.get("SUPABASE_DB_PASSWORD", "sriramlovesdiya")

    print(f"Connecting to Supabase database at {host}:{port}...")
    conn = pg8000.native.Connection(
        user=user,
        host=host,
        port=port,
        database=database,
        password=password,
        ssl_context=ctx
    )
    print("Connected successfully!")

    migration_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "supabase", "migrations", "001_init.sql")
    with open(migration_file, "r", encoding="utf-8") as f:
        migration_sql = f.read()

    # Split into statements
    statements = [s.strip() for s in migration_sql.split(";") if s.strip()]
    print(f"Executing {len(statements)} statements...")
    for idx, stmt in enumerate(statements, 1):
        try:
            conn.run(stmt)
        except Exception as e:
            print(f"Failed on statement #{idx}:\n{stmt}\nError: {e}")
            sys.exit(1)

    print("All statements executed successfully!")

    tables = conn.run("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;")
    print("\nVerified Public Tables in Supabase Database:")
    for t in tables:
        print(f"  [x] {t[0]}")

    conn.close()

if __name__ == "__main__":
    run()
