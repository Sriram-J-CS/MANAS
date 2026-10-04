export type MascotEmotion =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'concerned'
  | 'empathetic'
  | 'excited'
  | 'surprised'
  | 'confused'
  | 'thinking'
  | 'calm'
  | 'encouraging'
  | 'laughing';

export interface FacialPose {
  smile: number;
  frown: number;
  browUp: number;
  browInnerUp: number;
  eyeSquint: number;
  eyeWide: number;
  headTiltX: number; // Pitch (nod/up-down)
  headTiltY: number; // Yaw (turn left/right)
  headTiltZ: number; // Roll (sideways tilt)
  movementSpeed: number; // Relative breathing & floating rate
}

export const EMOTION_POSES: Record<MascotEmotion, FacialPose> = {
  neutral: {
    smile: 0.1,
    frown: 0,
    browUp: 0,
    browInnerUp: 0,
    eyeSquint: 0,
    eyeWide: 0,
    headTiltX: 0,
    headTiltY: 0,
    headTiltZ: 0,
    movementSpeed: 1.0,
  },
  happy: {
    smile: 0.85,
    frown: 0,
    browUp: 0.3,
    browInnerUp: 0.1,
    eyeSquint: 0.35,
    eyeWide: 0.1,
    headTiltX: -0.05,
    headTiltY: 0.05,
    headTiltZ: 0.08,
    movementSpeed: 1.25,
  },
  sad: {
    smile: 0,
    frown: 0.65,
    browUp: 0,
    browInnerUp: 0.6,
    eyeSquint: 0.2,
    eyeWide: 0,
    headTiltX: 0.12,
    headTiltY: -0.05,
    headTiltZ: -0.05,
    movementSpeed: 0.7,
  },
  concerned: {
    smile: 0,
    frown: 0.35,
    browUp: 0.1,
    browInnerUp: 0.75,
    eyeSquint: 0.25,
    eyeWide: 0.15,
    headTiltX: 0.05,
    headTiltY: 0.06,
    headTiltZ: 0.12,
    movementSpeed: 0.85,
  },
  empathetic: {
    smile: 0.3,
    frown: 0.1,
    browUp: 0.1,
    browInnerUp: 0.5,
    eyeSquint: 0.2,
    eyeWide: 0,
    headTiltX: 0.04,
    headTiltY: 0.04,
    headTiltZ: 0.14,
    movementSpeed: 0.9,
  },
  excited: {
    smile: 0.95,
    frown: 0,
    browUp: 0.6,
    browInnerUp: 0.2,
    eyeSquint: 0.1,
    eyeWide: 0.5,
    headTiltX: -0.1,
    headTiltY: 0.08,
    headTiltZ: 0.12,
    movementSpeed: 1.45,
  },
  surprised: {
    smile: 0.1,
    frown: 0,
    browUp: 0.9,
    browInnerUp: 0.8,
    eyeSquint: 0,
    eyeWide: 0.8,
    headTiltX: -0.14,
    headTiltY: 0,
    headTiltZ: 0.04,
    movementSpeed: 1.1,
  },
  confused: {
    smile: 0.05,
    frown: 0.2,
    browUp: 0.45,
    browInnerUp: 0.3,
    eyeSquint: 0.3,
    eyeWide: 0.1,
    headTiltX: -0.02,
    headTiltY: -0.1,
    headTiltZ: -0.18,
    movementSpeed: 0.9,
  },
  thinking: {
    smile: 0.15,
    frown: 0.05,
    browUp: 0.35,
    browInnerUp: 0.35,
    eyeSquint: 0.25,
    eyeWide: 0,
    headTiltX: -0.12,
    headTiltY: 0.14,
    headTiltZ: 0.15,
    movementSpeed: 0.8,
  },
  calm: {
    smile: 0.3,
    frown: 0,
    browUp: 0,
    browInnerUp: 0,
    eyeSquint: 0.2,
    eyeWide: 0,
    headTiltX: 0.02,
    headTiltY: 0,
    headTiltZ: 0.04,
    movementSpeed: 0.75,
  },
  encouraging: {
    smile: 0.7,
    frown: 0,
    browUp: 0.3,
    browInnerUp: 0.1,
    eyeSquint: 0.15,
    eyeWide: 0.1,
    headTiltX: 0.06,
    headTiltY: 0.04,
    headTiltZ: 0.06,
    movementSpeed: 1.1,
  },
  laughing: {
    smile: 1.0,
    frown: 0,
    browUp: 0.4,
    browInnerUp: 0,
    eyeSquint: 0.8,
    eyeWide: 0,
    headTiltX: -0.18,
    headTiltY: 0.1,
    headTiltZ: 0.1,
    movementSpeed: 1.6,
  },
};

/**
 * Maps raw backend emotion or sentiment words into a valid MascotEmotion
 */
export function normalizeEmotion(raw: string | undefined): MascotEmotion {
  if (!raw) return 'neutral';
  const lower = raw.toLowerCase().trim();
  if (lower.includes('happy') || lower.includes('joy') || lower.includes('relief')) return 'happy';
  if (lower.includes('sad') || lower.includes('grief') || lower.includes('cry')) return 'sad';
  if (lower.includes('concern') || lower.includes('worry') || lower.includes('fear') || lower.includes('anxiety')) return 'concerned';
  if (lower.includes('empath') || lower.includes('warm') || lower.includes('gentle') || lower.includes('caring')) return 'empathetic';
  if (lower.includes('excite') || lower.includes('celebrat') || lower.includes('proud')) return 'excited';
  if (lower.includes('surpris') || lower.includes('shock') || lower.includes('amaz')) return 'surprised';
  if (lower.includes('confus') || lower.includes('doubt')) return 'confused';
  if (lower.includes('think') || lower.includes('listen') || lower.includes('ponder')) return 'thinking';
  if (lower.includes('calm') || lower.includes('peace') || lower.includes('breath') || lower.includes('ground')) return 'calm';
  if (lower.includes('encourag') || lower.includes('motivat') || lower.includes('hope')) return 'encouraging';
  return 'neutral';
}
