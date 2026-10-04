import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Language } from '../types';
import { translations } from '../content/translations';
import { Compass } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface StatementSectionProps {
  currentLang: Language;
}

export const StatementSection: React.FC<StatementSectionProps> = ({ currentLang }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const t = translations[currentLang].statement;

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        {
          opacity: 0.15,
          y: 40,
        },
        {
          opacity: 1,
          y: 0,
          duration: 1.2,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 75%',
            end: 'top 30%',
            scrub: 0.6,
          },
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [currentLang]);

  return (
    <section
      id="statement"
      ref={containerRef}
      className="py-24 md:py-36 bg-[#101820] text-[#E8EEF3] relative overflow-hidden"
    >
      {/* Decorative ambient elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#276E8B]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#5FA88B]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6 lg:px-8 relative z-10">
        {/* Monospaced Section Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#6FB7D3] border border-white/10 text-xs font-mono tracking-wider mb-8">
          <Compass className="w-3.5 h-3.5" />
          <span>{t.label}</span>
        </div>

        {/* Big Editorial Statement Text */}
        <div ref={textRef} className="space-y-8">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.2] text-white">
            {t.heading}
          </h2>

          <p className="text-xl sm:text-2xl md:text-3xl font-light text-[#A9B6C2] leading-relaxed">
            {t.p1}{' '}
            <span className="font-semibold text-white underline decoration-[#6FB7D3] underline-offset-8">
              {t.highlight1}
            </span>
          </p>

          <p className="text-lg sm:text-xl md:text-2xl font-light text-[#A9B6C2] leading-relaxed">
            {t.p2}{' '}
            <span className="font-medium text-[#6FBF9F]">
              {t.highlight2}
            </span>
          </p>

          <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
            <span className="text-xs sm:text-sm font-mono text-[#6FB7D3]">
              {t.subtext}
            </span>
            <span className="text-xs font-mono text-[#A9B6C2]/70">
              Intelligent Systems & Mental Health Computing
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
