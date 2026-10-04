/**
 * uiEffects.ts - Central Configuration for Creative Studio Visual Effects
 * ────────────────────────────────────────────────────────────────────────
 * Set `enabled: false` to toggle off all creative studio UI effects site-wide.
 * Can also be toggled at runtime via `window.__MANAS_UI_EFFECTS__.enabled = false`.
 */

export interface UIEffectsConfig {
  /** Master switch to turn off all additional visual layer effects */
  enabled: boolean;
  /** Short, calm page-load reveal animation (< 1.2s) */
  pageIntro: boolean;
  /** Floating soft 3D-style organic shapes that react gently to mouse */
  floatingShapes: boolean;
}

export const UI_EFFECTS: UIEffectsConfig = {
  enabled: true,
  pageIntro: true,
  floatingShapes: true,
};

if (typeof window !== 'undefined') {
  (window as any).__MANAS_UI_EFFECTS__ = UI_EFFECTS;
}
