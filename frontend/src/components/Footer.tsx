import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { SiteConfig } from '../content/site.config';

interface FooterProps {
  footer: SiteConfig['footer'];
  onOpenDemo?: () => void;
  onOpenHelp?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ footer }) => {
  const footerRef = useRef<HTMLElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const el = wordmarkRef.current;
    const footerEl = footerRef.current;
    if (!el || !footerEl) return;

    const ctx = gsap.context(() => {
      gsap.from(el, {
        yPercent: 30,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: footerEl,
          start: 'top bottom',
          end: 'bottom bottom',
          scrub: 1,
        },
      });
    }, footerRef);

    return () => ctx.revert();
  }, []);

  const brandLetters = (footer.wordmark || "MANAS").split('');

  const links = [
    { label: "Tele-MANAS 14416 (24/7)", href: "tel:14416" },
    { label: "National Emergency 112", href: "tel:112" },
  ];

  return (
    <footer
      ref={footerRef}
      id="contact"
      className="relative min-h-screen w-full bg-[#000000] text-[#ffffff] p-[22px] sm:p-[32px] flex flex-col justify-between overflow-hidden select-none z-10"
    >
      {/* Top Part: Big white headline top-left, right column stacked plain text links (NO buttons) */}
      <div className="pt-14 md:pt-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Top-Left Headline */}
          <div className="lg:col-span-8">
            <h3 className="text-[clamp(36px,5.8vw,88px)] leading-[0.93] tracking-[-0.04em] font-extrabold text-[#ffffff] max-w-[15ch]">
              Let’s start with MANAS
            </h3>
            <p className="mt-6 text-sm sm:text-base font-medium text-white/50 max-w-md leading-relaxed">
              Academic computational emotion research & 24/7 crisis safety guardrails. Zero judgment, verified empathy.
            </p>
          </div>

          {/* Right Column: Plain text links stacked, ~20px (NO buttons) */}
          <div className="lg:col-span-4 flex flex-col items-start lg:items-end space-y-3 pt-2">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-[clamp(17px,1.4vw,21px)] font-medium text-white/80 hover:text-white hover:underline underline-offset-4 decoration-white/40 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Giant White Wordmark at the bottom: Individual letters stretch taller (scaleY) on hover */}
      <div className="w-full overflow-hidden mt-16 md:mt-24">
        <div
          ref={wordmarkRef}
          className="flex justify-between items-baseline w-full text-[21.5vw] font-black tracking-[-0.07em] leading-[0.78] text-[#ffffff] whitespace-nowrap ml-[-0.03em] select-none uppercase will-change-transform"
        >
          {brandLetters.map((char, idx) => {
            const isHovered = hoveredIndex === idx;
            const isNear =
              hoveredIndex !== null && Math.abs(hoveredIndex - idx) === 1;

            return (
              <span
                key={idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  display: 'inline-block',
                  transformOrigin: 'bottom center',
                  transform: isHovered
                    ? 'scaleY(1.4) translateY(-8%)'
                    : isNear
                    ? 'scaleY(1.18) translateY(-4%)'
                    : 'scaleY(1) translateY(0)',
                  transition: 'transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
                  marginRight: char === ' ' ? '0.25em' : '0',
                }}
                className="cursor-default hover:text-white"
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            );
          })}
        </div>

        {/* Bottom credit row in tiny text (NO teammate or guide names) */}
        <div className="mt-8 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-widest text-white/45">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <span>©2026 — Founded by Autonomous Collective</span>
            <span>Site by Intelligent Systems Lab</span>
            <span>Visuals by Research Media</span>
          </div>

          {/* Far-Right Black Pill "EN" */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-neutral-900 border border-white/20 text-white font-bold text-[9px] tracking-widest">
              EN
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
