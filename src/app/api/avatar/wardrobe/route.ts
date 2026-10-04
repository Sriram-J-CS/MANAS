/**
 * POST /api/avatar/wardrobe
 * Persists user outfit selection (hoodie, formal, kurta_saree, sports, pyjamas, festive)
 * to Supabase Postgres via DATABASE_URL on the server.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { verifyAuth } from '@/lib/auth';
import { saveUserAvatarChoice, getUserAvatarChoice } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const rateLimit = checkRateLimit(clientIp, { limit: 30, windowMs: 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

  const auth = await verifyAuth(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const { outfit, avatarType, attributes } = await req.json();

    const allowedOutfits = ['hoodie', 'formal', 'kurta_saree', 'sports', 'pyjamas', 'festive'];
    if (!allowedOutfits.includes(outfit)) {
      return NextResponse.json(
        { error: `Invalid outfit. Permitted outfits: ${allowedOutfits.join(', ')}` },
        { status: 400 }
      );
    }

    const userId = auth.user?.id || 'anon_user';

    await saveUserAvatarChoice({
      userId,
      avatarType: avatarType || 'boy',
      outfit,
      attributes,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      outfit,
      avatarType,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Wardrobe save error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const userId = auth.user?.id || 'anon_user';
  const choice = await getUserAvatarChoice(userId);

  return NextResponse.json({
    choice: choice || {
      userId,
      avatarType: 'boy',
      outfit: 'hoodie',
    },
  });
}
