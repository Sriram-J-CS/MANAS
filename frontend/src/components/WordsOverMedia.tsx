import React, { useEffect, useRef, useState } from 'react';

interface WordsOverMediaProps {
  title: string;
  fragments: string[];
  bgImage?: string;
  onOpenDemo?: () => void;
}

export const WordsOverMedia: React.FC<WordsOverMediaProps> = ({
  title,
  fragments: propFragments,
  bgImage = '/assets/mascot/mascot_neutral.jpg',
}) => {
  const containerRef = useRef<HTMLElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMousePos({ x, y });
    };

    window.addEventListener('pointermove', onPointerMove);
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, []);

  const defaultTexts = [
    "we are listening",
    "before breaking point",
    "unconditional presence",
    "no judgement here",
    "tele-manas 14416",
    "forms follow empathy",
    "take one breath",
    "not a style, a perspective",
  ];

  const sourceTexts = propFragments && propFragments.length > 0 ? propFragments.slice(0, 8) : defaultTexts;

  const positions = [
    { top: '16%', left: '10%' },
    { top: '22%', right: '12%' },
    { top: '42%', left: '8%' },
    { top: '56%', right: '10%' },
    { top: '74%', left: '14%' },
    { top: '82%', right: '16%' },
    { top: '32%', left: '26%' },
    { top: '68%', right: '24%' },
  ];

  const fragmentPlacements = sourceTexts.map((text, idx) => ({
    text,
    ...positions[idx % positions.length],
  }));

  return (
    <section
      ref={containerRef}
      id="words-over-media"
      className="relative min-h-screen w-full bg-[#000000] text-[#ffffff] flex items-center justify-center overflow-hidden py-32 select-none"
    >
      {/* Full-bleed dark cinematic image */}
      <div className="absolute inset-0 z-0">
        {bgImage && (
          <img
            src={bgImage}
            alt="Backdrop"
            className="w-full h-full object-cover grayscale contrast-150 opacity-20"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#020508] via-[#09111d] to-[#010204]" />
        <div className="absolute inset-0 bg-radial from-transparent via-black/80 to-black pointer-events-none" />
      </div>

      {/* Center Small Text & Statement (NO buttons) */}
      <div className="relative z-10 text-center px-6 max-w-2xl">
        <span className="text-[11px] font-mono uppercase tracking-[0.12em] opacity-40 block mb-6">
          ( The Compass )
        </span>
        <h3 className="text-[clamp(28px,4.5vw,64px)] font-bold tracking-[-0.03em] leading-[1.05] text-white">
          {title || "WE CREATE COMPANIONS WORTH TRUSTING."}
        </h3>
        <p className="mt-6 text-sm sm:text-base font-medium text-white/70 max-w-md mx-auto leading-relaxed">
          We create mental health digital twin experiences for those ready to listen, reflect, and heal in quiet rooms.
        </p>
      </div>

      {/* Floating text lines that scramble/glitch into random characters reacting to cursor proximity */}
      {fragmentPlacements.map((frag, idx) => (
        <ScrambleFloatingText
          key={idx}
          text={frag.text}
          top={frag.top}
          left={frag.left}
          right={frag.right}
          mouseX={mousePos.x}
          mouseY={mousePos.y}
        />
      ))}
    </section>
  );
};

interface ScrambleTextProps {
  text: string;
  top?: string;
  left?: string;
  right?: string;
  mouseX: number;
  mouseY: number;
}

const ScrambleFloatingText: React.FC<ScrambleTextProps> = ({
  text,
  top,
  left,
  right,
  mouseX,
  mouseY,
}) => {
  const elRef = useRef<HTMLDivElement>(null);
  const [displayText, setDisplayText] = useState(text);
  const chars = '!<>-_\\/[]{}—=+*^?#________';

  useEffect(() => {
    if (!elRef.current) return;
    const rect = elRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dist = Math.hypot(mouseX - centerX, mouseY - centerY);

    // If cursor is within 180px, scramble letters into random characters
    if (dist < 180) {
      const scrambleRatio = 1 - dist / 180;
      const scrambled = text
        .split('')
        .map((c) =>
          c === ' '
            ? ' '
            : Math.random() < scrambleRatio
            ? chars[Math.floor(Math.random() * chars.length)]
            : c
        )
        .join('');
      setDisplayText(scrambled);
    } else {
      setDisplayText(text);
    }
  }, [mouseX, mouseY, text]);

  return (
    <div
      ref={elRef}
      className="absolute z-20 pointer-events-none font-mono text-[11px] sm:text-xs uppercase tracking-widest text-white/50 transition-colors duration-200 hidden sm:block select-none"
      style={{ top, left, right }}
    >
      <span className="hover:text-white">{displayText}</span>
    </div>
  );
};
