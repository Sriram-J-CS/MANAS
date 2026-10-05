"""
services/user_crypto.py - Per-User AES-256-GCM Encryption (DPDP Act & Clinical Privacy)
────────────────────────────────────────────────────────────────────────────────────────
Provides cryptographic isolation for every user:
1. Derives a unique 256-bit AES key per user from the master key + user_id using HMAC-SHA256 (HKDF).
2. Encrypts sensitive fields (memories, journals, notes, goals, chat text) using AES-256-GCM.
3. Every ciphertext contains a fresh cryptographically random 96-bit IV and 128-bit authentication tag.
4. Seamlessly decrypts per user, with graceful fallback for unencrypted legacy rows.
"""

import os
import base64
import hashlib
import hmac
from typing import Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Magic prefix to identify encrypted ciphertexts
CIPHER_PREFIX = "enc:v1:"

def get_master_encryption_key() -> bytes:
    """Retrieves master encryption key from environment, hashed to 32 bytes."""
    raw = os.environ.get("DATA_ENCRYPTION_KEY", "default-dev-aes-key-for-manas-32b-length!!").encode("utf-8")
    return hashlib.sha256(raw).digest()

def derive_user_key(user_id: str) -> bytes:
    """
    Derives a cryptographically isolated 32-byte (256-bit) AES key for a specific user_id.
    Ensures data from user A cannot be decrypted with keys from user B.
    """
    master_key = get_master_encryption_key()
    normalized_uid = (user_id or "anonymous").strip().encode("utf-8")
    # HMAC-SHA256 derivation with domain separation
    return hmac.new(master_key, b"manas-user-aes256-key:" + normalized_uid, hashlib.sha256).digest()

def encrypt_user_text(user_id: str, plaintext: Optional[str]) -> str:
    """
    Encrypts plaintext for a specific user using AES-256-GCM with a random 12-byte IV.
    Returns: 'enc:v1:' + base64(iv + ciphertext_with_tag)
    """
    if plaintext is None:
        return ""
    if not isinstance(plaintext, str):
        plaintext = str(plaintext)
    if not plaintext:
        return ""

    user_key = derive_user_key(user_id)
    aesgcm = AESGCM(user_key)
    iv = os.urandom(12)  # 96-bit random IV
    ciphertext = aesgcm.encrypt(iv, plaintext.encode("utf-8"), user_id.encode("utf-8"))
    payload = base64.b64encode(iv + ciphertext).decode("utf-8")
    return f"{CIPHER_PREFIX}{payload}"

def decrypt_user_text(user_id: str, ciphertext: Optional[str]) -> str:
    """
    Decrypts user ciphertext.
    If the string does not have the CIPHER_PREFIX or decryption fails,
    returns the original string (safe backwards compatibility with pre-migration data).
    """
    if not ciphertext or not isinstance(ciphertext, str):
        return ""

    if not ciphertext.startswith(CIPHER_PREFIX):
        return ciphertext

    try:
        raw_b64 = ciphertext[len(CIPHER_PREFIX):]
        raw_data = base64.b64decode(raw_b64)
        if len(raw_data) < 28:  # 12 IV + 16 Tag minimum
            return ciphertext

        iv = raw_data[:12]
        payload = raw_data[12:]
        user_key = derive_user_key(user_id)
        aesgcm = AESGCM(user_key)
        decrypted_bytes = aesgcm.decrypt(iv, payload, user_id.encode("utf-8"))
        return decrypted_bytes.decode("utf-8")
    except Exception:
        # If decryption fails (e.g. wrong user key or corrupted), return empty or fallback
        return ciphertext
