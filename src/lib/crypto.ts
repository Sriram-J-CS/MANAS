import crypto from 'crypto';

/**
 * Server-Side Cryptographic Utilities for PII Data Security
 * Strictly references process.env.DATA_ENCRYPTION_KEY and process.env.DATA_HASH_KEY by NAME only.
 * Implements AES-256-GCM with per-record random 12-byte IVs and authentication tags.
 * Implements HMAC-SHA256 for O(1) keyed lookups without plaintext exposure.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a consistent 32-byte key from DATA_ENCRYPTION_KEY
 */
function getEncryptionKey(): Buffer {
  const rawKey = process.env.DATA_ENCRYPTION_KEY || 'default-secret-encryption-key-for-dev-only-32b';
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Derives a consistent 32-byte key from DATA_HASH_KEY
 */
function getHashKey(): Buffer {
  const rawKey = process.env.DATA_HASH_KEY || 'default-secret-hash-key-for-dev-only-32b';
  return crypto.createHash('sha256').update(rawKey).digest();
}

export interface EncryptedPayload {
  ciphertext: string; // Base64 encoded: IV + AuthTag + Ciphertext
}

/**
 * Encrypts sensitive text using AES-256-GCM with a random IV.
 * Never stores or returns plaintext.
 */
export function encryptData(plaintext: string): string {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine IV (12 bytes) + AuthTag (16 bytes) + Encrypted data
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypts an AES-256-GCM ciphertext payload.
 * Server-side only for verified operational processes.
 */
export function decryptData(combinedBase64: string): string {
  if (!combinedBase64) return '';
  try {
    const combined = Buffer.from(combinedBase64, 'base64');
    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid ciphertext length');
    }

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('[Crypto] Decryption failed or authentication tag mismatch');
    return '';
  }
}

/**
 * Computes a deterministic keyed HMAC-SHA256 hash for database indexing and lookups.
 * Safe for unique constraints without exposing plaintext.
 */
export function computeKeyedHash(value: string): string {
  if (!value) return '';
  const normalized = value.trim().toLowerCase();
  return crypto.createHmac('sha256', getHashKey()).update(normalized).digest('hex');
}

/**
 * Masks an email address for safe UI display (e.g. "robert.smith@gmail.com" -> "r***h@gmail.com")
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***.com';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  const first = local[0];
  const last = local[local.length - 1];
  return `${first}***${last}@${domain}`;
}

/**
 * Masks a phone number for safe UI display (e.g. "+919876543210" -> "+91 ***** **210")
 */
export function maskPhone(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.trim();
  if (cleaned.length < 6) return '*****';
  const prefix = cleaned.slice(0, 3);
  const suffix = cleaned.slice(-3);
  return `${prefix} ***** **${suffix}`;
}
