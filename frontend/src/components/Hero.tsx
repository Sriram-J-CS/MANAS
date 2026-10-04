import React, { useRef, useState } from 'react';
import { InkCanvas } from './InkCanvas';
import type { SiteConfig } from '../content/site.config';

interface HeroProps {
  config: SiteConfig;
  onOpenDemo?: () => void;
  onOpenHelp?: () => void;
  onToggleLang: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  config,
  onOpenDemo,
  onOpenHelp: _onOpenHelp,
  onToggleLang,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [btnOffset, setBtnOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isInkExpanding, setIsInkExpanding] = useState(false);

  // Magnetic hover physics (max 8px pull)
  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rawDx = (e.clientX - centerX) * 0.28;
    const rawDy = (e.clientY - centerY) * 0.28;
    const dist = Math.hypot(rawDx, rawDy);
    const maxPull = 8;
    const factor = dist > maxPull ? maxPull / dist : 1.0;
    setBtnOffset({ x: rawDx * factor, y: rawDy * factor });
  };

  const handleMouseLeave = () => {
    setBtnOffset({ x: 0, y: 0 });
  };

  const handleEnterChat = () => {
    setIsInkExpanding(true);
    setTimeout(() => {
      onOpenDemo?.();
      setTimeout(() => setIsInkExpanding(false), 500);
    }, 400);
  };

  return (
    <section className="relative h-screen w-full bg-[#ffffff] text-[#000000] overflow-hidden select-none z-10" id="hero">
      {/* 2D / WebGL Canvas with Organic Ink Trail & 3D Tactile Material Inside Letters */}
      <InkCanvas brand={config.brand} />

      {/* Top-Left: Two-line tagline */}
      <div className="absolute top-[80px] md:top-[92px] left-[20px] md:left-[36px] z-20 max-w-[480px] pointer-events-none">
        <h1 className="text-[clamp(15px,1.35vw,18px)] leading-[1.28] font-medium text-[#000000] tracking-[-0.02em] select-none">
          Not a style, a perspective.
          <br />
          Because MANAS is listening.
        </h1>
      </div>

      {/* Hero Action: "ENTER CHAT →" Centered Directly Below MANAS Wordmark */}
      <div className="absolute top-[68%] md:top-[66%] left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
        <button
          ref={buttonRef}
          onClick={handleEnterChat}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: `translate3d(${btnOffset.x}px, ${btnOffset.y}px, 0)`,
            transition: btnOffset.x === 0 ? 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
          }}
          className="group relative inline-flex items-center gap-3.5 px-8 py-3.5 md:px-9 md:py-4 rounded-full bg-[#000000] text-[#FFFFFF] hover:bg-[#1A1A1A] active:scale-[0.97] transition-all cursor-pointer select-none shadow-[0_10px_25px_rgba(0,0,0,0.18)] hover:shadow-[0_16px_35px_rgba(0,0,0,0.26)] overflow-hidden"
          aria-label="Enter chat"
        >
          {/* Subtle sheen highlight on hover */}
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none" />

          <span className="relative z-10 font-mono text-[13px] md:text-[14px] font-bold tracking-[0.14em] uppercase">
            ENTER CHAT
          </span>
          <span className="relative z-10 inline-block font-sans text-sm transition-transform duration-300 group-hover:translate-x-1.5">
            →
          </span>
        </button>
      </div>

      {/* Ink-Fill Transition Circle */}
      {isInkExpanding && (
        <div
          className="fixed inset-0 z-50 pointer-events-none bg-[#0A0A0A] rounded-full"
          style={{
            animation: 'inkExpand 0.5s cubic-bezier(0.85, 0, 0.15, 1) forwards',
          }}
        />
      )}

      {/* Bottom-Left: Creative studio info (offset to not collide with music player) */}
      <div className="absolute bottom-[22px] left-[20px] md:left-[36px] z-20 pointer-events-none hidden sm:block">
        <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#000000] opacity-80 pl-[290px] lg:pl-[330px]">
          Creative studio in Chennai · AI Mental Health Computing Lab
        </p>
      </div>

      {/* Bottom-Right: Language Switch & Links */}
      <div className="absolute bottom-[22px] right-[20px] md:right-[36px] z-20 flex items-center gap-4 text-[11px] font-mono uppercase tracking-[0.08em] text-[#000000] pointer-events-auto select-none">
        <span className="hidden md:inline-flex items-center gap-2 text-[#000000]/60 text-[10px] tracking-widest font-mono">
          <a href="#studio" className="hover:text-black transition-colors">STUDIO</a>
          <span>/</span>
          <a href="#works" className="hover:text-black transition-colors">WORKS</a>
        </span>
        <button
          onClick={onToggleLang}
          className="px-3 py-1.5 rounded-full bg-black text-white hover:bg-neutral-800 transition-colors text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer"
          title="Switch Language"
          aria-label="Toggle language"
        >
          <span>LANG:</span>
          <span>{config.langToggleLabel === 'தமிழ்' ? 'EN' : 'TA'}</span>
        </button>
      </div>
    </section>
  );
};

