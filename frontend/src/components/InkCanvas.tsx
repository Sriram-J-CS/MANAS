import React, { useEffect, useRef } from 'react';

interface InkCanvasProps {
  brand: string;
  textures: Array<[string, string, string]>;
}

export const InkCanvas: React.FC<InkCanvasProps> = ({ brand, textures }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const trail = document.createElement('canvas');
    const tctx = trail.getContext('2d');
    const tex = document.createElement('canvas');
    const xctx = tex.getContext('2d');
    if (!tctx || !xctx) return;

    let W = 0;
    let H = 0;
    let fs = 0;
    let dpr = 1;
    let animId: number;

    const mouse = {
      x: -999,
      y: -999,
      px: -999,
      py: -999,
      lastMove: 0,
      isTouch: false,
    };

    let texIdx = 0;
    let lastSwap = 0;

    // Preload mascot portrait images for dynamic texture blending
    const mascotImages: HTMLImageElement[] = [];
    const mascotUrls = [
      '/assets/mascot/mascot_happy.jpg',
      '/assets/mascot/mascot_neutral.jpg',
      '/assets/mascot/mascot_concerned.jpg',
    ];

    mascotUrls.forEach((url) => {
      const img = new Image();
      img.src = url;
      img.onload = () => mascotImages.push(img);
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

      // Giant wordmark: about 25vw, cropped by viewport edges
      fs = Math.min(W * 0.23, H * 0.38);
    };

    size();
    window.addEventListener('resize', size);

    const onPointerMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.lastMove = performance.now();
      if (e.pointerType === 'touch') {
        mouse.isTouch = true;
      }
    };

    window.addEventListener('pointermove', onPointerMove);

    const drawWord = (c: CanvasRenderingContext2D, fill: string | CanvasGradient | CanvasPattern) => {
      c.save();
      c.font = `800 ${fs}px 'Inter Tight', 'Helvetica Neue', Arial, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = fill;
      // letter spacing emulation for canvas
      c.fillText(brand, W / 2, H * 0.5);
      c.restore();
    };

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Paint initial trail blob in center to hint interactivity
    setTimeout(() => {
      tctx.fillStyle = '#000';
      tctx.beginPath();
      tctx.arc(W / 2, H / 2, 70, 0, Math.PI * 2);
      tctx.fill();
    }, 200);

    const frame = (now: number) => {
      // Respect prefers-reduced-motion
      if (prefersReducedMotion) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        drawWord(ctx, '#000000');
        return;
      }

      // 1. Fade old ink slowly so blobs melt away organically
      tctx.globalCompositeOperation = 'destination-out';
      tctx.fillStyle = 'rgba(0, 0, 0, 0.015)';
      tctx.fillRect(0, 0, W, H);
      tctx.globalCompositeOperation = 'source-over';

      // 2. Lissajous auto-animation if idle > 1.2s or on touch devices
      const isIdle = now - mouse.lastMove > 1200 || mouse.x < 0;
      let curX = mouse.x;
      let curY = mouse.y;

      if (isIdle) {
        const t = now * 0.0014;
        curX = W / 2 + Math.sin(t * 1.5) * (W * 0.32);
        curY = H / 2 + Math.sin(t * 2.2 + 0.5) * (H * 0.22);
      }

      const dx = curX - mouse.px;
      const dy = curY - mouse.py;
      const v = Math.min(Math.hypot(dx, dy), 80);

      if (mouse.px > -900 && (v > 1 || isIdle)) {
        const steps = Math.max(1, Math.ceil(v / 6));
        for (let i = 0; i < steps; i++) {
          const t = i / steps;
          const x = mouse.px + dx * t;
          const y = mouse.py + dy * t;
          const r = 38 + v * 1.5 + Math.random() * 26;

          tctx.fillStyle = '#000';
          tctx.beginPath();
          tctx.arc(x, y, r, 0, Math.PI * 2);
          tctx.fill();

          for (let k = 0; k < 2; k++) {
            tctx.beginPath();
            tctx.arc(
              x + (Math.random() - 0.5) * r * 2.2,
              y + (Math.random() - 0.5) * r * 2.2,
              r * (0.2 + Math.random() * 0.4),
              0,
              Math.PI * 2
            );
            tctx.fill();
          }
        }

        // Texture switches every ~1.5s
        if (now - lastSwap > 1500) {
          texIdx = (texIdx + 1) % textures.length;
          lastSwap = now;
        }
      }

      mouse.px = curX;
      mouse.py = curY;

      // 3. Render textured word, clipped to ink trail with destination-in
      xctx.globalCompositeOperation = 'source-over';
      xctx.clearRect(0, 0, W, H);

      const [c1, c2, c3] = textures[texIdx] || ['#5b2bff', '#b6a1ff', '#1a0a7a'];
      const g = xctx.createLinearGradient(0, H * 0.25, W, H * 0.75);
      g.addColorStop(0, c1);
      g.addColorStop(0.35, c2);
      g.addColorStop(0.7, c3);
      g.addColorStop(1, c1);

      drawWord(xctx, g);

      // Specular highlight line across the word
      xctx.save();
      const sweepX = (now * 0.15) % (W * 1.5) - W * 0.25;
      const specGrad = xctx.createLinearGradient(sweepX, 0, sweepX + 180, 0);
      specGrad.addColorStop(0, 'rgba(255,255,255,0)');
      specGrad.addColorStop(0.5, 'rgba(255,255,255,0.7)');
      specGrad.addColorStop(1, 'rgba(255,255,255,0)');
      xctx.globalCompositeOperation = 'source-atop';
      xctx.fillStyle = specGrad;
      xctx.fillRect(0, 0, W, H);
      xctx.restore();

      // Clip texture to the ink trail
      xctx.globalCompositeOperation = 'destination-in';
      xctx.drawImage(trail, 0, 0, W, H);

      // 4. Compose final canvas: white bg → black ink → black word → textured word on top
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // draw black ink blobs
      ctx.drawImage(trail, 0, 0, W, H);

      // draw base giant black wordmark
      drawWord(ctx, '#000000');

      // overlay the clipped glossy texture
      ctx.drawImage(tex, 0, 0, W, H);

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', size);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [brand, textures]);

  return (
    <canvas
      ref={canvasRef}
      id="stage"
      className="absolute inset-0 w-full h-full block cursor-crosshair"
      aria-label={`${brand} interactive ink canvas`}
    />
  );
};
