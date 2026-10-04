/**
 * AvatarRenderer Interface
 * Clean architectural abstraction decoupling mascot visualization
 * from chat dialogue, TTS, and state management.
 */

export type MascotGender = 'boy' | 'girl';
export type MascotEmotion = 'neutral' | 'calm' | 'happy' | 'concerned' | 'sad' | 'surprised';
export type MascotGesture = 'idle' | 'wave' | 'nod' | 'thumbs_up' | 'breathe' | 'listening';
export type MouthShape = 'closed_smile' | 'wide_open' | 'wide_smile' | 'round_o' | 'small_closed';
export type OutfitType = 'yellow_tshirt' | 'hoodie' | 'formal' | 'kurta_saree' | 'sports' | 'pyjamas' | 'festive';

export interface AvatarRendererOptions {
  gender?: MascotGender;
  outfit?: OutfitType;
  baseAssetPath?: string;
  enableTilt?: boolean;
  reducedMotion?: boolean;
  onReady?: () => void;
}

export interface AvatarRenderer {
  /**
   * Initializes canvas/scene inside the provided container
   */
  init(container: HTMLElement, options?: AvatarRendererOptions): Promise<void>;

  /**
   * Crossfade to target facial emotion expression (150ms default)
   */
  setEmotion(emotion: MascotEmotion, crossfadeMs?: number): void;

  /**
   * Update active mouth viseme shape with audio energy
   */
  setViseme(mouthShape: MouthShape, energy?: number): void;

  /**
   * Play gesture animation (wave, nod, thumbs-up, guided breathing)
   */
  setGesture(gesture: MascotGesture): void;

  /**
   * Swap character wardrobe outfit
   */
  setOutfit(outfit: OutfitType): void;

  /**
   * Feed live Web Audio AnalyserNode spectral and volume data
   */
  onAudioFrame(volume: number, spectralCentroid: number): void;

  /**
   * Feed normalized cursor position (-1.0 to 1.0) for 3D perspective tilt
   */
  onUserGaze(normalizedX: number, normalizedY: number): void;

  /**
   * Set user listening / speaking pose
   */
  setIsListening(listening: boolean): void;

  /**
   * Set speech output active state
   */
  setIsSpeaking(speaking: boolean): void;

  /**
   * Cleanup render loops and resources
   */
  destroy(): void;
}
