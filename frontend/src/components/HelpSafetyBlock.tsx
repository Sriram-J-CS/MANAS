import React from 'react';
import { PhoneCall, AlertTriangle, HeartHandshake, Compass, Users } from 'lucide-react';
import type { Language } from '../types';
import { translations } from '../content/translations';

interface HelpSafetyBlockProps {
  currentLang: Language;
}

export const HelpSafetyBlock: React.FC<HelpSafetyBlockProps> = ({ currentLang }) => {
  const t = translations[currentLang].helpSafety;

  return (
    <section id="safety-block" className="py-20 md:py-28 bg-[#FAF7F2] text-[#1F2A37] border-t border-[#E6E0D6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto bg-white rounded-3xl border-2 border-[#B84A33]/20 shadow-soft overflow-hidden">
          {/* Header Banner */}
          <div className="bg-[#B84A33] text-white px-6 sm:px-8 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <HeartHandshake className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-[11px] font-mono tracking-widest uppercase opacity-90 font-bold block">
                  {t.badge}
                </span>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
                  {t.title}
                </h3>
              </div>
            </div>

            <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-white/15 text-xs font-mono font-semibold">
              Always Free & Confidential
            </span>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            <p className="text-base text-[#1F2A37] leading-relaxed">
              {t.description}
            </p>

            {/* Helpline Emergency Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tele-MANAS Card */}
              <div className="bg-[#FAF7F2] rounded-2xl p-5 border border-[#E6E0D6] flex flex-col justify-between">
                <div>
                  <span className="text-xs font-mono font-bold text-[#B84A33] uppercase">
                    {t.teleManasLabel}
                  </span>
                  <div className="text-3xl sm:text-4xl font-black text-[#101820] mt-1 font-mono">
                    {t.teleManasNumber}
                  </div>
                  <p className="text-xs text-[#5B6673] mt-2 leading-normal">
                    {t.teleManasSub}
                  </p>
                </div>

                <a
                  href={`tel:${t.teleManasNumber}`}
                  className="mt-5 w-full py-3 rounded-full bg-[#B84A33] hover:bg-[#A03E29] text-white text-xs font-bold text-center shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Call Tele-MANAS (14416)</span>
                </a>
              </div>

              {/* National Emergency Services Card */}
              <div className="bg-[#FAF7F2] rounded-2xl p-5 border border-[#E6E0D6] flex flex-col justify-between">
                <div>
                  <span className="text-xs font-mono font-bold text-[#276E8B] uppercase">
                    {t.emergencyLabel}
                  </span>
                  <div className="text-3xl sm:text-4xl font-black text-[#101820] mt-1 font-mono">
                    {t.emergencyNumber}
                  </div>
                  <p className="text-xs text-[#5B6673] mt-2 leading-normal">
                    {t.emergencySub}
                  </p>
                </div>

                <a
                  href={`tel:${t.emergencyNumber}`}
                  className="mt-5 w-full py-3 rounded-full bg-[#101820] hover:bg-[#1F2A37] text-white text-xs font-bold text-center shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Call Emergency (112)</span>
                </a>
              </div>
            </div>

            {/* Static Mandatory Disclaimer Callout */}
            <div className="bg-[#FAF7F2] rounded-2xl p-4.5 border border-[#E6E0D6] flex items-start gap-3.5">
              <AlertTriangle className="w-5 h-5 text-[#B84A33] shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-[#101820] leading-relaxed">
                {t.disclaimer}
              </p>
            </div>

            {/* Coping & Grounding Technique + Trusted Contact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#E6E0D6]">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-[#101820] mb-2">
                  <Compass className="w-4 h-4 text-[#5FA88B]" />
                  <span>{t.copingToolsTitle}</span>
                </div>
                <ul className="space-y-1.5 text-xs text-[#5B6673]">
                  {t.copingTools.map((step: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5FA88B]" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-[#101820] mb-2">
                  <Users className="w-4 h-4 text-[#276E8B]" />
                  <span>{t.trustedContactTitle}</span>
                </div>
                <p className="text-xs text-[#5B6673] leading-relaxed">
                  {t.trustedContactText}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
