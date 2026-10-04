import React, { useEffect, useState } from 'react';
import { UI_EFFECTS } from '../../config/uiEffects';

export const FloatingBackgroundShapes: React.FC = () => {
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [enabled, setEnabled] = useState(() => {
    if (!UI_EFFECTS.enabled || !UI_EFFECTS.floatingShapes) return false;
    if (typeof window !== 'undefined') {
      return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return true;
  });

  useEffect(() => {
    if (!enabled) return;

    let rafId: number;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handlePointerMove = (e: PointerEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      targetX = (e.clientX - cx) * 0.035;
      targetY = (e.clientY - cy) * 0.035;
    };

    const updatePosition = () => {
      if (!document.hidden) {
        currentX += (targetX - currentX) * 0.04;
        currentY += (targetY - currentY) * 0.04;
        setMouseOffset({ x: currentX, y: currentY });
      }
      rafId = requestAnimationFrame(updatePosition);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    rafId = requestAnimationFrame(updatePosition);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      cancelAnimationFrame(rafId);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-[5] select-none"
      aria-hidden="true"
    >
      {/* Calm 3D Shape 1: Lavender Pearl */}
      <div
        className="absolute w-[380px] h-[380px] sm:w-[500px] sm:h-[500px] rounded-full blur-[80px] opacity-40 transition-transform duration-700 ease-out"
        style={{
          top: '12%',
          right: '5%',
          background: 'radial-gradient(circle at 35% 35%, rgba(139, 92, 246, 0.4), rgba(99, 102, 241, 0.15) 55%, transparent 75%)',
          transform: `translate3d(${mouseOffset.x * 1.2}px, ${mouseOffset.y * 1.2}px, 0)`,
        }}
      />

      {/* Calm 3D Shape 2: Serene Emerald Glow */}
      <div
        className="absolute w-[320px] h-[320px] sm:w-[440px] sm:h-[440px] rounded-full blur-[90px] opacity-35 transition-transform duration-700 ease-out"
        style={{
          top: '55%',
          left: '2%',
          background: 'radial-gradient(circle at 30% 30%, rgba(16, 185, 129, 0.35), rgba(20, 184, 166, 0.12) 55%, transparent 75%)',
          transform: `translate3d(${-mouseOffset.x * 0.9}px, ${-mouseOffset.y * 0.9}px, 0)`,
        }}
      />

      {/* Calm 3D Shape 3: Soft Rose Quartz */}
      <div
        className="absolute w-[280px] h-[280px] sm:w-[380px] sm:h-[380px] rounded-full blur-[75px] opacity-30 transition-transform duration-700 ease-out"
        style={{
          bottom: '8%',
          right: '25%',
          background: 'radial-gradient(circle at 40% 40%, rgba(236, 72, 153, 0.3), rgba(217, 70, 239, 0.08) 55%, transparent 75%)',
          transform: `translate3d(${mouseOffset.x * 0.6}px, ${mouseOffset.y * 0.6}px, 0)`,
        }}
      />
    </div>
  );
};
