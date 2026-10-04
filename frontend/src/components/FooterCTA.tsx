import React from 'react';
import { ArrowUpRight, Sparkles, Lock } from 'lucide-react';
import type { Language } from '../types';
import { translations } from '../content/translations';

interface FooterCTAProps {
  currentLang: Language;
  onOpenDemo: () => void;
  onOpenHelp: () => void;
}

export const FooterCTA: React.FC<FooterCTAProps> = ({
  currentLang,
  onOpenDemo,
  onOpenHelp,
}) => {
  const t = translations[currentLang].footer;

  return (
    <footer className="relative bg-[#101820] text-[#E8EEF3] pt-24 pb-16 overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-[#276E8B]/20 via-[#A99BE0]/10 to-transparent blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Top CTA Callout */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            {t.ctaHeading}
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#A9B6C2] max-w-xl mx-auto">
            {t.ctaSub}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={onOpenDemo}
              className="px-8 py-4 rounded-full bg-[#276E8B] hover:bg-[#1F5A73] text-white font-bold text-base shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-[#A99BE0]" />
              <span>{t.startBtn}</span>
            </button>

            <button
              onClick={onOpenHelp}
              className="px-6 py-4 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-base border border-white/20 transition-all duration-300 flex items-center gap-2"
            >
              <span>Emergency 14416</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Animated Giant Wordmark Marquee / Strip */}
        <div className="w-full py-10 my-10 border-y border-white/10 overflow-hidden select-none relative">
          <div className="flex whitespace-nowrap animate-[marquee_24s_linear_infinite] group hover:[animation-play-state:paused]">
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="text-6xl sm:text-8xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white/30 via-white/10 to-white/30 mr-12 font-sans"
              >
                MANAS · மனஸ் · AI COMPANION · EMOTIONAL WELLNESS ·{' '}
              </span>
            ))}
          </div>
        </div>

        {/* Footer Navigation & Legal Guarantees */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 py-8 border-b border-white/10 text-xs text-[#A9B6C2]">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🌱</span>
              <span className="font-extrabold text-base text-white">MANAS</span>
            </div>
            <p className="leading-relaxed">
              AI companion designed to support emotional wellness through empathetic listening, baseline tracking, and proactive self-reflection.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white uppercase tracking-wider mb-3 font-mono">
              Research Architecture
            </h4>
            <p className="leading-relaxed">
              Autonomous computational emotion modeling & longitudinal baseline equilibrium.
            </p>
            <p className="mt-2 text-[#6FB7D3] font-mono text-[11px]">
              Intelligent Systems & Mental Health Computing Lab
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white uppercase tracking-wider mb-3 font-mono">
              Privacy & DPDP Compliance
            </h4>
            <div className="flex items-start gap-2">
              <Lock className="w-4 h-4 text-[#6FBF9F] shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {t.privacyPromise}
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-white uppercase tracking-wider mb-3 font-mono">
              24/7 National Helplines
            </h4>
            <p className="leading-relaxed">
              Tele-MANAS: <span className="text-white font-bold">14416</span> (Toll-Free, 24/7)
            </p>
            <p className="mt-1">
              National Emergency: <span className="text-white font-bold">112</span>
            </p>
            <p className="mt-2 text-[10px] text-[#A9B6C2]/70 font-mono">
              Free, multilingual government support in 20+ Indian languages.
            </p>
          </div>
        </div>

        {/* Bottom Disclaimer & Copyright */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#A9B6C2]/70">
          <p className="max-w-2xl text-center sm:text-left leading-relaxed">
            {t.disclaimer}
          </p>
          <div className="font-mono text-center sm:text-right shrink-0">
            <p>{t.rights}</p>
            <p className="text-[#6FB7D3]">v1.0 Public Landing Page</p>
          </div>
        </div>
      </div>

      {/* Marquee Keyframe Style */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </footer>
  );
};
