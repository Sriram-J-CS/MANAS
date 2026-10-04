/**
 * uiEffects.ts - Central Configuration for Creative Studio Visual Effects
 * ────────────────────────────────────────────────────────────────────────
 * Set `FX_ENABLED = false` to switch off all visual motion effects site-wide.
 * Set `HERO_FX_ENABLED = false` to switch off the hero WebGL cursor effect.
 * Set `AUTO_MATERIAL = false` to disable automatic 3.5s material cycling.
 * All flags are accessible and toggleable at runtime via window.
 */

export const FX_ENABLED = true;
export const HERO_FX_ENABLED = true;
export const AUTO_MATERIAL = true;

export interface UIEffectsConfig {
  /** Master switch to turn off all additional visual layer effects */
  enabled: boolean;
  /** Hero WebGL liquid ink trail and 3D inflated balloon wordmark effect */
  heroFx: boolean;
  /** Automatically cycle materials every 3.5s while ink is active */
  autoMaterial: boolean;
  /** Short, calm page-load reveal animation (< 1.5s) */
  pageIntro: boolean;
  /** Floating soft 3D-style organic shapes that react gently to mouse */
  floatingShapes: boolean;
}

export const UI_EFFECTS: UIEffectsConfig = {
  enabled: FX_ENABLED,
  heroFx: HERO_FX_ENABLED,
  autoMaterial: AUTO_MATERIAL,
  pageIntro: true,
  floatingShapes: true,
};

if (typeof window !== 'undefined') {
  (window as any).__MANAS_UI_EFFECTS__ = UI_EFFECTS;
  (window as any).FX_ENABLED = FX_ENABLED;
  (window as any).HERO_FX_ENABLED = HERO_FX_ENABLED;
  (window as any).AUTO_MATERIAL = AUTO_MATERIAL;
}
