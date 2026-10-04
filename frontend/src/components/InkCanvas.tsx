import React, { useEffect, useRef, useState, useCallback } from 'react';

interface InkCanvasProps {
  brand: string;
}

interface StrokePoint {
  x: number;
  y: number;
  radius: number;
  life: number; // 1.0 down to 0.0
  decay: number;
}

interface SatelliteDroplet {
  x: number;
  y: number;
  radius: number;
  life: number;
  decay: number;
}

const TEXTURES = [
  { id: 'foil_violet', label: 'PURPLE FOIL', url: '/assets/textures/foil_violet.jpg' },
  { id: 'puffed_cushion', label: 'PUFFED CUSHION', url: '/assets/textures/puffed_cushion.jpg' },
  { id: 'soap_foam', label: 'SOAP FOAM', url: '/assets/textures/soap_foam.jpg' },
  { id: 'foil_pink', label: 'PINK FOIL', url: '/assets/textures/foil_pink.jpg' },
];

export const InkCanvas: React.FC<InkCanvasProps> = ({ brand }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTextureIndex, setActiveTextureIndex] = useState(0);

  // Switch texture directly via UI button or click
  const handleSwitchTexture = useCallback((idx: number) => {
    setActiveTextureIndex(idx % TEXTURES.length);
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    // Off-screen canvas for rendering crisp black liquid ink trail
    const trail = document.createElement('canvas');
    const tctx = trail.getContext('2d');

    // Off-screen canvas for 3D tactile material
    const tex = document.createElement('canvas');
    const xctx = tex.getContext('2d');
    if (!tctx || !xctx) return;

    let W = 0;
    let H = 0;
    let fs = 0;
    let dpr = 1;
    let animId: number;

    // Active strokes & satellite droplets
    const points: StrokePoint[] = [];
    const droplets: SatelliteDroplet[] = [];

    // Pointer state with smooth velocity easing
    const pointer = {
      x: -999,
      y: -999,
      prevX: -999,
      prevY: -999,
      easedX: -999,
      easedY: -999,
      isDown: false,
      lastMoveTime: 0,
    };

    // Preload textures
    const loadedImages: (HTMLImageElement | null)[] = [null, null, null, null];
    TEXTURES.forEach((texMeta, i) => {
      const img = new Image();
      img.src = texMeta.url;
      img.onload = () => {
        loadedImages[i] = img;
      };
    });

    const size = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;

      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.style.width = `${W}px`;
      cv.style.height = `${H}px`;

      trail.width = W * dpr;
      trail.height = H * dpr;

      tex.width = W * dpr;
      tex.height = H * dpr;

      ctx.scale(dpr, dpr);
      tctx.scale(dpr, dpr);
      xctx.scale(dpr, dpr);

      // Giant wordmark: ~23vw, centered in viewport
      fs = Math.min(W * 0.23, H * 0.38);
    };

    size();
    window.addEventListener('resize', size);

    // Add ink point with speed-dependent dynamic width and subtle satellite droplets
    const addInkPoint = (x: number, y: number, px: number, py: number) => {
      const dist = Math.hypot(x - px, y - py);
      if (dist < 1.0) return;

      const speedFactor = Math.min(dist / 35, 1.0);
      const baseRadius = Math.max(50, Math.min(W * 0.062, 95));
      // Taper at higher velocities, pool when slow
      const radius = baseRadius * (1.1 - speedFactor * 0.35);

      // Interpolate intermediate steps for silky unbroken ribbon stroke
      const steps = Math.max(1, Math.ceil(dist / 6));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const ix = px + (x - px) * t;
        const iy = py + (y - py) * t;

        points.push({
          x: ix,
          y: iy,
          radius,
          life: 1.0,
          decay: 0.0075, // Smooth ~2.2s dissipation
        });
      }

      // Organic satellite splatter droplets occasionally on quick flicks
      if (dist > 18 && Math.random() < 0.28) {
        const angle = Math.atan2(y - py, x - px) + (Math.random() - 0.5) * 1.6;
        const offset = radius * (1.2 + Math.random() * 0.6);
        droplets.push({
          x: x + Math.cos(angle) * offset,
          y: y + Math.sin(angle) * offset,
          radius: Math.max(4, radius * (0.12 + Math.random() * 0.15)),
          life: 1.0,
          decay: 0.008,
        });
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.lastMoveTime = performance.now();

      if (pointer.easedX < -900) {
        pointer.easedX = pointer.x;
        pointer.easedY = pointer.y;
        pointer.prevX = pointer.x;
        pointer.prevY = pointer.y;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      pointer.isDown = true;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.prevX = pointer.x;
      pointer.prevY = pointer.y;
      pointer.easedX = pointer.x;
      pointer.easedY = pointer.y;
      pointer.lastMoveTime = performance.now();
      addInkPoint(pointer.x, pointer.y, pointer.x, pointer.y);
    };

    const onPointerUp = () => {
      pointer.isDown = false;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });

    const drawWord = (c: CanvasRenderingContext2D, fill: string | CanvasGradient | CanvasPattern) => {
      c.save();
      c.font = `900 ${fs}px 'Inter Tight', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = fill;
      c.fillText(brand, W / 2, H * 0.5);
      c.restore();
    };

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const frame = (now: number) => {
      if (document.hidden) {
        animId = requestAnimationFrame(frame);
        return;
      }

      if (prefersReducedMotion) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        drawWord(ctx, '#000000');
        return;
      }

      // 1. Process pointer movement smoothly with easing
      const timeSinceMove = now - pointer.lastMoveTime;
      const isActivelyMoving = timeSinceMove < 350 && pointer.x > 0;

      if (isActivelyMoving) {
        // Smooth easing factor
        pointer.easedX += (pointer.x - pointer.easedX) * 0.32;
        pointer.easedY += (pointer.y - pointer.easedY) * 0.32;

        if (pointer.prevX > -900) {
          addInkPoint(pointer.easedX, pointer.easedY, pointer.prevX, pointer.prevY);
        }

        pointer.prevX = pointer.easedX;
        pointer.prevY = pointer.easedY;
      } else {
        pointer.prevX = -999;
        pointer.prevY = -999;
      }

      // 2. Render crisp jet-black liquid ink trail with smooth shrinking falloff
      tctx.clearRect(0, 0, W, H);

      // Draw points with shrinking radius as life dissipates
      if (points.length > 0 || droplets.length > 0) {
        tctx.save();
        tctx.fillStyle = '#000000';
        tctx.strokeStyle = '#000000';
        tctx.lineCap = 'round';
        tctx.lineJoin = 'round';

        // Draw main ink ribbon points
        for (let i = points.length - 1; i >= 0; i--) {
          const pt = points[i];
          pt.life -= pt.decay;

          if (pt.life <= 0) {
            points.splice(i, 1);
            continue;
          }

          // Smooth dissipation curve: stays full width for first 60% of life, then smoothly shrinks to zero
          const shrinkFactor = pt.life > 0.4 ? 1.0 : Math.pow(pt.life / 0.4, 0.65);
          const r = pt.radius * shrinkFactor;

          if (r > 0.5) {
            tctx.beginPath();
            tctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
            tctx.fill();
          }
        }

        // Draw satellite splatter droplets
        for (let i = droplets.length - 1; i >= 0; i--) {
          const drop = droplets[i];
          drop.life -= drop.decay;

          if (drop.life <= 0) {
            droplets.splice(i, 1);
            continue;
          }

          const shrinkFactor = drop.life > 0.4 ? 1.0 : Math.pow(drop.life / 0.4, 0.65);
          const r = drop.radius * shrinkFactor;

          if (r > 0.5) {
            tctx.beginPath();
            tctx.arc(drop.x, drop.y, r, 0, Math.PI * 2);
            tctx.fill();
          }
        }

        tctx.restore();
      }

      // 3. Render 3D tactile material clipped inside the letters where the ink trail passes
      xctx.globalCompositeOperation = 'source-over';
      xctx.clearRect(0, 0, W, H);

      const activeImg = loadedImages[activeTextureIndex];
      if (activeImg && activeImg.complete && activeImg.naturalWidth > 0) {
        // Draw 3D texture covering canvas preserving aspect ratio
        const imgRatio = activeImg.naturalWidth / activeImg.naturalHeight;
        const canvasRatio = W / H;
        let drawW = W;
        let drawH = H;
        let offsetX = 0;
        let offsetY = 0;

        if (canvasRatio > imgRatio) {
          drawW = W;
          drawH = W / imgRatio;
          offsetY = (H - drawH) / 2;
        } else {
          drawH = H;
          drawW = H * imgRatio;
          offsetX = (W - drawW) / 2;
        }

        xctx.drawImage(activeImg, offsetX, offsetY, drawW, drawH);
      } else {
        // High-gloss metallic purple fallback
        const g = xctx.createLinearGradient(0, H * 0.2, W, H * 0.8);
        g.addColorStop(0, '#581c87');
        g.addColorStop(0.3, '#9333ea');
        g.addColorStop(0.5, '#ffffff');
        g.addColorStop(0.7, '#7e22ce');
        g.addColorStop(1, '#3b0764');
        xctx.fillStyle = g;
        xctx.fillRect(0, 0, W, H);
      }

      // Clip 1: Strictly constrain 3D texture inside the letters
      xctx.globalCompositeOperation = 'destination-in';
      drawWord(xctx, '#000000');

      // Clip 2: Strictly constrain 3D texture to the active ink trail
      xctx.globalCompositeOperation = 'destination-in';
      xctx.drawImage(trail, 0, 0, W, H);

      // 4. Final Canvas Composition:
      // A. Pure white background (#ffffff)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // B. Solid black ink trail on white background
      ctx.drawImage(trail, 0, 0, W, H);

      // C. Base deep solid black wordmark for un-inked areas
      drawWord(ctx, '#000000');

      // D. Revealed 3D tactile material inside the inked letters!
      ctx.drawImage(tex, 0, 0, W, H);

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', size);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [brand, activeTextureIndex]);

  return (
    <div className="absolute inset-0 w-full h-full">
      <canvas
        ref={canvasRef}
        id="stage"
        className="w-full h-full block cursor-crosshair select-none touch-none"
        aria-label={`${brand} interactive fluid ink and 3D tactile material canvas`}
      />

      {/* Material Selector Pill Tabs at top right (matching screenshots) */}
      <div className="absolute top-[80px] right-[22px] z-30 pointer-events-auto flex items-center gap-1.5 bg-black/5 hover:bg-black/10 backdrop-blur-md p-1.5 rounded-full border border-black/10 shadow-sm transition-all">
        <span className="text-[10px] font-mono uppercase tracking-wider text-black/50 font-bold px-2 hidden md:inline">
          3D MATERIAL:
        </span>
        {TEXTURES.map((tex, idx) => (
          <button
            key={tex.id}
            onClick={() => handleSwitchTexture(idx)}
            className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTextureIndex === idx
                ? 'bg-black text-white shadow-md scale-[1.03]'
                : 'text-black/70 hover:text-black hover:bg-black/5'
            }`}
          >
            {tex.label}
          </button>
        ))}
      </div>
    </div>
  );
};
