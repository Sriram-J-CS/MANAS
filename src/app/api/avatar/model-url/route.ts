/**
 * GET /api/avatar/model-url
 * Returns short-lived signed URL for 3D GLB/VRM character models stored in Supabase Storage.
 * Server-only S3 access via STORAGE_BUCKET and STORAGE_ENDPOINT.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { verifyAuth } from '@/lib/auth';
import { getModelSignedUrl } from '@/lib/s3-storage';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const rateLimit = checkRateLimit(clientIp, { limit: 40, windowMs: 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

  const auth = await verifyAuth(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const mascotType = searchParams.get('type') || 'boy'; // 'boy' or 'girl'
    const modelKey = mascotType === 'girl' ? 'girl.glb' : 'boy.glb';

    const { url, expiresInSeconds } = await getModelSignedUrl(`models/${modelKey}`);

    return NextResponse.json({
      modelKey,
      signedUrl: url,
      expiresInSeconds,
      mascotType,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error generating signed model URL';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
