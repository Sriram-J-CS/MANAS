import React from 'react';
import type { Language } from '../types';

interface MenuOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang: Language;
  onToggleLang: () => void;
  onOpenDemo: () => void;
  onOpenHelp: () => void;
  onOpenCalm: () => void;
  onOpenMascotCustomizer?: () => void;
}

export const MenuOverlay: React.FC<MenuOverlayProps> = ({
  isOpen,
  onClose,
  currentLang,
  onToggleLang,
  onOpenDemo,
  onOpenHelp,
  onOpenCalm,
  onOpenMascotCustomizer,
}) => {
  if (!isOpen) return null;

  const navItems = [
    { num: '01', label: 'HERO / INK REVEAL', href: '#hero' },
    { num: '02', label: 'STATEMENT / PREMISE', href: '#statement' },
    { num: '03', label: 'WORKS / 07 MODULES', href: '#works' },
    { num: '04', label: 'THE STUDIO / RESEARCH', href: '#studio' },
    { num: '05', label: 'WORDS OVER MEDIA', href: '#words-over-media' },
    { num: '06', label: 'CUSTOMIZE 3D MASCOT', action: onOpenMascotCustomizer },
    { num: '07', label: 'CALM SPACE & AUDIO', action: onOpenCalm },
    { num: '08', label: 'CONTACT / FOOTER', href: '#contact' },
  ];

  const handleItemClick = (item: typeof navItems[0]) => {
    onClose();
    if (item.action) {
      item.action();
    } else if (item.href) {
      const el = document.querySelector(item.href);
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#000000] text-[#ffffff] flex flex-col justify-between p-6 sm:p-12 animate-in fade-in duration-300 select-none overflow-y-auto">
      {/* Header Info */}
      <div className="flex justify-between items-center text-[11px] font-mono tracking-widest text-white/50 pt-8 sm:pt-4">
        <span>INDEX / NAVIGATION</span>
        <span>MANAS · EMOTIONAL WELLNESS</span>
      </div>

      {/* Main Nav Links */}
      <nav className="my-auto py-8 flex flex-col gap-4 sm:gap-6">
        {navItems.map((item) => (
          <button
            key={item.num}
            onClick={() => handleItemClick(item)}
            className="group flex items-baseline gap-4 sm:gap-8 text-left hover:opacity-100 transition-opacity"
          >
            <span className="text-xs sm:text-sm font-mono text-white/40 group-hover:text-white transition-colors">
              {item.num}
            </span>
            <span className="text-[clamp(28px,5vw,72px)] font-extrabold uppercase tracking-[-0.04em] leading-[0.95] text-white/80 group-hover:text-white group-hover:translate-x-3 transition-transform duration-300">
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      {/* Quick Launch Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 border-t border-white/20">
        <div className="flex flex-wrap items-center gap-6 text-[13px] font-mono uppercase tracking-wider">
          <button
            onClick={() => {
              onClose();
              onOpenDemo();
            }}
            className="hover:underline underline-offset-4 text-white"
          >
            Launch Companion →
          </button>
          <button
            onClick={() => {
              onClose();
              onOpenHelp();
            }}
            className="hover:underline underline-offset-4 text-white/70 hover:text-white"
          >
            Emergency 14416 ↗
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <button
            onClick={onToggleLang}
            className="px-3 py-1 rounded-full border border-white/40 hover:border-white uppercase tracking-wider text-white"
          >
            Language: {currentLang === 'en' ? 'தமிழ்' : 'English'}
          </button>
          <span className="text-white/40">© 2026 MANAS</span>
        </div>
      </div>
    </div>
  );
};
