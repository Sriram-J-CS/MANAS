import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { SiteConfig } from '../content/site.config';

interface StudioProps {
  studio: SiteConfig['studio'];
}

export const Studio: React.FC<StudioProps> = ({ studio }) => {
  const containerRef = useRef<HTMLElement>(null);
  const heroImageRef = useRef<HTMLDivElement>(null);
  const scrollTextRef = useRef<HTMLDivElement>(null);
  const parallaxImg1Ref = useRef<HTMLDivElement>(null);
  const parallaxImg2Ref = useRef<HTMLDivElement>(null);
  const parallaxImg3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      // Parallax on top hero image
      if (heroImageRef.current) {
        gsap.to(heroImageRef.current, {
          yPercent: 18,
          ease: 'none',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top bottom',
            end: 'center top',
            scrub: true,
          },
        });
      }

      // Parallax images floating at different speeds
      if (parallaxImg1Ref.current) {
        gsap.to(parallaxImg1Ref.current, {
          yPercent: -35,
          ease: 'none',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        });
      }

      if (parallaxImg2Ref.current) {
        gsap.to(parallaxImg2Ref.current, {
          yPercent: 42,
          ease: 'none',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        });
      }

      if (parallaxImg3Ref.current) {
        gsap.to(parallaxImg3Ref.current, {
          yPercent: -20,
          ease: 'none',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        });
      }

      // Scroll-driven text reveal (words fade in one by one)
      if (scrollTextRef.current) {
        const words = scrollTextRef.current.querySelectorAll('.studio-word');
        gsap.to(words, {
          opacity: 1,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: scrollTextRef.current,
            start: 'top 85%',
            end: 'bottom 60%',
            scrub: 1,
          },
        });
      }
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const revealSentence = "Forms follow emotional honesty. We build spaces where vulnerability meets computational dignity.";
  const revealWords = revealSentence.split(' ');

  return (
    <section
      ref={containerRef}
      id="studio"
      className="relative min-h-[160vh] w-full bg-[#000000] text-[#ffffff] pt-0 pb-[24vh] px-[6vw] overflow-hidden select-none"
    >
      {/* Hero-scale image at the top fading into black at the bottom */}
      <div className="relative w-full h-[55vh] sm:h-[70vh] -mx-[6vw] overflow-hidden mb-16">
        <div ref={heroImageRef} className="absolute inset-0 w-full h-[120%] -top-[10%]">
          <div className="w-full h-full bg-gradient-to-tr from-pink-900/40 via-purple-900/20 to-neutral-900 flex items-center justify-center">
            {/* Glossy inflatable architecture mockup */}
            <div className="w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-gradient-to-tr from-pink-500 via-rose-400 to-purple-300 blur-xs shadow-[0_0_120px_rgba(244,114,182,0.4)] opacity-85" />
          </div>
        </div>
        {/* Soft fade into pure black */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-[#000000] pointer-events-none" />
      </div>

      {/* Main Studio Row: Left small label, Right large-ish paragraph + wide landscape image */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start relative z-10">
        <div className="md:col-span-4">
          <span className="text-[12px] font-mono tracking-widest uppercase opacity-60">
            {studio.label || '( The Studio )'}
          </span>
          <div className="mt-8 space-y-2">
            <p className="text-[11px] font-mono uppercase tracking-wider text-white/50">
              AI Emotional Wellness Research
            </p>
            <p className="text-sm font-bold text-white tracking-tight">
              Intelligent Systems & Mental Health Computing Lab
            </p>
            <p className="text-xs text-white/60 font-mono">
              Proactive Conversational Empathy
            </p>
          </div>
        </div>

        <div className="md:col-span-8 flex flex-col items-start md:items-end">
          <p className="max-w-[34ch] text-[clamp(20px,2vw,28px)] leading-[1.2] font-medium tracking-[-0.03em] text-[#ffffff] md:text-right">
            {studio.body}
          </p>

          {/* Research Architecture Pillar Chips (NO personal names) */}
          <div className="mt-8 flex flex-wrap gap-2 justify-start md:justify-end max-w-[560px]">
            {studio.members.map((m, idx) => (
              <span
                key={idx}
                className="px-3 py-1 rounded-full border border-white/20 text-[10px] font-mono uppercase tracking-wider text-white/80 hover:border-white/50 transition-colors"
              >
                {m.name} · {m.role}
              </span>
            ))}
          </div>

          {/* Wide Landscape Image beneath paragraph */}
          <div className="w-full mt-12 aspect-[16/8] sm:aspect-[16/7] rounded-none overflow-hidden border border-white/15 bg-neutral-950 shadow-2xl relative group">
            <div className="w-full h-full bg-gradient-to-r from-neutral-900 via-neutral-800 to-black p-8 flex flex-col justify-end">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/50 mb-1">
                LAB ARCHIVE · COMPUTATIONAL COHESION
              </span>
              <p className="text-base sm:text-lg font-semibold text-white tracking-tight">
                7-day rolling equilibrium vs single-point emotional diagnosis.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scattered images with different sizes and scroll-speed parallax, small captions */}
      <div className="relative my-[16vh] h-[260px] pointer-events-none hidden md:block">
        <div
          ref={parallaxImg1Ref}
          className="absolute left-[6%] top-0 w-[200px] aspect-[4/5] overflow-hidden border border-white/20 bg-neutral-900 shadow-2xl"
        >
          <div className="w-full h-full bg-gradient-to-tr from-cyan-950 via-neutral-900 to-black p-4 flex flex-col justify-between">
            <span className="text-[9px] font-mono uppercase text-cyan-400">01 / DYNAMICS</span>
            <div className="w-12 h-12 rounded-full bg-cyan-400/20 blur-sm" />
          </div>
          <div className="absolute bottom-1.5 left-2 text-[9px] font-mono uppercase tracking-widest text-white/60">
            or something unexpected.
          </div>
        </div>

        <div
          ref={parallaxImg2Ref}
          className="absolute right-[14%] top-6 w-[240px] aspect-[4/5] overflow-hidden border border-white/20 bg-neutral-900 shadow-2xl"
        >
          <div className="w-full h-full bg-gradient-to-tr from-purple-950 via-neutral-900 to-black p-4 flex flex-col justify-between">
            <span className="text-[9px] font-mono uppercase text-purple-400">02 / CADENCE</span>
            <div className="w-16 h-16 rounded-full bg-purple-400/20 blur-sm" />
          </div>
          <div className="absolute bottom-1.5 left-2 text-[9px] font-mono uppercase tracking-widest text-white/60">
            rhythm in silence.
          </div>
        </div>

        <div
          ref={parallaxImg3Ref}
          className="absolute left-[44%] -top-10 w-[160px] aspect-[1/1] overflow-hidden border border-white/20 bg-neutral-900 shadow-2xl"
        >
          <div className="w-full h-full bg-gradient-to-tr from-emerald-950 via-neutral-900 to-black p-3 flex flex-col justify-between">
            <span className="text-[8px] font-mono uppercase text-emerald-400">03 / TELE-MANAS</span>
          </div>
          <div className="absolute bottom-1.5 left-2 text-[8px] font-mono uppercase tracking-widest text-white/60">
            guarded peace.
          </div>
        </div>
      </div>

      {/* Large scroll-driven text reveal in giant type, bottom-left */}
      <div className="mt-[16vh] md:mt-[24vh] max-w-4xl text-left">
        <div className="text-[11px] font-mono uppercase tracking-widest opacity-40 mb-4">
          ( The Manifesto )
        </div>
        <div
          ref={scrollTextRef}
          className="text-[clamp(36px,6vw,90px)] tracking-[-0.04em] leading-[0.96] font-extrabold uppercase break-words text-[#ffffff]"
        >
          {revealWords.map((word, i) => (
            <React.Fragment key={i}>
              <span className="studio-word inline-block opacity-20 transition-opacity duration-150">
                {word}
              </span>{' '}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
};
