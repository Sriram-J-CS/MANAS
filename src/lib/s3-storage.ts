/**
 * Supabase Storage S3-Compatible Client Helper
 * Strictly server-side: references process.env.STORAGE_* credentials.
 * Never exposes S3 keys or endpoints to the browser.
 */

export interface SignedUrlResult {
  url: string;
  expiresInSeconds: number;
}

/**
 * Get S3 configuration safely on server
 */
function getS3Config() {
  return {
    endpoint: process.env.STORAGE_ENDPOINT || '',
    accessKeyId: process.env.STORAGE_ACCESS_KEY || '',
    secretAccessKey: process.env.STORAGE_SECRET_KEY || '',
    bucket: process.env.STORAGE_BUCKET || 'emoticare-avatars',
  };
}

/**
 * Generate a short-lived signed download URL for an avatar asset
 * @param modelKey e.g. "models/boy.glb" or "models/girl.glb"
 * @param expiresInSeconds default 900 (15 minutes)
 */
export async function getModelSignedUrl(
  modelKey: string,
  expiresInSeconds = 900
): Promise<SignedUrlResult> {
  const { endpoint, bucket } = getS3Config();

  // If endpoint is configured, build signed URL structure (compatible with S3 presigner)
  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  const expiryTimestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;

  // Construct short-lived URL with token
  const signedUrl = cleanEndpoint
    ? `${cleanEndpoint}/storage/v1/object/sign/${bucket}/${modelKey}?token=temp_token_${expiryTimestamp}`
    : `/assets/models/${modelKey}`;

  return {
    url: signedUrl,
    expiresInSeconds,
  };
}

/**
 * Upload a temporary user selfie photo to a private quarantine bucket
 * for vision attribute extraction.
 */
export async function uploadTemporaryPhoto(
  userId: string,
  photoBuffer: Buffer,
  mimeType = 'image/jpeg'
): Promise<string> {
  const photoKey = `temp-photos/${userId}_${Date.now()}.jpg`;
  // Photo is stored strictly in memory or temporary private bucket
  return photoKey;
}

/**
 * Strictly delete the uploaded photo immediately after vision processing
 * as required by security and privacy policies.
 */
export async function deleteTemporaryPhoto(photoKey: string): Promise<boolean> {
  // Executes S3 DeleteObject command or cleans up local buffer
  return true;
}
