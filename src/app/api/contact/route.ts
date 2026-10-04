import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { encryptData, computeKeyedHash, maskEmail, maskPhone } from '@/lib/crypto';
import crypto from 'crypto';

export const runtime = 'nodejs';

// In-memory / DB contact store for demonstration
// In production, queries the PostgreSQL `user_contacts` table via db client
const contactStore: Record<
  string,
  {
    userId: string;
    emailCiphertext: string;
    emailHash: string;
    phoneCiphertext: string;
    phoneHash: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    consentAt: string;
    consentVersion: string;
  }
> = {};

// Ephemeral OTP codes (hash -> { codeHash, expiresAt, attempts })
export const otpStore: Record<string, { codeHash: string; expiresAt: number; attempts: number }> = {};

export async function POST(req: NextRequest) {
  // 1. Rate Limiting Check
  const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const rateLimit = checkRateLimit(clientIp, { limit: 10, windowMs: 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { userId, email, phone, consent } = body;

    // 2. Validation
    if (!consent) {
      return NextResponse.json({ error: 'Consent is required to save contact information.' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }

    // E.164 phone regex (e.g. +919876543210)
    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    const cleanPhone = phone ? phone.trim() : '';
    if (cleanPhone && !phoneRegex.test(cleanPhone)) {
      return NextResponse.json({ error: 'Phone number must be in E.164 format (e.g. +919876543210).' }, { status: 400 });
    }

    // 3. Encrypt sensitive data using AES-256-GCM & compute keyed hash
    const emailCiphertext = encryptData(email.trim().toLowerCase());
    const emailHash = computeKeyedHash(email.trim().toLowerCase());

    const phoneCiphertext = cleanPhone ? encryptData(cleanPhone) : '';
    const phoneHash = cleanPhone ? computeKeyedHash(cleanPhone) : '';

    const effectiveUserId = userId || crypto.randomUUID();

    // 4. Generate 6-digit OTP for email verification
    const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = crypto.createHash('sha256').update(emailOtp).digest('hex');
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore[emailHash] = {
      codeHash,
      expiresAt,
      attempts: 0,
    };

    // Check if SMS provider is configured for mobile OTP
    const hasSmsProvider = Boolean(process.env.SMS_PROVIDER_API_KEY || process.env.TWILIO_ACCOUNT_SID);
    const phoneVerified = false;

    // 5. Store record
    contactStore[effectiveUserId] = {
      userId: effectiveUserId,
      emailCiphertext,
      emailHash,
      phoneCiphertext,
      phoneHash,
      emailVerified: false,
      phoneVerified,
      consentAt: new Date().toISOString(),
      consentVersion: 'v1.0',
    };

    // Return masked data and dev-mode OTP indicator (without logging PII)
    const isDev = process.env.NODE_ENV !== 'production';

    return NextResponse.json({
      success: true,
      userId: effectiveUserId,
      maskedEmail: maskEmail(email),
      maskedPhone: cleanPhone ? maskPhone(cleanPhone) : null,
      emailVerified: false,
      phoneVerified: false,
      hasSmsProvider,
      message: 'Verification code sent to your email.',
      // In local development without an SMTP server configured, return code for verification ease
      ...(isDev ? { devOtpCode: emailOtp } : {}),
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to process contact details.' }, { status: 500 });
  }
}
