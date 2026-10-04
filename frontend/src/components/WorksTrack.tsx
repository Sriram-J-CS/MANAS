import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Volume2, VolumeX } from 'lucide-react';
import type { WorkItem } from '../content/site.config';

interface WorksTrackProps {
  works: WorkItem[];
  worksCount: string;
  headTitle: string;
  headYear: string;
  onSelectWork: (item: WorkItem) => void;
  onHoverWork: (hovering: boolean, text?: string) => void;
}

export const WorksTrack: React.FC<WorksTrackProps> = ({
  works,
  worksCount,
  headTitle,
  headYear,
  onSelectWork,
  onHoverWork,
}) => {
  const containerRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSound, setVideoSound] = useState(false);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add('(min-width: 768px)', () => {
        const track = trackRef.current;
        const container = containerRef.current;
        if (!track || !container) return;

        const totalScroll = track.scrollWidth - window.innerWidth + 140;

        gsap.to(track, {
          x: () => -totalScroll,
          ease: 'none',
          scrollTrigger: {
            trigger: container,
            start: 'top top',
            end: () => `+=${totalScroll}`,
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });
      });
    }, containerRef);

    return () => ctx.revert();
  }, [works]);

  const toggleVideoSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setVideoSound(!videoRef.current.muted);
    }
  };

  return (
    <section
      ref={containerRef}
      id="works"
      className="relative w-full bg-[#000000] text-[#ffffff] min-h-screen md:h-screen md:overflow-hidden select-none z-20"
    >
      {/* Works Header Row: Small logo + "WORKS", "View all →", counter "(07)" in center, "© 24.26" on right */}
      <div className="absolute top-[28px] md:top-[44px] left-[22px] right-[22px] z-30 flex items-center justify-between text-[11px] sm:text-[13px] font-mono uppercase pointer-events-auto">
        <div className="flex items-center gap-4">
          <span className="font-extrabold tracking-tight text-white font-sans text-sm sm:text-base">
            MANAS′ {headTitle}
          </span>
          <span className="opacity-30">/</span>
          <a
            href="#works"
            className="hover:opacity-60 transition-opacity underline decoration-white/40 underline-offset-4 hidden sm:inline"
          >
            View all →
          </a>
        </div>

        <div className="font-bold tracking-widest text-white/70">
          {worksCount || '(07)'}
        </div>

        <div className="opacity-60 font-mono tracking-widest">
          {headYear || '© 24.26'}
        </div>
      </div>

      {/* Track: Horizontal scroll on desktop, vertical on mobile */}
      <div
        ref={trackRef}
        id="track"
        className="flex flex-col md:flex-row items-center gap-14 md:gap-[5vw] h-auto md:h-full pt-32 md:pt-16 pb-20 md:pb-8 px-[6vw] md:px-[8vw] md:w-max"
      >
        {works.map((item, index) => {
          const isEven = index % 2 === 1;
          const [g1, g2, g3] = item.gradient || ['#1a1a1a', '#333333', '#0a0a0a'];

          return (
            <div
              key={item.id}
              onClick={() => onSelectWork(item)}
              onMouseEnter={() => onHoverWork(true, `EXPLORE →`)}
              onMouseLeave={() => onHoverWork(false)}
              className={`w-full max-w-[420px] md:w-[clamp(300px,29vw,450px)] flex-none cursor-pointer group transition-transform duration-500 ${
                isEven ? 'md:translate-y-[6vh]' : 'md:-translate-y-[4vh]'
              }`}
            >
              {/* Card Header: Tiny monospaced category label */}
              <div className="mb-2 flex items-center justify-between text-[10px] font-mono tracking-widest text-white/50 uppercase">
                <span>{item.tag}</span>
                <span className="group-hover:text-white transition-colors">↗</span>
              </div>

              {/* One-line description in white (~20px) */}
              <h4 className="text-[clamp(16px,1.35vw,21px)] leading-[1.2] font-semibold text-white tracking-[-0.02em] mb-3 group-hover:text-white transition-colors">
                {item.line}
              </h4>

              {/* Image Tile: 4/5 Aspect Ratio, Image scales subtly on hover */}
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#0d0d0d] border border-white/10 group-hover:border-white/40 transition-colors">
                {item.img ? (
                  <img
                    src={item.img}
                    alt={item.title}
                    className="w-full h-full object-cover grayscale contrast-125 group-hover:scale-[1.04] transition-all duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)]"
                  />
                ) : (
                  <div
                    className="w-full h-full flex flex-col items-center justify-center p-8 group-hover:scale-[1.04] transition-transform duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)]"
                    style={{
                      background: `linear-gradient(135deg, ${g1}, ${g2} 40%, ${g3})`,
                    }}
                  >
                    <span className="text-6xl font-black tracking-tighter opacity-80 text-white font-mono">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="mt-4 text-xs font-mono uppercase tracking-widest opacity-70 text-center">
                      {item.title}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Full-bleed video section with small SOUND toggle pill at top center */}
        <div
          className="w-full max-w-[500px] md:w-[clamp(440px,42vw,620px)] aspect-[16/10] flex-none relative overflow-hidden border border-white/20 bg-neutral-950 group cursor-pointer"
          onMouseEnter={() => onHoverWork(true, 'SOUND ON')}
          onMouseLeave={() => onHoverWork(false)}
        >
          {/* SOUND toggle pill at top center */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
            <button
              onClick={toggleVideoSound}
              className="px-3.5 py-1 rounded-full bg-black/85 backdrop-blur-md border border-white/30 text-white text-[10px] font-mono uppercase tracking-widest flex items-center gap-1.5 hover:bg-white hover:text-black transition-all cursor-pointer shadow-lg"
              title="Toggle sound"
            >
              {videoSound ? <Volume2 className="w-3 h-3 text-emerald-400" /> : <VolumeX className="w-3 h-3" />}
              <span>SOUND {videoSound ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <video
            ref={videoRef}
            src="/assets/mascot/calm_ambient.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover grayscale contrast-125 opacity-85 group-hover:scale-105 transition-transform duration-700"
          />

          <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between text-[11px] font-mono uppercase text-white/70">
            <span>FULL BLEED · EMOTION TELEMETRY</span>
            <span className="font-bold text-white">432Hz HARMONICS</span>
          </div>
        </div>
      </div>
    </section>
  );
};
