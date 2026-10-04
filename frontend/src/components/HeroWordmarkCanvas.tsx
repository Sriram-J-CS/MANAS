import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { MascotExpression } from '../types';

interface HeroWordmarkCanvasProps {
  wordmarkText: string;
  isTamil?: boolean;
}

interface InkBlob {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  decay: number;
  expression: MascotExpression;
}

export const HeroWordmarkCanvas: React.FC<HeroWordmarkCanvasProps> = ({
  wordmarkText,
  isTamil = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeExpression, setActiveExpression] = useState<MascotExpression>('happy');
  const [isInteracting, setIsInteracting] = useState(false);
  const imagesRef = useRef<Partial<Record<MascotExpression, HTMLImageElement | null>>>({
    neutral: null,
    calm: null,
    happy: null,
    concerned: null,
    sad: null,
    surprised: null,
  });

  const blobsRef = useRef<InkBlob[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const autoWanderAngle = useRef<number>(0);

  // Load mascot images
  useEffect(() => {
    const expressions: MascotExpression[] = ['neutral', 'happy', 'concerned'];
    expressions.forEach((expr) => {
      const img = new Image();
      img.src = `/assets/mascot/mascot_${expr}.jpg`;
      img.onload = () => {
        imagesRef.current[expr] = img;
      };
    });
  }, []);

  // Spawn an ink blob
  const addBlob = useCallback((x: number, y: number, forceRadius?: number) => {
    const maxRadius = forceRadius || Math.random() * 60 + 75;
    blobsRef.current.push({
      x,
      y,
      radius: 18,
      maxRadius,
      alpha: 1.0,
      decay: 0.007 + Math.random() * 0.005,
      expression: activeExpression,
    });

    // Limit maximum blobs for buttery 60fps performance
    if (blobsRef.current.length > 55) {
      blobsRef.current.shift();
    }
  }, [activeExpression]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = (canvas.width = container.clientWidth);
    let height = (canvas.height = container.clientHeight);

    const handleResize = () => {
      if (!container || !canvas) return;
      width = canvas.width = container.clientWidth;
      height = canvas.height = container.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Auto-wander blob when idle or on mobile to bring the canvas alive
      if (!lastMousePos.current && !prefersReducedMotion) {
        autoWanderAngle.current += 0.02;
        const autoX = width / 2 + Math.cos(autoWanderAngle.current * 0.7) * (width * 0.35);
        const autoY = height / 2 + Math.sin(autoWanderAngle.current) * (height * 0.25);
        if (Math.random() < 0.25) {
          addBlob(autoX, autoY, 80);
        }
      }

      // 1. Render giant wordmark to get typography footprint
      ctx.save();
      const fontSize = Math.min(width * 0.165, height * 0.75, 175);
      ctx.font = `900 ${fontSize}px ${isTamil ? "'Noto Sans Tamil', 'Nunito'" : "'Nunito'"}, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const centerX = width / 2;
      const centerY = height / 2;

      // Base letter styling (deep ink with gentle warmth)
      ctx.fillStyle = '#101820';
      ctx.fillText(wordmarkText, centerX, centerY);

      // 2. If there are active blobs, clip to the text and draw the mascot texture
      if (blobsRef.current.length > 0) {
        ctx.globalCompositeOperation = 'source-atop';

        blobsRef.current.forEach((blob, index) => {
          blob.radius += (blob.maxRadius - blob.radius) * 0.08;
          blob.alpha -= blob.decay;

          if (blob.alpha <= 0) {
            blobsRef.current.splice(index, 1);
            return;
          }

          const img = imagesRef.current[blob.expression] || imagesRef.current.happy;
          if (img && img.complete) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
            ctx.clip();

            const imgAspect = img.width / img.height;
            const drawSize = Math.max(width * 0.45, 360);
            const drawW = drawSize;
            const drawH = drawSize / imgAspect;

            const imgX = centerX - drawW / 2;
            const imgY = centerY - drawH / 2;

            ctx.globalAlpha = Math.max(0, Math.min(1, blob.alpha * 1.2));
            ctx.drawImage(img, imgX, imgY, drawW, drawH);

            const gradient = ctx.createRadialGradient(
              blob.x,
              blob.y,
              blob.radius * 0.2,
              blob.x,
              blob.y,
              blob.radius
            );
            gradient.addColorStop(0, 'rgba(169, 155, 224, 0.0)');
            gradient.addColorStop(0.8, 'rgba(95, 168, 139, 0.25)');
            gradient.addColorStop(1, 'rgba(39, 110, 139, 0.5)');

            ctx.fillStyle = gradient;
            ctx.fillRect(blob.x - blob.radius, blob.y - blob.radius, blob.radius * 2, blob.radius * 2);

            ctx.restore();
          }
        });
      }

      ctx.restore();

      // Delicate 1px text outline on top to maintain letter sharpness
      ctx.save();
      ctx.font = `900 ${fontSize}px ${isTamil ? "'Noto Sans Tamil', 'Nunito'" : "'Nunito'"}, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(230, 224, 214, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.strokeText(wordmarkText, centerX, centerY);
      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [wordmarkText, isTamil, addBlob]);

  // Mouse & Touch Interaction Handlers
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    lastMousePos.current = { x, y };
    setIsInteracting(true);
    addBlob(x, y);
  };

  const handlePointerLeave = () => {
    lastMousePos.current = null;
    setIsInteracting(false);
  };

  return (
    <div className="relative w-full flex flex-col items-center select-none" ref={containerRef}>
      {/* Expression Switcher Pills */}
      <div className="flex items-center gap-2 mb-4 bg-white/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#E6E0D6] shadow-sm z-20">
        <span className="text-[11px] font-mono tracking-wider text-[#5B6673] uppercase">
          Reveals Inside Letters:
        </span>
        {(['happy', 'neutral', 'concerned'] as MascotExpression[]).map((expr) => (
          <button
            key={expr}
            onClick={() => setActiveExpression(expr)}
            className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-all duration-200 capitalize flex items-center gap-1.5 ${
              activeExpression === expr
                ? 'bg-[#276E8B] text-white shadow-xs'
                : 'text-[#5B6673] hover:text-[#1F2A37] hover:bg-[#FAF7F2]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                expr === 'happy'
                  ? 'bg-[#5FA88B]'
                  : expr === 'neutral'
                  ? 'bg-[#A99BE0]'
                  : 'bg-[#B84A33]'
              }`}
            />
            {expr}
          </button>
        ))}
      </div>

      {/* Main Canvas Area */}
      <div className="relative w-full h-[180px] sm:h-[240px] md:h-[300px] lg:h-[360px] flex items-center justify-center cursor-crosshair overflow-hidden rounded-2xl">
        <canvas
          ref={canvasRef}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          className="w-full h-full block touch-none z-10"
        />

        {/* Ambient subtle background grid for depth */}
        <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(#276E8B_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      {/* Interactive Helper Hint */}
      <div className="mt-2 flex items-center gap-2 text-xs font-mono text-[#5B6673]/80">
        <span className={`inline-block w-2 h-2 rounded-full transition-colors ${isInteracting ? 'bg-[#5FA88B] animate-ping' : 'bg-[#A99BE0]'}`} />
        <span>Hover or touch the wordmark to reveal mascot expressions</span>
      </div>
    </div>
  );
};
