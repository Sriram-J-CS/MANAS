import React, { useEffect, useRef } from 'react';

interface InkCanvasProps {
  brand: string;
  textures?: Array<[string, string, string]>;
}

export const InkCanvas: React.FC<InkCanvasProps> = ({ brand }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    // Off-screen canvas for smooth black liquid trail
    const trail = document.createElement('canvas');
    const tctx = trail.getContext('2d');

    // Off-screen canvas for 3D metallic foil balloon texture
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
      easedX: -999,
      easedY: -999,
      px: -999,
      py: -999,
      lastMove: 0,
      isTouch: false,
    };

    let texIdx = 0;
    let lastSwap = 0;

    // Load authentic 3D metallic foil balloon textures (matching reference image)
    const foilTextures: HTMLImageElement[] = [];
    const textureUrls = [
      '/assets/textures/foil_pink.jpg',
      '/assets/textures/foil_violet.jpg',
    ];

    textureUrls.forEach((url) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        foilTextures.push(img);
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

      // Giant wordmark: about 23vw, centered in viewport
      fs = Math.min(W * 0.23, H * 0.38);

      // If initial mouse is unset, place at starting orbit point
      if (mouse.px < -900) {
        const radiusX = Math.min(W * 0.28, 420);
        mouse.px = W / 2 + radiusX;
        mouse.py = H / 2;
        mouse.easedX = mouse.px;
        mouse.easedY = mouse.py;
      }
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

    window.addEventListener('pointermove', onPointerMove, { passive: true });

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
      // Pause rendering when tab is hidden to save GPU & battery
      if (document.hidden) {
        animId = requestAnimationFrame(frame);
        return;
      }

      // Respect prefers-reduced-motion
      if (prefersReducedMotion) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        drawWord(ctx, '#000000');
        return;
      }

      // 1. Gently fade previous trail so it melts away like real smooth ink
      tctx.globalCompositeOperation = 'destination-out';
      tctx.fillStyle = 'rgba(0, 0, 0, 0.034)';
      tctx.fillRect(0, 0, W, H);
      tctx.globalCompositeOperation = 'source-over';

      // 2. Determine position: Smooth circular/oval orbit when idle ("simply round that effects")
      const isIdle = now - mouse.lastMove > 900 || mouse.x < 0;

      let curX: number;
      let curY: number;

      if (isIdle) {
        // Orbit smoothly in a clean round loop through the letters (as in reference image 2)
        const t = now * 0.0011; // calm, graceful speed
        const orbitRadiusX = Math.min(W * 0.28, 400);
        const orbitRadiusY = Math.min(H * 0.24, 250);
        curX = W / 2 + Math.cos(t) * orbitRadiusX;
        curY = H / 2 + Math.sin(t) * orbitRadiusY;
        mouse.easedX = curX;
        mouse.easedY = curY;
      } else {
        if (mouse.easedX < -900) {
          mouse.easedX = mouse.x;
          mouse.easedY = mouse.y;
        } else {
          // Subtle, calm cursor lag with smooth easing
          mouse.easedX += (mouse.x - mouse.easedX) * 0.18;
          mouse.easedY += (mouse.y - mouse.easedY) * 0.18;
        }
        curX = mouse.easedX;
        curY = mouse.easedY;
      }

      // 3. Draw smooth, continuous rounded liquid stroke (NO bumpy discrete circle clouds)
      if (mouse.px > -900) {
        const dist = Math.hypot(curX - mouse.px, curY - mouse.py);
        if (dist > 0.5) {
          const brushRadius = Math.max(46, Math.min(W * 0.052, 78));

          tctx.save();
          tctx.strokeStyle = '#000000';
          tctx.fillStyle = '#000000';
          tctx.lineCap = 'round';
          tctx.lineJoin = 'round';
          tctx.lineWidth = brushRadius * 2;

          tctx.beginPath();
          tctx.moveTo(mouse.px, mouse.py);
          tctx.lineTo(curX, curY);
          tctx.stroke();

          // Ensure the cap is smoothly filled
          tctx.beginPath();
          tctx.arc(curX, curY, brushRadius, 0, Math.PI * 2);
          tctx.fill();

          tctx.restore();
        }
      }

      mouse.px = curX;
      mouse.py = curY;

      // Cycle between pink and violet 3D metallic foil balloon textures every ~4 seconds
      if (foilTextures.length > 1 && now - lastSwap > 4000) {
        texIdx = (texIdx + 1) % foilTextures.length;
        lastSwap = now;
      }

      // 4. Render 3D Foil Balloon Texture clipped to Wordmark & Trail
      xctx.globalCompositeOperation = 'source-over';
      xctx.clearRect(0, 0, W, H);

      const activeFoil = foilTextures[texIdx] || foilTextures[0];
      if (activeFoil && activeFoil.complete && activeFoil.naturalWidth > 0) {
        // Draw 3D foil image covering the canvas preserving aspect ratio
        const imgRatio = activeFoil.naturalWidth / activeFoil.naturalHeight;
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

        xctx.drawImage(activeFoil, offsetX, offsetY, drawW, drawH);
      } else {
        // High-gloss metallic gradient fallback if image is still loading
        const g = xctx.createLinearGradient(0, H * 0.2, W, H * 0.8);
        g.addColorStop(0, '#c0156d');
        g.addColorStop(0.28, '#ff5ea8');
        g.addColorStop(0.48, '#ffffff');
        g.addColorStop(0.68, '#c0156d');
        g.addColorStop(1, '#660534');
        xctx.fillStyle = g;
        xctx.fillRect(0, 0, W, H);
      }

      // Mask 1: Clip foil texture strictly to the wordmark letters
      xctx.globalCompositeOperation = 'destination-in';
      drawWord(xctx, '#000000');

      // Mask 2: Clip foil texture strictly to where the liquid trail is
      xctx.globalCompositeOperation = 'destination-in';
      xctx.drawImage(trail, 0, 0, W, H);

      // 5. Compose Final Screen:
      // A. Crisp pure white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // B. Smooth continuous black liquid trail on white background
      ctx.drawImage(trail, 0, 0, W, H);

      // C. Base solid black wordmark for all unrevealed letter areas
      drawWord(ctx, '#000000');

      // D. Revealed 3D metallic foil balloon material inside the letters!
      ctx.drawImage(tex, 0, 0, W, H);

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', size);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [brand]);

  return (
    <canvas
      ref={canvasRef}
      id="stage"
      className="absolute inset-0 w-full h-full block cursor-crosshair select-none"
      aria-label={`${brand} interactive liquid ink and 3D metallic foil balloon canvas`}
    />
  );
};
