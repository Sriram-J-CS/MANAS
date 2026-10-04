/**
 * BitmojiPortrait
 * Canvas-rendered 2D Bitmoji-style avatar portrait.
 * Exactly matches Sriram's Snapchat Bitmoji look:
 *   Boy  – dark spiky hair, pink hoodie, grey jeans, white sneakers
 *   Girl – dark+red ombre wavy hair (half-up bun), black top, white skirt, black hi-tops
 *
 * Used as the loading placeholder AND the offline/error fallback in Avatar3DStage.
 * Zero dependencies – pure canvas 2D.
 */

import React, { useEffect, useRef } from 'react';

export type BitmojiGender = 'boy' | 'girl';

interface BitmojiPortraitProps {
  gender?: BitmojiGender;
  size?: number;
  animate?: boolean;
  className?: string;
}

// ── Palette ──────────────────────────────────────────────────────────────────
const PALETTE = {
  boy: {
    skin: '#f0b882',
    skinShadow: '#d4915a',
    hair: '#1e1410',
    hairHighlight: '#3d2d1e',
    hoodie: '#d4849e',
    hoodieShade: '#b5607a',
    hoodieLight: '#e8b4c4',
    jeans: '#3d3d3d',
    jeansShade: '#252525',
    shoes: '#fafafa',
    shoeSole: '#dddddd',
    eye: '#3d2010',
    eyeWhite: '#f8f8f8',
    brow: '#1e1410',
    lip: '#c47a5a',
    outline: '#1a0a00',
    blush: 'rgba(220,120,100,0.22)',
  },
  girl: {
    skin: '#f5cba7',
    skinShadow: '#e0a070',
    hair: '#1a0f0f',
    hairHighlight: '#5a1a1a',
    hairOmbre: '#7b2020',
    hoodie: '#111111',
    hoodieShade: '#050505',
    hoodieLight: '#2a2a2a',
    jeans: '#f0f0f0',       // white skirt
    jeansShade: '#d8d8d8',
    shoes: '#111111',       // black hi-tops
    shoeSole: '#f0f0f0',
    eye: '#2a1008',
    eyeWhite: '#f8f8f8',
    brow: '#1a0f0f',
    lip: '#c0604a',
    outline: '#1a0800',
    blush: 'rgba(220,100,90,0.20)',
  },
} as const;

// ── Drawing helpers ──────────────────────────────────────────────────────────
function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  rx: number, ry: number,
  fill?: string, stroke?: string, lw = 1.5
) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
  fill?: string, stroke?: string, lw = 1.5
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

// ── Main Draw ────────────────────────────────────────────────────────────────
function drawBitmoji(
  ctx: CanvasRenderingContext2D,
  gender: BitmojiGender,
  W: number,
  H: number,
  breathT: number   // 0‥1 idle breathing offset
) {
  const p = PALETTE[gender];
  const cx = W / 2;
  const scale = W / 200;

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.scale(scale, scale);
  const w = W / scale;
  const h = H / scale;
  const c = w / 2;
  const breathY = Math.sin(breathT * Math.PI * 2) * 0.5;

  // ── Shadow under feet ────────────────────────────────────────────────────
  const shadowGrad = ctx.createRadialGradient(c, h - 6, 4, c, h - 6, 28);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0.22)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(c, h - 6, 28, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Shoes ────────────────────────────────────────────────────────────────
  const sy = h - 14;
  // Left shoe
  roundRect(ctx, c - 24, sy, 20, 10, 4, p.shoes, p.outline, 1.2);
  // Sole stripe
  ctx.fillStyle = p.shoeSole;
  roundRect(ctx, c - 24, sy + 7, 20, 3, [0, 0, 4, 4] as unknown as number, p.shoeSole);
  // Right shoe
  roundRect(ctx, c + 4, sy, 20, 10, 4, p.shoes, p.outline, 1.2);
  ctx.fillStyle = p.shoeSole;
  roundRect(ctx, c + 4, sy + 7, 20, 3, [0, 0, 4, 4] as unknown as number, p.shoeSole);

  // Girl: black shoe laces
  if (gender === 'girl') {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    for (let lx = c - 21; lx < c - 6; lx += 4) {
      ctx.beginPath(); ctx.moveTo(lx, sy + 4); ctx.lineTo(lx + 2, sy + 6); ctx.stroke();
    }
    for (let lx = c + 7; lx < c + 22; lx += 4) {
      ctx.beginPath(); ctx.moveTo(lx, sy + 4); ctx.lineTo(lx + 2, sy + 6); ctx.stroke();
    }
  }

  // ── Legs (boy: jeans / girl: bare legs + skirt) ─────────────────────────
  const legTop = h - 46;

  if (gender === 'boy') {
    // Jeans
    roundRect(ctx, c - 22, legTop, 18, 34, 3, p.jeans, p.outline, 1.2);
    roundRect(ctx, c + 4, legTop, 18, 34, 3, p.jeans, p.outline, 1.2);
    // Pocket stitch
    ctx.strokeStyle = p.jeansShade;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(c - 12, legTop + 6); ctx.lineTo(c - 6, legTop + 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c + 14, legTop + 6); ctx.lineTo(c + 20, legTop + 6); ctx.stroke();
  } else {
    // Bare legs
    roundRect(ctx, c - 20, legTop + 12, 15, 22, 3, p.skin, p.outline, 1.1);
    roundRect(ctx, c + 5, legTop + 12, 15, 22, 3, p.skin, p.outline, 1.1);
    // White pleated skirt
    ctx.beginPath();
    ctx.moveTo(c - 26, legTop);
    ctx.lineTo(c + 26, legTop);
    ctx.lineTo(c + 30, legTop + 18);
    ctx.lineTo(c - 30, legTop + 18);
    ctx.closePath();
    ctx.fillStyle = p.jeans;
    ctx.fill();
    ctx.strokeStyle = p.outline;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Pleats
    ctx.strokeStyle = p.jeansShade;
    ctx.lineWidth = 0.7;
    for (let px = c - 22; px < c + 26; px += 8) {
      ctx.beginPath();
      ctx.moveTo(px, legTop);
      ctx.lineTo(px - 2, legTop + 18);
      ctx.stroke();
    }
  }

  // ── Torso / Hoodie / Top ─────────────────────────────────────────────────
  const torsoY = legTop - 48 + breathY;
  const torsoW = gender === 'boy' ? 54 : 46;
  // Body base
  roundRect(ctx, c - torsoW / 2, torsoY, torsoW, 52, 8, p.hoodie, p.outline, 1.4);

  // Hoodie pocket (boy) / ribbed texture (girl)
  if (gender === 'boy') {
    // Front pocket
    roundRect(ctx, c - 14, torsoY + 28, 28, 16, 4, p.hoodieShade, p.outline, 1);
    // Drawstrings
    ctx.strokeStyle = p.hoodieShade;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c - 5, torsoY + 6);
    ctx.lineTo(c - 8, torsoY + 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c + 5, torsoY + 6);
    ctx.lineTo(c + 8, torsoY + 18);
    ctx.stroke();
    // Hood seam
    ctx.strokeStyle = p.hoodieLight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c, torsoY + 2, 12, Math.PI, 0, false);
    ctx.stroke();
  } else {
    // V-neck line
    ctx.strokeStyle = p.hoodieLight;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(c, torsoY + 5);
    ctx.lineTo(c - 6, torsoY + 15);
    ctx.moveTo(c, torsoY + 5);
    ctx.lineTo(c + 6, torsoY + 15);
    ctx.stroke();
    // Ribbed lines at hem and cuffs
    ctx.lineWidth = 0.6;
    for (let rl = 0; rl < 4; rl++) {
      const ry = torsoY + 44 + rl * 1.5;
      ctx.beginPath(); ctx.moveTo(c - torsoW / 2 + 3, ry); ctx.lineTo(c + torsoW / 2 - 3, ry); ctx.stroke();
    }
  }

  // ── Arms ─────────────────────────────────────────────────────────────────
  // Left arm
  roundRect(ctx, c - torsoW / 2 - 12, torsoY + 6, 13, 36, 6, p.hoodie, p.outline, 1.2);
  // Right arm
  roundRect(ctx, c + torsoW / 2, torsoY + 6, 13, 36, 6, p.hoodie, p.outline, 1.2);

  // Hands (clasped in front, centred)
  const handY = torsoY + 44 + breathY;
  // Left hand
  ellipse(ctx, c - 8, handY + 8, 11, 8, p.skin, p.outline, 1.1);
  // Right hand overlapping
  ellipse(ctx, c + 8, handY + 8, 11, 8, p.skin, p.outline, 1.1);
  // Finger creases
  ctx.strokeStyle = p.skinShadow;
  ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(c - 14, handY + 6); ctx.lineTo(c - 16, handY + 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(c + 14, handY + 6); ctx.lineTo(c + 16, handY + 10); ctx.stroke();

  // ── Neck ─────────────────────────────────────────────────────────────────
  const neckY = torsoY - 10;
  roundRect(ctx, c - 8, neckY, 16, 14, 4, p.skin, p.outline, 1.1);

  // ── Head ─────────────────────────────────────────────────────────────────
  const headCY = neckY - 28 + breathY;
  const headRX = gender === 'boy' ? 32 : 30;
  const headRY = 34;

  // Head base
  ellipse(ctx, c, headCY, headRX, headRY, p.skin, p.outline, 1.6);

  // Ears
  ellipse(ctx, c - headRX + 3, headCY + 4, 7, 9, p.skin, p.outline, 1.2);
  ellipse(ctx, c + headRX - 3, headCY + 4, 7, 9, p.skin, p.outline, 1.2);
  // Inner ear
  ellipse(ctx, c - headRX + 5, headCY + 4, 4, 5, p.skinShadow);
  ellipse(ctx, c + headRX - 5, headCY + 4, 4, 5, p.skinShadow);

  // Jaw shadow
  ctx.save();
  const jawShadow = ctx.createLinearGradient(c, headCY + 8, c, headCY + headRY + 2);
  jawShadow.addColorStop(0, 'rgba(0,0,0,0)');
  jawShadow.addColorStop(1, 'rgba(0,0,0,0.10)');
  ctx.fillStyle = jawShadow;
  ctx.beginPath();
  ctx.ellipse(c, headCY, headRX, headRY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── Blush ────────────────────────────────────────────────────────────────
  ellipse(ctx, c - 18, headCY + 10, 10, 6, p.blush);
  ellipse(ctx, c + 18, headCY + 10, 10, 6, p.blush);

  // ── Eyebrows ──────────────────────────────────────────────────────────────
  const browY = headCY - 8;
  ctx.strokeStyle = p.brow;
  ctx.lineWidth = gender === 'boy' ? 2.5 : 2;
  ctx.lineCap = 'round';
  // Left brow (slight arch)
  ctx.beginPath();
  ctx.moveTo(c - 22, browY + 1);
  ctx.quadraticCurveTo(c - 14, browY - 3, c - 6, browY + 1);
  ctx.stroke();
  // Right brow
  ctx.beginPath();
  ctx.moveTo(c + 22, browY + 1);
  ctx.quadraticCurveTo(c + 14, browY - 3, c + 6, browY + 1);
  ctx.stroke();

  // ── Eyes ─────────────────────────────────────────────────────────────────
  const eyeY = headCY + 2;
  const eyeRX = 9;
  const eyeRY = gender === 'girl' ? 8.5 : 7.5; // girls: slightly bigger

  // Whites
  ellipse(ctx, c - 14, eyeY, eyeRX, eyeRY, p.eyeWhite, p.outline, 1);
  ellipse(ctx, c + 14, eyeY, eyeRX, eyeRY, p.eyeWhite, p.outline, 1);

  // Iris
  ellipse(ctx, c - 14, eyeY + 1, eyeRX * 0.62, eyeRY * 0.62, p.eye);
  ellipse(ctx, c + 14, eyeY + 1, eyeRX * 0.62, eyeRY * 0.62, p.eye);

  // Pupil
  ellipse(ctx, c - 14, eyeY + 1, eyeRX * 0.28, eyeRY * 0.28, '#050505');
  ellipse(ctx, c + 14, eyeY + 1, eyeRX * 0.28, eyeRY * 0.28, '#050505');

  // Specular catch light
  ellipse(ctx, c - 12, eyeY - 2, 2, 2, '#ffffff');
  ellipse(ctx, c + 16, eyeY - 2, 2, 2, '#ffffff');

  // Lashes (girl: longer upper lash line)
  if (gender === 'girl') {
    ctx.strokeStyle = p.outline;
    ctx.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(c - 14 + i * 5, eyeY - eyeRY + 1);
      ctx.lineTo(c - 14 + i * 6, eyeY - eyeRY - 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c + 14 + i * 5, eyeY - eyeRY + 1);
      ctx.lineTo(c + 14 + i * 6, eyeY - eyeRY - 3);
      ctx.stroke();
    }
  }

  // ── Nose ─────────────────────────────────────────────────────────────────
  const noseY = headCY + 12;
  ctx.strokeStyle = p.skinShadow;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(c - 5, noseY - 2);
  ctx.quadraticCurveTo(c - 6, noseY + 3, c - 3, noseY + 4);
  ctx.moveTo(c + 5, noseY - 2);
  ctx.quadraticCurveTo(c + 6, noseY + 3, c + 3, noseY + 4);
  ctx.stroke();

  // ── Mouth ────────────────────────────────────────────────────────────────
  const mouthY = headCY + 20;
  // Smile
  ctx.strokeStyle = p.lip;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(c - 10, mouthY);
  ctx.quadraticCurveTo(c, mouthY + 8, c + 10, mouthY);
  ctx.stroke();
  // Upper lip line
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#c47050';
  ctx.beginPath();
  ctx.moveTo(c - 8, mouthY - 1);
  ctx.lineTo(c, mouthY - 3);
  ctx.lineTo(c + 8, mouthY - 1);
  ctx.stroke();

  // ── Hair ─────────────────────────────────────────────────────────────────
  if (gender === 'boy') {
    // Dark spiky swept hair
    ctx.fillStyle = p.hair;
    ctx.strokeStyle = p.outline;
    ctx.lineWidth = 1.4;

    // Main hair cap
    ctx.beginPath();
    ctx.ellipse(c, headCY - 20, headRX - 2, 22, 0, Math.PI, 0, true);
    ctx.fill();
    ctx.stroke();

    // Side tapers
    ctx.beginPath();
    ctx.moveTo(c - headRX + 3, headCY - 2);
    ctx.lineTo(c - headRX - 2, headCY + 8);
    ctx.lineTo(c - headRX + 8, headCY - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(c + headRX - 3, headCY - 2);
    ctx.lineTo(c + headRX + 2, headCY + 8);
    ctx.lineTo(c + headRX - 8, headCY - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Spiky front fringe (5 spikes)
    const spikes = [-16, -8, 0, 8, 16];
    spikes.forEach((sx, si) => {
      const tipX = c + sx + (si % 2 === 0 ? -2 : 2);
      const tipY = headCY - headRY - 6 - (Math.abs(sx) < 5 ? 8 : 3) + (si === 2 ? -4 : 0);
      ctx.beginPath();
      ctx.moveTo(c + sx - 8, headCY - headRY + 4);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(c + sx + 8, headCY - headRY + 4);
      ctx.closePath();
      ctx.fillStyle = si % 2 === 0 ? p.hair : p.hairHighlight;
      ctx.fill();
      ctx.strokeStyle = p.outline;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Hair highlight streak
    ctx.strokeStyle = p.hairHighlight;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(c - 10, headCY - 38);
    ctx.quadraticCurveTo(c + 6, headCY - 30, c + 14, headCY - 20);
    ctx.stroke();

  } else {
    // Girl: dark wavy hair with red ombre, half-up bun on top

    // Back layer of long flowing hair (behind body)
    ctx.fillStyle = p.hair;
    ctx.strokeStyle = p.outline;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(c - headRX - 4, headCY - 14);
    ctx.bezierCurveTo(c - headRX - 16, headCY + 20, c - headRX - 18, torsoY + 30, c - headRX - 10, torsoY + 60);
    ctx.lineTo(c - headRX + 4, torsoY + 60);
    ctx.bezierCurveTo(c - headRX - 2, torsoY + 20, c - headRX + 4, headCY + 30, c - headRX + 2, headCY + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right side long hair
    ctx.beginPath();
    ctx.moveTo(c + headRX + 4, headCY - 14);
    ctx.bezierCurveTo(c + headRX + 16, headCY + 20, c + headRX + 18, torsoY + 30, c + headRX + 10, torsoY + 60);
    ctx.lineTo(c + headRX - 4, torsoY + 60);
    ctx.bezierCurveTo(c + headRX + 2, torsoY + 20, c + headRX - 4, headCY + 30, c + headRX - 2, headCY + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ombre red lower half of flowing hair
    ctx.fillStyle = (p as typeof PALETTE['girl']).hairOmbre ?? '#7b2020';
    ctx.beginPath();
    ctx.moveTo(c - headRX - 8, torsoY + 10);
    ctx.bezierCurveTo(c - headRX - 14, torsoY + 30, c - headRX - 10, torsoY + 55, c - headRX - 8, torsoY + 60);
    ctx.lineTo(c - headRX + 2, torsoY + 60);
    ctx.bezierCurveTo(c - headRX, torsoY + 40, c - headRX + 2, torsoY + 20, c - headRX + 2, torsoY + 10);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(c + headRX + 8, torsoY + 10);
    ctx.bezierCurveTo(c + headRX + 14, torsoY + 30, c + headRX + 10, torsoY + 55, c + headRX + 8, torsoY + 60);
    ctx.lineTo(c + headRX - 2, torsoY + 60);
    ctx.bezierCurveTo(c + headRX, torsoY + 40, c + headRX - 2, torsoY + 20, c + headRX - 2, torsoY + 10);
    ctx.closePath();
    ctx.fill();

    // Hair cap (top of head)
    ctx.fillStyle = p.hair;
    ctx.strokeStyle = p.outline;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(c, headCY - 18, headRX + 1, 22, 0, Math.PI, 0, true);
    ctx.fill();
    ctx.stroke();

    // Half-up bun on top centre
    ellipse(ctx, c + 4, headCY - 42, 13, 10, p.hair, p.outline, 1.2);
    // Bun swirl
    ctx.strokeStyle = p.hairHighlight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c + 4, headCY - 42, 5, 0.2, Math.PI * 1.5, false);
    ctx.stroke();

    // Hair highlight
    ctx.strokeStyle = p.hairHighlight;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(c - 8, headCY - 38);
    ctx.quadraticCurveTo(c + 10, headCY - 28, c + 18, headCY - 16);
    ctx.stroke();
  }

  ctx.restore();
}

// ── React Component ──────────────────────────────────────────────────────────
export const BitmojiPortrait: React.FC<BitmojiPortraitProps> = ({
  gender = 'boy',
  size = 300,
  animate = true,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;

    if (animate) {
      const tick = (ts: number) => {
        if (!startRef.current) startRef.current = ts;
        const t = ((ts - startRef.current) / 3500) % 1;
        drawBitmoji(ctx, gender, size, size, t);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      drawBitmoji(ctx, gender, size, size, 0);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [gender, size, animate]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: 'crisp-edges' }}
      aria-label={`${gender === 'boy' ? 'MANAS Boy' : 'MANAS Girl'} Bitmoji Avatar`}
    />
  );
};

export default BitmojiPortrait;
