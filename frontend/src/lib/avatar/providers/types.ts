/**
 * types.ts
 * Type definitions and interface contracts for PhotoAvatarProvider.
 */

export interface AvatarAppearanceAttributes {
  skin_tone_hex?: string;
  hair_color_hex?: string;
  hair_length?: 'short' | 'medium' | 'long';
  hair_style?: string; // 'straight' | 'wavy' | 'curly' | 'buzz'
  eye_color_hex?: string;
  lip_color_hex?: string;
  glasses?: boolean;
  glasses_shape?: 'round' | 'rectangle' | 'oval' | 'square' | 'none';
  glasses_color_hex?: string;
  facial_hair?: 'none' | 'stubble' | 'beard' | 'moustache';
  face_shape?: string;
  age_range?: string;
  confidence?: number;
  serverEnhanced?: boolean;
}

export interface PhotoProcessOptions {
  /**
   * If true and user consent was explicitly provided,
   * sends the transient image to gemini-3.8-flash for structured glasses/hair/age analysis.
   */
  allowServerAnalysis?: boolean;
  /**
   * Explicit user consent flag.
   */
  userConsentGiven?: boolean;
}

export interface PhotoAvatarProvider {
  /** Unique provider identifier */
  readonly id: string;
  /** Human-readable provider name */
  readonly name: string;
  /** Indicates whether the provider is currently enabled and operational */
  readonly isEnabled: boolean;

  /**
   * Processes a photo input (File, Blob, HTMLImageElement, or Base64 data URL)
   * and returns normalized avatar visual styling attributes.
   */
  processPhoto(
    imageSource: File | Blob | HTMLImageElement | string,
    options?: PhotoProcessOptions
  ): Promise<AvatarAppearanceAttributes>;
}
