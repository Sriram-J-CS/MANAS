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

  // Magnetic hover physics
  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = (e.clientX - centerX) * 0.35;
    const dy = (e.clientY - centerY) * 0.35;
    setBtnOffset({ x: dx, y: dy });
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
    <section className="relative h-screen w-full bg-[#ffffff] text-[#000000] overflow-hidden select-none" id="hero">
      {/* 2D Canvas with Organic Ink Trail & 3D Glossy Texture Inside Letters */}
      <InkCanvas brand={config.brand} textures={config.textures} />

      {/* Top-Left: Two-line tagline */}
      <div className="absolute top-[80px] left-[22px] z-20 max-w-[460px] pointer-events-none">
        <h1 className="text-[clamp(15px,1.4vw,18px)] leading-[1.25] font-medium text-[#000000] tracking-[-0.02em]">
          Not a style, a perspective.
          <br />
          Because MANAS is listening.
        </h1>
      </div>

      {/* Hero Action: Huge "ENTER CHAT →" Large Black Pill with Magnetic Hover & Ink-Fill Transition */}
      <div className="absolute bottom-[80px] md:bottom-[70px] left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
        <button
          ref={buttonRef}
          onClick={handleEnterChat}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: `translate3d(${btnOffset.x}px, ${btnOffset.y}px, 0)`,
            transition: btnOffset.x === 0 ? 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
          }}
          className="group relative inline-flex items-center justify-center px-10 py-5 rounded-full bg-[#000000] text-[#FFFFFF] shadow-2xl hover:shadow-[0_20px_50px_rgba(0,0,0,0.35)] transition-shadow overflow-hidden cursor-pointer"
        >
          {/* Subtle violet sheen on hover */}
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[#8B5CF6]/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
          
          <span className="relative z-10 font-mono uppercase text-sm md:text-base font-bold tracking-[0.16em] flex items-center gap-3">
            ENTER CHAT
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">→</span>
          </span>
        </button>
      </div>

      {/* Ink-Fill Transition Circle */}
      {isInkExpanding && (
        <div
          className="fixed inset-0 z-50 pointer-events-none bg-[#0A0A0A] animate-ink-expand rounded-full"
          style={{
            animation: 'inkExpand 0.5s cubic-bezier(0.85, 0, 0.15, 1) forwards',
          }}
        />
      )}

      {/* Bottom-Left: Creative studio info */}
      <div className="absolute bottom-[22px] left-[22px] z-20 pointer-events-none">
        <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#000000] opacity-80">
          Creative studio in Chennai · AI Mental Health Computing Lab
        </p>
      </div>

      {/* Bottom-Right: Language Switch */}
      <div className="absolute bottom-[22px] right-[22px] z-20 flex items-center gap-3 text-[11px] font-mono uppercase tracking-[0.08em] text-[#000000] pointer-events-auto">
        <button
          onClick={onToggleLang}
          className="px-3 py-1.5 rounded-full bg-black text-white hover:bg-neutral-800 transition-colors text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md"
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

