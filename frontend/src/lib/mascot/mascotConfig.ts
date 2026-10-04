/**
 * Configuration and State for the MANAS 3D Mascot.
 */

export type MascotPersonality = 'friendly' | 'calm' | 'encouraging' | 'playful' | 'professional';
export type MascotBackground = 'warm_cream' | 'zen_sand' | 'gentle_lavender' | 'soft_sage' | 'clean_white';

export interface MascotConfig {
  name: string;
  personality: MascotPersonality;
  voice: string;
  speakingEnabled: boolean;
  animationsEnabled: boolean;
  voiceSpeed: number; // 0.6 to 1.4, default 0.95
  expressionIntensity: number; // 0.5 to 1.5, default 1.0
  background: MascotBackground;
  isCustomModel: boolean;
  customModelName?: string;
  customModelType?: 'glb' | 'gltf' | 'fbx' | 'obj' | 'image';
}

export const DEFAULT_MASCOT_CONFIG: MascotConfig = {
  name: 'MANAS',
  personality: 'friendly',
  voice: 'default',
  speakingEnabled: true,
  animationsEnabled: true,
  voiceSpeed: 0.95,
  expressionIntensity: 1.0,
  background: 'warm_cream',
  isCustomModel: false,
};

const STORAGE_KEY = 'manas_mascot_config';

export function getMascotConfig(): MascotConfig {
  if (typeof window === 'undefined') return DEFAULT_MASCOT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_MASCOT_CONFIG, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.warn('Failed to parse mascot config:', err);
  }
  return DEFAULT_MASCOT_CONFIG;
}

export function saveMascotConfig(config: Partial<MascotConfig>): MascotConfig {
  const current = getMascotConfig();
  const next = { ...current, ...config };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('manas:mascot_config_updated', { detail: next }));
    } catch (err) {
      console.warn('Failed to save mascot config:', err);
    }
  }
  return next;
}
