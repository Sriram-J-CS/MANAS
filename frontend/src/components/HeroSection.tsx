import React from 'react';
import { ArrowRight, Sparkles, HeartHandshake } from 'lucide-react';
import { HeroWordmarkCanvas } from './HeroWordmarkCanvas';
import type { Language } from '../types';
import { translations } from '../content/translations';

interface HeroSectionProps {
  currentLang: Language;
  onOpenDemo: () => void;
  onOpenHelp: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  currentLang,
  onOpenDemo,
  onOpenHelp,
}) => {
  const t = translations[currentLang].hero;
  const isTamil = currentLang === 'ta';

  return (
    <section
      id="hero"
      className="relative pt-6 pb-20 md:pt-10 md:pb-28 overflow-hidden bg-[#FAF7F2]"
    >
      {/* Soft atmospheric gradient glow behind hero */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-r from-[#A99BE0]/15 via-[#5FA88B]/15 to-[#276E8B]/10 blur-3xl pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center text-center">
        {/* Academic / Project Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 border border-[#E6E0D6] shadow-2xs mb-6 backdrop-blur-xs">
          <span className="w-2 h-2 rounded-full bg-[#5FA88B] animate-pulse" />
          <span className="text-xs font-mono text-[#5B6673] tracking-wide">
            {t.badge}
          </span>
        </div>

        {/* Section 1: Giant Wordmark with Cursor-Trail Ink-Blob Canvas Mask */}
        <div className="w-full max-w-5xl my-2">
          <HeroWordmarkCanvas
            wordmarkText={t.projectWordmark}
            isTamil={isTamil}
          />
        </div>

        {/* Tagline & Subtitle */}
        <div className="max-w-3xl mx-auto mt-6">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#101820] tracking-tight">
            {t.tagline}
          </h2>
          <p className="mt-3.5 text-base sm:text-lg text-[#5B6673] leading-relaxed font-normal">
            {t.subtitle}
          </p>
        </div>

        {/* Action Buttons: Pill "Start talking →" */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <button
            onClick={onOpenDemo}
            className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-full bg-[#276E8B] hover:bg-[#1F5A73] text-white font-bold text-base shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            <Sparkles className="w-4 h-4 text-[#A99BE0]" />
            <span>{t.ctaPrimary}</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
          </button>

          <a
            href="#features"
            className="inline-flex items-center gap-2 px-6 py-4 rounded-full bg-white hover:bg-[#FAF7F2] text-[#1F2A37] border border-[#E6E0D6] font-semibold text-base shadow-xs hover:border-[#276E8B]/40 transition-all duration-200"
          >
            <span>{t.ctaSecondary}</span>
          </a>

          <button
            onClick={onOpenHelp}
            className="inline-flex items-center gap-2 px-5 py-4 rounded-full bg-[#B84A33]/10 hover:bg-[#B84A33]/15 text-[#B84A33] border border-[#B84A33]/25 font-semibold text-base transition-all duration-200"
          >
            <HeartHandshake className="w-4 h-4" />
            <span>Tele-MANAS 14416</span>
          </button>
        </div>

        {/* Feature quick badges */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl w-full text-left">
          <div className="p-3.5 rounded-xl bg-white/70 border border-[#E6E0D6] backdrop-blur-xs flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#5FA88B]/15 text-[#5FA88B] flex items-center justify-center font-bold text-xs">
              01
            </div>
            <div>
              <p className="text-xs font-bold text-[#101820]">Sarvam Indic</p>
              <p className="text-[11px] text-[#5B6673]">Tamil · English · Tanglish</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/70 border border-[#E6E0D6] backdrop-blur-xs flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#276E8B]/15 text-[#276E8B] flex items-center justify-center font-bold text-xs">
              02
            </div>
            <div>
              <p className="text-xs font-bold text-[#101820]">Digital Twin</p>
              <p className="text-[11px] text-[#5B6673]">7-Day Baseline Trends</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/70 border border-[#E6E0D6] backdrop-blur-xs flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#A99BE0]/15 text-[#A99BE0] flex items-center justify-center font-bold text-xs">
              03
            </div>
            <div>
              <p className="text-xs font-bold text-[#101820]">Adaptive Typing</p>
              <p className="text-[11px] text-[#5B6673]">Cadence & Pace Match</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/70 border border-[#E6E0D6] backdrop-blur-xs flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#B84A33]/15 text-[#B84A33] flex items-center justify-center font-bold text-xs">
              04
            </div>
            <div>
              <p className="text-xs font-bold text-[#101820]">Tele-MANAS</p>
              <p className="text-[11px] text-[#5B6673]">Pre-Screen Crisis Net</p>
            </div>
          </div>
        </div>

        {/* AI Disclaimer Line */}
        <p className="mt-8 text-xs font-mono text-[#5B6673] tracking-wide max-w-xl">
          ℹ️ {t.aiDisclaimerNote}
        </p>
      </div>
    </section>
  );
};
