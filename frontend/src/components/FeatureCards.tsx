import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Mic,
  PhoneCall,
  Sparkles,
} from 'lucide-react';
import type { Language } from '../types';
import { translations } from '../content/translations';

gsap.registerPlugin(ScrollTrigger);

interface FeatureCardsProps {
  currentLang: Language;
  onOpenDemo: () => void;
  onOpenHelp: () => void;
}

export const FeatureCards: React.FC<FeatureCardsProps> = ({
  currentLang,
  onOpenDemo,
  onOpenHelp,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const t = translations[currentLang].features;

  // State for interactive features
  const [interactiveMood, setInteractiveMood] = useState<number>(3);
  const [typingInput, setTypingInput] = useState<string>('');
  const [typingSpeed, setTypingSpeed] = useState<number>(0);
  const [selectedMascotPreview, setSelectedMascotPreview] = useState<'neutral' | 'happy' | 'concerned'>('neutral');

  const moodLevels = [
    { num: 1, emoji: '😔', label: 'Very Low', color: '#6C7FB8' },
    { num: 2, emoji: '🙁', label: 'Low', color: '#8FA7CC' },
    { num: 3, emoji: '😐', label: 'Okay', color: '#B8C4CE' },
    { num: 4, emoji: '🙂', label: 'Good', color: '#8CCBA9' },
    { num: 5, emoji: '😊', label: 'Great', color: '#5FB58C' },
  ];

  // GSAP Parallax and Staggered Scroll Animation
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        // Staggered parallax speed
        const speed = index % 2 === 0 ? 30 : -30;
        gsap.fromTo(
          card,
          { y: 50, opacity: 0.8 },
          {
            y: speed,
            opacity: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: card,
              start: 'top 85%',
              end: 'bottom 20%',
              scrub: 0.8,
            },
          }
        );
      });
    }, containerRef);

    return () => ctx.revert();
  }, [currentLang]);

  // Typing speed calculator for card 05
  const handleTypingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTypingInput(val);
    const chars = val.length;
    setTypingSpeed(Math.min(95, Math.floor(chars * 5.2)));
  };

  return (
    <section
      id="features"
      ref={containerRef}
      className="py-24 md:py-32 bg-[#FAF7F2] text-[#1F2A37] relative"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
          <span className="text-xs font-mono tracking-widest text-[#276E8B] uppercase font-bold bg-[#276E8B]/10 px-3 py-1 rounded-full border border-[#276E8B]/20">
            {t.sectionLabel}
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#101820] tracking-tight">
            {t.sectionTitle}
          </h2>
          <p className="mt-3.5 text-base sm:text-lg text-[#5B6673]">
            {t.sectionSubtitle}
          </p>
        </div>

        {/* Staggered Grid of 5 Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 items-start">
          {/* Card 1: Mascot (Lg Col 7) */}
          <div
            ref={(el) => { cardRefs.current[0] = el; }}
            className="lg:col-span-7 bg-white rounded-3xl p-8 border border-[#E6E0D6] shadow-soft hover:shadow-card-hover transition-all duration-300 group"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-xs font-bold text-[#276E8B] tracking-wider px-2.5 py-1 rounded-md bg-[#276E8B]/10">
                {t.cards.mascot.mono}
              </span>
              <span className="text-xs font-semibold text-[#5FA88B] bg-[#5FA88B]/10 px-3 py-1 rounded-full">
                {t.cards.mascot.badge}
              </span>
            </div>

            <h3 className="text-2xl font-bold text-[#101820]">
              {t.cards.mascot.title}
            </h3>

            {/* Required exact One Line */}
            <p className="mt-2 text-base font-medium text-[#276E8B]">
              {t.cards.mascot.line}
            </p>

            <p className="mt-3 text-sm text-[#5B6673] leading-relaxed">
              {t.cards.mascot.detail}
            </p>

            {/* Interactive Mascot Expression Showcase */}
            <div className="mt-6 pt-6 border-t border-[#E6E0D6] flex flex-col sm:flex-row items-center gap-6 bg-[#FAF7F2]/60 p-4 rounded-2xl">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-white shadow-md shrink-0 bg-white">
                <img
                  src={`/assets/mascot/mascot_${selectedMascotPreview}.jpg`}
                  alt="Mascot Expression"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 w-full text-center sm:text-left">
                <p className="text-xs font-mono text-[#5B6673] mb-2 font-semibold">
                  Test Mascot Facial States (v1):
                </p>
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  {(['neutral', 'happy', 'concerned'] as const).map((expr) => (
                    <button
                      key={expr}
                      onClick={() => setSelectedMascotPreview(expr)}
                      className={`text-xs px-3 py-1.5 rounded-full capitalize font-semibold transition-all ${
                        selectedMascotPreview === expr
                          ? 'bg-[#276E8B] text-white shadow-xs'
                          : 'bg-white text-[#5B6673] hover:text-[#101820] border border-[#E6E0D6]'
                      }`}
                    >
                      {expr}
                    </button>
                  ))}
                  <button
                    onClick={onOpenDemo}
                    className="text-xs px-3 py-1.5 rounded-full bg-[#276E8B]/10 hover:bg-[#276E8B]/20 text-[#276E8B] font-bold flex items-center gap-1 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Open Live Chat →</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Voice (Lg Col 5 - Staggered offset) */}
          <div
            ref={(el) => { cardRefs.current[1] = el; }}
            className="lg:col-span-5 md:mt-12 bg-white rounded-3xl p-8 border border-[#E6E0D6] shadow-soft hover:shadow-card-hover transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-xs font-bold text-[#A99BE0] tracking-wider px-2.5 py-1 rounded-md bg-[#A99BE0]/15">
                {t.cards.voice.mono}
              </span>
              <span className="text-xs font-semibold text-[#276E8B] bg-[#276E8B]/10 px-3 py-1 rounded-full">
                {t.cards.voice.badge}
              </span>
            </div>

            <h3 className="text-2xl font-bold text-[#101820]">
              {t.cards.voice.title}
            </h3>

            {/* Required exact One Line */}
            <p className="mt-2 text-base font-medium text-[#276E8B]">
              {t.cards.voice.line}
            </p>

            <p className="mt-3 text-sm text-[#5B6673] leading-relaxed">
              {t.cards.voice.detail}
            </p>

            <div className="mt-6 pt-5 border-t border-[#E6E0D6] flex items-center justify-between bg-[#FAF7F2] p-3.5 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#A99BE0]/25 text-[#276E8B] flex items-center justify-center">
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#101820]">Sarvam Saaras STT</p>
                  <p className="text-[11px] text-[#5B6673]">Whisper-Class Tamil & Tanglish</p>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-white px-2.5 py-1 rounded border border-[#E6E0D6] text-[#5B6673]">
                Latency &lt; 1s
              </span>
            </div>
          </div>

          {/* Card 3: Mood Twin (Lg Col 6) */}
          <div
            ref={(el) => { cardRefs.current[2] = el; }}
            className="lg:col-span-6 bg-white rounded-3xl p-8 border border-[#E6E0D6] shadow-soft hover:shadow-card-hover transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-xs font-bold text-[#5FA88B] tracking-wider px-2.5 py-1 rounded-md bg-[#5FA88B]/10">
                {t.cards.moodTwin.mono}
              </span>
              <span className="text-xs font-semibold text-[#5FA88B] bg-[#5FA88B]/10 px-3 py-1 rounded-full">
                {t.cards.moodTwin.badge}
              </span>
            </div>

            <h3 className="text-2xl font-bold text-[#101820]">
              {t.cards.moodTwin.title}
            </h3>

            {/* Required exact One Line */}
            <p className="mt-2 text-base font-medium text-[#276E8B]">
              {t.cards.moodTwin.line}
            </p>

            <p className="mt-3 text-sm text-[#5B6673] leading-relaxed">
              {t.cards.moodTwin.detail}
            </p>

            {/* Interactive 5-point Mood Scale from DESIGN.md */}
            <div className="mt-6 pt-5 border-t border-[#E6E0D6]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-[#5B6673] font-semibold">
                  DESIGN.md 5-Point Mood Scale:
                </span>
                <span className="text-xs font-bold text-[#101820]">
                  Level {interactiveMood}: {moodLevels[interactiveMood - 1].label}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {moodLevels.map((lvl) => (
                  <button
                    key={lvl.num}
                    onClick={() => setInteractiveMood(lvl.num)}
                    className={`flex flex-col items-center p-2 rounded-xl border transition-all ${
                      interactiveMood === lvl.num
                        ? 'border-2 scale-105 shadow-sm'
                        : 'border-[#E6E0D6] hover:bg-[#FAF7F2]'
                    }`}
                    style={{
                      borderColor: interactiveMood === lvl.num ? lvl.color : undefined,
                      backgroundColor: interactiveMood === lvl.num ? `${lvl.color}15` : undefined,
                    }}
                  >
                    <span className="text-xl">{lvl.emoji}</span>
                    <span className="text-[10px] font-mono mt-1 font-semibold text-[#1F2A37]">
                      {lvl.num}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Card 4: Safety (Lg Col 6 - Staggered) */}
          <div
            ref={(el) => { cardRefs.current[3] = el; }}
            className="lg:col-span-6 md:mt-10 bg-white rounded-3xl p-8 border border-[#E6E0D6] shadow-soft hover:shadow-card-hover transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-xs font-bold text-[#B84A33] tracking-wider px-2.5 py-1 rounded-md bg-[#B84A33]/10">
                {t.cards.safety.mono}
              </span>
              <span className="text-xs font-semibold text-[#B84A33] bg-[#B84A33]/10 px-3 py-1 rounded-full">
                {t.cards.safety.badge}
              </span>
            </div>

            <h3 className="text-2xl font-bold text-[#101820]">
              {t.cards.safety.title}
            </h3>

            {/* Required exact One Line */}
            <p className="mt-2 text-base font-medium text-[#276E8B]">
              {t.cards.safety.line}
            </p>

            <p className="mt-3 text-sm text-[#5B6673] leading-relaxed">
              {t.cards.safety.detail}
            </p>

            {/* Quick Helpline Direct Access Card */}
            <div className="mt-6 pt-5 border-t border-[#E6E0D6] flex items-center justify-between bg-[#B84A33]/5 border border-[#B84A33]/20 p-4 rounded-2xl">
              <div>
                <p className="text-xs font-mono uppercase text-[#B84A33] font-bold">
                  24/7 National Emergency
                </p>
                <p className="text-lg font-black text-[#B84A33]">Tele-MANAS: 14416</p>
                <p className="text-[11px] text-[#5B6673]">Emergency: 112</p>
              </div>

              <button
                onClick={onOpenHelp}
                className="px-4 py-2 rounded-full bg-[#B84A33] hover:bg-[#A03E29] text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call Help</span>
              </button>
            </div>
          </div>

          {/* Card 5: Languages (Lg Col 12 - Full Width Feature) */}
          <div
            ref={(el) => { cardRefs.current[4] = el; }}
            className="lg:col-span-12 bg-white rounded-3xl p-8 border border-[#E6E0D6] shadow-soft hover:shadow-card-hover transition-all duration-300"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <span className="font-mono text-xs font-bold text-[#276E8B] tracking-wider px-2.5 py-1 rounded-md bg-[#276E8B]/10">
                  {t.cards.languages.mono}
                </span>
                <h3 className="mt-2 text-2xl font-bold text-[#101820]">
                  {t.cards.languages.title}
                </h3>
                {/* Required exact One Line */}
                <p className="mt-1 text-base font-medium text-[#276E8B]">
                  {t.cards.languages.line}
                </p>
              </div>

              <span className="text-xs font-semibold text-[#5FA88B] bg-[#5FA88B]/10 px-3 py-1 rounded-full self-start md:self-auto">
                {t.cards.languages.badge}
              </span>
            </div>

            <p className="text-sm text-[#5B6673] leading-relaxed max-w-4xl">
              {t.cards.languages.detail}
            </p>

            {/* Live Typing Cadence Simulator Box */}
            <div className="mt-6 pt-5 border-t border-[#E6E0D6] bg-[#FAF7F2] p-5 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <span className="text-xs font-mono font-bold text-[#101820]">
                  Try Typing Dynamics Simulator:
                </span>
                <span className="text-xs font-mono text-[#276E8B] font-semibold">
                  Cadence: {typingSpeed > 40 ? 'Fast/Direct Reply Mode' : typingSpeed > 10 ? 'Balanced Pace Mode' : 'Calm/Spacious Mode'} ({typingSpeed} WPM)
                </span>
              </div>

              <input
                type="text"
                value={typingInput}
                onChange={handleTypingChange}
                placeholder="Type a sentence here to see real-time typing dynamics adaptation..."
                className="w-full px-4 py-2.5 rounded-xl border border-[#E6E0D6] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#276E8B]"
              />

              <div className="mt-3 flex items-center justify-between text-xs text-[#5B6673] font-mono">
                <span>Characters: {typingInput.length}</span>
                <span>Tamil / English script preserved</span>
                <span>Zero hostility mirroring</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
