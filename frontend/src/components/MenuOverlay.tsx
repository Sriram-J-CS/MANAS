import React from 'react';
import type { Language } from '../types';
import { SUPPORTED_LANGUAGES } from '../i18n/languages';

interface MenuOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang: Language;
  onToggleLang: () => void;
  onSelectLang?: (lang: Language) => void;
  onOpenDemo: () => void;
  onOpenHelp: () => void;
  onOpenCalm: () => void;
  onOpenMascotCustomizer?: () => void;
  onOpenVoiceRatingLab?: () => void;
  onOpenTwin?: () => void;
  onOpenPersonality?: () => void;
  onOpenWhatWorks?: () => void;
  onOpenMemory?: () => void;
  onOpenJournalGoals?: () => void;
  onOpenSafetyPlan?: () => void;
  onOpenPrivacy?: () => void;
}

export const MenuOverlay: React.FC<MenuOverlayProps> = ({
  isOpen,
  onClose,
  currentLang,
  onToggleLang,
  onSelectLang,
  onOpenDemo,
  onOpenHelp,
  onOpenCalm,
  onOpenMascotCustomizer,
  onOpenVoiceRatingLab,
  onOpenTwin,
  onOpenPersonality,
  onOpenWhatWorks,
  onOpenMemory,
  onOpenJournalGoals,
  onOpenSafetyPlan,
  onOpenPrivacy,
}) => {
  if (!isOpen) return null;

  const navItems = [
    { num: '01', label: 'COMPANION WORKSPACE', action: onOpenDemo },
    { num: '02', label: 'DIGITAL MENTAL TWIN', action: onOpenTwin },
    { num: '03', label: 'OCEAN PERSONALITY DISCOVERY', action: onOpenPersonality },
    { num: '04', label: 'WHAT WORKS FOR ME', action: onOpenWhatWorks },
    { num: '05', label: 'MEMORY CENTER', action: onOpenMemory },
    { num: '06', label: 'JOURNAL & GOALS', action: onOpenJournalGoals },
    { num: '07', label: 'SAFETY PLAN & HELPLINES', action: onOpenSafetyPlan },
    { num: '08', label: 'PRIVACY CENTER & CONSENT', action: onOpenPrivacy },
    { num: '09', label: 'VOICE RATING LAB (8 LANGUAGES)', action: onOpenVoiceRatingLab },
    { num: '10', label: 'CUSTOMIZE 3D MASCOT', action: onOpenMascotCustomizer },
    { num: '11', label: 'CALM SPACE & AUDIO', action: onOpenCalm },
  ];

  const handleItemClick = (item: (typeof navItems)[0]) => {
    onClose();
    if (item.action) {
      item.action();
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

        <div className="flex flex-col items-start sm:items-end gap-2 text-xs font-mono">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-white/40 uppercase tracking-wider text-[10px] mr-1">Language:</span>
            {SUPPORTED_LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  if (onSelectLang) {
                    onSelectLang(l.code as Language);
                  } else {
                    onToggleLang();
                  }
                }}
                className={`px-2.5 py-1 rounded-full border text-[11px] font-mono transition-colors ${
                  currentLang === l.code
                    ? 'border-[#8B5CF6] bg-[#8B5CF6]/30 text-white font-bold'
                    : 'border-white/20 hover:border-white/60 text-white/70'
                }`}
                title={l.englishName}
              >
                {l.nativeName}
              </button>
            ))}
          </div>
          <span className="text-white/40 text-[10px]">© 2026 MANAS — AI Emotional Wellness Twin</span>
        </div>
      </div>
    </div>
  );
};
