import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { computeKeyedHash } from '@/lib/crypto';
import { otpStore } from '../route';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const rateLimit = checkRateLimit(clientIp, { limit: 10, windowMs: 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many verification attempts. Please wait.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and verification code are required.' }, { status: 400 });
    }

    const emailHash = computeKeyedHash(email.trim().toLowerCase());
    const record = otpStore[emailHash];

    if (!record) {
      return NextResponse.json({ error: 'No verification pending for this email or code expired.' }, { status: 400 });
    }

    if (Date.now() > record.expiresAt) {
      delete otpStore[emailHash];
      return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
    }

    if (record.attempts >= 5) {
      delete otpStore[emailHash];
      return NextResponse.json({ error: 'Too many failed attempts. Code invalidated.' }, { status: 400 });
    }

    const inputHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
    if (inputHash !== record.codeHash) {
      record.attempts += 1;
      return NextResponse.json({ error: 'Invalid verification code. Please check and try again.' }, { status: 400 });
    }

    // Successfully verified
    delete otpStore[emailHash];
    return NextResponse.json({
      success: true,
      verified: true,
      message: 'Email successfully verified.',
    });
  } catch (err) {
    return NextResponse.json({ error: 'Verification failed.' }, { status: 500 });
  }
}
