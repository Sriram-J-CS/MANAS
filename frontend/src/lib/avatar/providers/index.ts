/**
 * index.ts
 * Provider registry and factory exports for PhotoAvatarProvider.
 */

import type { PhotoAvatarProvider } from './types';
import { mediaPipeGeminiProvider } from './MediaPipeGeminiProvider';
import { avaturnProvider } from './AvaturnProvider';

export * from './types';
export { MediaPipeGeminiProvider, mediaPipeGeminiProvider } from './MediaPipeGeminiProvider';
export { AvaturnProvider, avaturnProvider } from './AvaturnProvider';

const AVAILABLE_PROVIDERS: Record<string, PhotoAvatarProvider> = {
  mediapipe_gemini: mediaPipeGeminiProvider,
  avaturn: avaturnProvider,
};

/**
 * Returns the requested avatar provider or the default MediaPipe + Gemini provider.
 */
export function getPhotoAvatarProvider(providerId: string = 'mediapipe_gemini'): PhotoAvatarProvider {
  return AVAILABLE_PROVIDERS[providerId] || mediaPipeGeminiProvider;
}

/**
 * Lists all registered providers.
 */
export function listPhotoAvatarProviders(): PhotoAvatarProvider[] {
  return Object.values(AVAILABLE_PROVIDERS);
}
