import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface StatementProps {
  statement: string;
}

export const Statement: React.FC<StatementProps> = ({ statement }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const whiteTopRef = useRef<HTMLDivElement>(null);
  const floatingObjectsRef = useRef<HTMLDivElement>(null);
  const [mouseParallax, setMouseParallax] = useState({ x: 0, y: 0 });

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      if (headingRef.current) {
        const spans = headingRef.current.querySelectorAll('.word-span');
        spans.forEach((s) => ((s as HTMLElement).style.opacity = '1'));
      }
      return;
    }

    const words = headingRef.current?.querySelectorAll('.word-span');
    if (!words || words.length === 0 || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      // Word by word scroll reveal
      gsap.to(words, {
        opacity: 1,
        stagger: 0.12,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: headingRef.current,
          start: 'top 80%',
          end: 'bottom 60%',
          scrub: 1,
        },
      });

      // Floating 3D objects scroll parallax
      if (floatingObjectsRef.current) {
        const objects = floatingObjectsRef.current.querySelectorAll('.floating-3d-obj');
        objects.forEach((obj, idx) => {
          const speed = (idx + 1) * 35;
          gsap.to(obj, {
            yPercent: -speed,
            rotation: (idx % 2 === 0 ? 1 : -1) * 20,
            ease: 'none',
            scrollTrigger: {
              trigger: floatingObjectsRef.current,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          });
        });
      }
    }, sectionRef);

    // Mouse parallax listener
    const onMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      setMouseParallax({ x, y });
    };

    window.addEventListener('mousemove', onMouseMove);

    return () => {
      ctx.revert();
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [statement]);

  const words = statement.split(' ');

  return (
    <section ref={sectionRef} id="statement" className="w-full relative z-10 select-none">
      {/* Top Part: Big headline on pure White background */}
      <div
        ref={whiteTopRef}
        className="w-full bg-[#ffffff] text-[#000000] pt-28 pb-36 px-[6vw] flex flex-col justify-center border-b border-black/10"
      >
        <div className="max-w-[1360px] w-full mx-auto">
          <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-black/50 block mb-6">
            ( 02 / PHILOSOPHY )
          </span>
          <h2 className="text-[clamp(44px,7.8vw,120px)] leading-[0.92] tracking-[-0.04em] font-extrabold uppercase text-[#000000]">
            WE PREFER IDEAS.
          </h2>
          <p className="mt-6 text-[clamp(16px,1.6vw,26px)] leading-[1.25] font-medium text-black/70 max-w-[32ch]">
            Real emotional companion architecture over generic bots. True active empathy before burnout.
          </p>
        </div>
      </div>

      {/* Transition into Full-width Pure Black Panel with 3-4 Floating Glossy 3D Objects */}
      <div className="w-full bg-[#000000] text-[#ffffff] pt-24 pb-36 px-[6vw] relative overflow-hidden">
        {/* Floating Glossy 3D Objects drifting with mouse & scroll parallax */}
        <div
          ref={floatingObjectsRef}
          className="relative w-full h-[320px] sm:h-[400px] mb-20 pointer-events-none"
        >
          {/* Object 1: Black Balloon Star / Diamond */}
          <div
            className="floating-3d-obj absolute left-[8%] top-[15%] w-28 h-28 sm:w-36 sm:h-36 transition-transform duration-700 ease-out"
            style={{
              transform: `translate(${mouseParallax.x * 24}px, ${mouseParallax.y * 24}px)`,
            }}
          >
            <div className="w-full h-full rounded-3xl bg-gradient-to-tr from-[#111111] via-[#222222] to-[#444444] border border-white/30 shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_2px_10px_rgba(255,255,255,0.4)] rotate-45 flex items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-white/20 to-transparent blur-xs" />
            </div>
          </div>

          {/* Object 2: Blue Crumpled Foil */}
          <div
            className="floating-3d-obj absolute left-[42%] top-[5%] w-32 h-32 sm:w-44 sm:h-44 transition-transform duration-700 ease-out"
            style={{
              transform: `translate(${mouseParallax.x * -32}px, ${mouseParallax.y * -32}px)`,
            }}
          >
            <div className="w-full h-full rounded-[40px] bg-gradient-to-tr from-[#0a2540] via-[#1e40af] to-[#60a5fa] border border-cyan-300/40 shadow-[0_25px_60px_rgba(30,64,175,0.4),inset_0_4px_20px_rgba(255,255,255,0.6)] rotate-[-15deg] flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-white/25 blur-sm" />
            </div>
          </div>

          {/* Object 3: Chrome Bubble Heart / Sphere */}
          <div
            className="floating-3d-obj absolute right-[12%] top-[25%] w-36 h-36 sm:w-48 sm:h-48 transition-transform duration-700 ease-out"
            style={{
              transform: `translate(${mouseParallax.x * 28}px, ${mouseParallax.y * 28}px)`,
            }}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#222222] via-[#e5e5e5] to-[#ffffff] border border-white/60 shadow-[0_30px_70px_rgba(255,255,255,0.2),inset_0_8px_30px_rgba(255,255,255,0.9)] flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white/80 blur-xs -translate-x-3 -translate-y-3" />
            </div>
          </div>

          {/* Object 4: Foil Candy / Capsule */}
          <div
            className="floating-3d-obj absolute right-[35%] bottom-[10%] w-24 h-14 sm:w-32 sm:h-18 transition-transform duration-700 ease-out"
            style={{
              transform: `translate(${mouseParallax.x * -20}px, ${mouseParallax.y * -20}px)`,
            }}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-r from-[#831843] via-[#ec4899] to-[#f472b6] border border-pink-300/50 shadow-[0_15px_40px_rgba(236,72,153,0.35),inset_0_2px_12px_rgba(255,255,255,0.7)] rotate-[25deg]" />
          </div>
        </div>

        {/* Word-by-Word Scroll Reveal Statement */}
        <div className="max-w-[1360px] w-full mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.1em] opacity-40 mb-8 font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
            <span>( The Premise )</span>
          </div>
          <h3
            ref={headingRef}
            className="text-[clamp(32px,5.8vw,96px)] leading-[1.28] sm:leading-[1.22] md:leading-[1.18] tracking-[-0.015em] font-semibold text-[#ffffff] select-none break-words"
          >
            {words.map((word, index) => (
              <React.Fragment key={`${word}-${index}`}>
                <span className="word-span inline-block opacity-20 transition-opacity duration-200 will-change-[opacity] hover:opacity-100">
                  {word}
                </span>{' '}
              </React.Fragment>
            ))}
          </h3>

          <div className="mt-14 pt-8 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-white/40">
            <span>MANAS · PROACTIVE EMOTION MODELING</span>
            <span>COMPASSIONATE REFLECTION BEFORE BURNOUT</span>
          </div>
        </div>
      </div>
    </section>
  );
};
