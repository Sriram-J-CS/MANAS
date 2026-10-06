/**
 * AvaturnProvider.ts
 *
 * Stub provider for Avaturn (avaturn.me) 3D Avatar Generation API.
 * Currently disabled.
 *
 * Required Environment Variables to enable:
 * - VITE_AVATURN_API_KEY: Developer API key from the Avaturn Dashboard
 * - VITE_AVATURN_SUBDOMAIN: Project subdomain allocated by Avaturn (e.g. "my-project.avaturn.dev")
 * - VITE_AVATURN_EXPORT_FORMAT: Avatar export format ("vrm" or "glb", defaults to "vrm")
 *
 * Flow when implemented:
 * 1. Initialize Avaturn iframe / SDK with subdomain & session token
 * 2. User captures or uploads photo into Avaturn engine
 * 3. Receive exported VRM/GLB mesh url or appearance JSON
 * 4. Map Avaturn metadata to AvatarAppearanceAttributes
 */

import type { PhotoAvatarProvider, AvatarAppearanceAttributes, PhotoProcessOptions } from './types';

export class AvaturnProvider implements PhotoAvatarProvider {
  readonly id = 'avaturn';
  readonly name = 'Avaturn 3D Provider (Stub)';
  readonly isEnabled = false;

  async processPhoto(
    _imageSource: File | Blob | HTMLImageElement | string,
    _options?: PhotoProcessOptions
  ): Promise<AvatarAppearanceAttributes> {
    throw new Error(
      'AvaturnProvider is currently disabled. To enable this provider, set VITE_AVATURN_API_KEY and VITE_AVATURN_SUBDOMAIN in your environment configuration.'
    );
  }
}

export const avaturnProvider = new AvaturnProvider();
