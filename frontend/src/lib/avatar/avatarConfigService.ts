/**
 * Avatar Configuration Service:
 * Handles pickModel() selection from /models/variants/,
 * avatar.applyConfig() execution, and persistence to user's profile and localStorage.
 */

export interface AvatarColors {
  skin: string;
  hair: string;
  outfit?: string;
}

export interface PickModelOptions {
  hairStyle?: string;
  gender?: 'boy' | 'girl' | string;
  glasses?: boolean;
}

export interface AvatarConfig {
  colors: AvatarColors;
  model: string;
  gender?: 'boy' | 'girl';
  hairStyle?: string;
  glasses?: boolean;
  outfit?: string;
}

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  colors: {
    skin: '#FDEED9',
    hair: '#2C221E',
    outfit: '#3B82F6',
  },
  model: '/models/variants/boy_short_classic.glb',
  gender: 'boy',
  hairStyle: 'short',
  glasses: false,
  outfit: 'hoodie',
};

const STORAGE_KEY = 'manas_avatar_config';

/**
 * Chooses the closest 3D model variant from /models/variants/
 * based on detected hairStyle, gender, and glasses.
 */
export function pickModel(options: PickModelOptions): string {
  const gender = options.gender === 'girl' ? 'girl' : 'boy';
  const hasGlasses = Boolean(options.glasses);
  const hairStyle = (options.hairStyle || 'short').toLowerCase();

  if (gender === 'girl') {
    if (hasGlasses) {
      return '/models/variants/girl_bob_glasses.glb';
    }
    if (hairStyle.includes('long') || hairStyle.includes('wavy')) {
      return '/models/variants/girl_wavy_long.glb';
    }
    return '/models/variants/girl_straight.glb';
  }

  // Boy variants
  if (hasGlasses) {
    return '/models/variants/boy_glasses.glb';
  }
  if (hairStyle.includes('curly') || hairStyle.includes('afro')) {
    return '/models/variants/boy_curly.glb';
  }
  return '/models/variants/boy_short_classic.glb';
}

/**
 * Global avatar controller object matching the exact specification:
 * avatar.applyConfig({ colors: { skin, hair }, model: pickModel(...) })
 */
export const avatar = {
  applyConfig: (config: Partial<AvatarConfig>): AvatarConfig => {
    const current = avatar.getConfig();
    const updated: AvatarConfig = {
      ...current,
      ...config,
      colors: {
        ...current.colors,
        ...(config.colors || {}),
      },
      model: config.model || current.model,
    };

    avatar.saveConfig(updated);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('manas:avatar_config_updated', { detail: updated })
      );
    }

    return updated;
  },

  getConfig: (): AvatarConfig => {
    if (typeof window === 'undefined') return DEFAULT_AVATAR_CONFIG;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_AVATAR_CONFIG, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('Failed to parse avatar config from storage:', e);
    }
    return DEFAULT_AVATAR_CONFIG;
  },

  saveConfig: (config: AvatarConfig): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));

      // Also sync into user profile if exists
      const userProfileRaw = localStorage.getItem('manas_twin_profile');
      if (userProfileRaw) {
        const userProfile = JSON.parse(userProfileRaw);
        userProfile.avatarConfig = config;
        userProfile.avatarUrl = config.model;
        userProfile.skinTone = config.colors.skin;
        userProfile.hairColor = config.colors.hair;
        localStorage.setItem('manas_twin_profile', JSON.stringify(userProfile));
      }
    } catch (e) {
      console.warn('Failed to save avatar config:', e);
    }
  },

  loadConfigOnStartup: (): AvatarConfig => {
    const config = avatar.getConfig();
    if (typeof window !== 'undefined') {
      // Dispatches startup load event
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('manas:avatar_config_updated', { detail: config })
        );
      }, 50);
    }
    return config;
  },

  setGender: (gender: 'boy' | 'girl'): AvatarConfig => {
    return avatar.applyConfig({ gender });
  },

  setOutfit: (outfit: string): AvatarConfig => {
    return avatar.applyConfig({ outfit });
  },
};
