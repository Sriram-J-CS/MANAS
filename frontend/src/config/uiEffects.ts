/**
 * uiEffects.ts - Central Configuration for Creative Studio Visual Effects
 * ────────────────────────────────────────────────────────────────────────
 * Set `HERO_FX_ENABLED = false` to switch off the hero WebGL cursor effect instantly.
 * Can also be toggled at runtime via `window.HERO_FX_ENABLED = false`.
 */

export const HERO_FX_ENABLED = true;

export interface UIEffectsConfig {
  /** Master switch to turn off all additional visual layer effects */
  enabled: boolean;
  /** Hero WebGL liquid ink trail and 3D inflated balloon wordmark effect */
  heroFx: boolean;
  /** Short, calm page-load reveal animation (< 1.2s) */
  pageIntro: boolean;
  /** Floating soft 3D-style organic shapes that react gently to mouse */
  floatingShapes: boolean;
}

export const UI_EFFECTS: UIEffectsConfig = {
  enabled: true,
  heroFx: HERO_FX_ENABLED,
  pageIntro: true,
  floatingShapes: true,
};

if (typeof window !== 'undefined') {
  (window as any).__MANAS_UI_EFFECTS__ = UI_EFFECTS;
  (window as any).HERO_FX_ENABLED = HERO_FX_ENABLED;
}
