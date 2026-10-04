import React from 'react';
import { Layers, ShieldCheck, Sparkles } from 'lucide-react';
import type { Language } from '../types';
import { translations } from '../content/translations';

interface TeamSectionProps {
  currentLang: Language;
}

export const TeamSection: React.FC<TeamSectionProps> = ({ currentLang }) => {
  const t = translations[currentLang].team;

  return (
    <section id="team" className="py-24 md:py-32 bg-[#000000] text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-mono tracking-wider text-cyan-300 mb-4">
            <Layers className="w-3.5 h-3.5" />
            <span>LAB ARCHITECTURE & PILLARS</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            {t.title}
          </h2>
          <p className="mt-3 text-base sm:text-lg text-white/60">
            {t.subtitle}
          </p>
        </div>

        {/* Lab Overview Card */}
        <div className="max-w-3xl mx-auto mb-14 bg-white/5 rounded-3xl p-8 border border-white/15 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-cyan-950 border border-cyan-400/40 text-cyan-300 flex items-center justify-center shrink-0 shadow-lg">
            <Sparkles className="w-10 h-10" />
          </div>

          <div className="flex-1 text-center sm:text-left">
            <span className="text-xs font-mono font-bold uppercase text-cyan-300 tracking-wider">
              {t.guideLabel}
            </span>
            <h3 className="text-2xl font-bold text-white mt-1">
              {t.guideName}
            </h3>
            <p className="text-sm font-medium text-white/70 mt-1">
              {t.guideTitle}
            </p>
            <p className="text-xs text-white/50 mt-2 font-mono">
              {t.dept} · {t.school}
            </p>
          </div>

          <div className="shrink-0 bg-white/10 px-3.5 py-2 rounded-xl border border-white/20 text-xs font-mono text-emerald-400 font-bold">
            Institutional Research
          </div>
        </div>

        {/* 5 Computational Research Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {t.members.map((pillar: any, idx: number) => (
            <div
              key={pillar.regNo || idx}
              className={`bg-white/5 rounded-3xl p-6 border border-white/15 hover:border-cyan-400/50 transition-all duration-300 flex flex-col justify-between group ${
                idx === 0 ? 'md:col-span-2 lg:col-span-1 bg-gradient-to-b from-white/10 to-white/5' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center font-mono font-bold text-xs text-cyan-300">
                    0{idx + 1}
                  </span>
                  <span className="text-xs font-mono text-white/50 bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
                    Core Pillar
                  </span>
                </div>

                <h4 className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {pillar.name}
                </h4>

                <p className="text-xs font-semibold text-cyan-400 mt-1 font-mono">
                  {pillar.role}
                </p>

                <p className="mt-3 text-sm text-white/70 leading-relaxed">
                  {pillar.bio}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/50">
                <span>Computational Health</span>
                <span className="text-emerald-400 font-semibold">Active Verification</span>
              </div>
            </div>
          ))}
        </div>

        {/* Clinical Note */}
        <div className="mt-14 max-w-4xl mx-auto p-6 rounded-2xl bg-emerald-950/20 border border-emerald-400/30 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-mono uppercase font-bold text-emerald-300 tracking-wider">
              Safety & Clinical Advisory Note
            </span>
            <p className="mt-1 text-xs text-white/80 leading-relaxed">
              {t.clinicalNote}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
