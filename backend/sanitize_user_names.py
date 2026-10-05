import sqlite3
import sys
from app.services.user_crypto import decrypt_user_text, encrypt_user_text

sys.stdout.reconfigure(encoding='utf-8')
conn = sqlite3.connect('manas_twin.db')
c = conn.cursor()

# Find all chat_messages containing Akshay and replace with sriram for user bb859fec-fd0f-43a3-a1ee-258534671245
uid = 'bb859fec-fd0f-43a3-a1ee-258534671245'
c.execute("SELECT id, text FROM chat_messages WHERE user_id=?", (uid,))
updated_count = 0
for row_id, enc_text in c.fetchall():
    plain = decrypt_user_text(uid, enc_text)
    if 'akshay' in plain.lower():
        # Replace case-insensitively
        new_plain = plain.replace('Akshay', 'Sriram').replace('akshay', 'sriram')
        new_enc = encrypt_user_text(uid, new_plain)
        c.execute("UPDATE chat_messages SET text=? WHERE id=?", (new_enc, row_id))
        updated_count += 1
        print(f"Updated message {row_id}: {new_plain[:80]}")

conn.commit()

# Also ensure users table has sriram for bb859fec-fd0f-43a3-a1ee-258534671245
c.execute("SELECT id, name FROM users WHERE id=?", (uid,))
u = c.fetchone()
if not u:
    c.execute("INSERT OR REPLACE INTO users (id, name, role) VALUES (?, 'sriram', 'student')", (uid,))
    conn.commit()
    print("Inserted users entry for sriram.")
else:
    c.execute("UPDATE users SET name='sriram' WHERE id=?", (uid,))
    conn.commit()
    print("Updated users entry to sriram.")

print(f"Sanitization complete: {updated_count} messages updated.")
