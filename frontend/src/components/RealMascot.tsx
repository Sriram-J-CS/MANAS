import React, { useState, useEffect, useRef } from 'react';
import type { MascotExpression } from '../types';

export type MascotTheme = 'cyber_manas' | 'zen_sage' | 'aura_cloud' | 'solar_nova' | 'digital_twin' | 'bot' | 'boy' | 'girl';

interface RealMascotProps {
  expression?: MascotExpression;
  isSpeaking?: boolean;
  avatarType?: MascotTheme | string;
  avatarUrl?: string; // Kept for interface compatibility, but we render real mascot!
  size?: 'sm' | 'md' | 'lg' | 'xl';
  interactive?: boolean;
  onWave?: () => void;
  className?: string;
}

export const RealMascot: React.FC<RealMascotProps> = ({
  expression = 'neutral',
  isSpeaking = false,
  avatarType = 'cyber_manas',
  size = 'md',
  interactive = true,
  onWave,
  className = '',
}) => {
  const [mouthOpen, setMouthOpen] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isWaving, setIsWaving] = useState(false);
  const [eyeX, setEyeX] = useState(0);
  const [eyeY, setEyeY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lip-sync mouth movement when speaking
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isSpeaking) {
      interval = setInterval(() => {
        setMouthOpen((prev) => !prev);
      }, 125);
    } else {
      setMouthOpen(false);
    }
    return () => clearInterval(interval);
  }, [isSpeaking]);

  // Natural spontaneous eye blink every 3.5 - 4.5 seconds
  useEffect(() => {
    const blinkTimer = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 170);
    }, 3800);
    return () => clearInterval(blinkTimer);
  }, []);

  // Smooth mouse/touch tracking for pupils
  useEffect(() => {
    if (!interactive) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const dx = (clientX - centerX) / (window.innerWidth / 2);
      const dy = (clientY - centerY) / (window.innerHeight / 2);

      setEyeX(Math.max(-5, Math.min(5, dx * 5)));
      setEyeY(Math.max(-4, Math.min(4, dy * 4)));
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
    };
  }, [interactive]);

  const triggerWave = () => {
    setIsWaving(true);
    onWave?.();
    setTimeout(() => setIsWaving(false), 1800);
  };

  // Dimensions based on size prop
  const sizeClasses = {
    sm: 'w-16 h-20',
    md: 'w-36 h-44',
    lg: 'w-60 h-72',
    xl: 'w-72 h-84',
  }[size] || 'w-36 h-44';

  const headSizes = {
    sm: 'w-14 h-14 rounded-2xl p-1',
    md: 'w-28 h-28 sm:w-32 sm:h-32 rounded-[32px] p-2.5',
    lg: 'w-44 h-44 sm:w-52 sm:h-52 rounded-[44px] p-4',
    xl: 'w-56 h-56 rounded-[48px] p-5',
  }[size] || 'w-28 h-28 rounded-[32px] p-2.5';

  // Mascot Color & Aura Themes
  const theme =
    avatarType === 'zen_sage' || avatarType === 'girl'
      ? {
          primary: '#10b981', // Emerald
          glow: 'from-emerald-400/40 via-teal-500/25 to-transparent',
          headBorder: 'border-emerald-400/80',
          headBg: 'from-[#0b241b] via-[#071711] to-[#030906]',
          eyeColor: 'bg-emerald-300 shadow-[0_0_12px_#34d399]',
          cheekColor: 'bg-emerald-400/40',
          heartCore: 'bg-emerald-400 shadow-[0_0_14px_#34d399]',
          earColor: 'bg-emerald-400',
          armBg: 'from-emerald-400 to-[#071711]',
        }
      : avatarType === 'aura_cloud'
      ? {
          primary: '#c084fc', // Purple/Violet
          glow: 'from-purple-400/40 via-fuchsia-500/25 to-transparent',
          headBorder: 'border-purple-400/80',
          headBg: 'from-[#1c112e] via-[#10091c] to-[#06030a]',
          eyeColor: 'bg-purple-300 shadow-[0_0_12px_#c084fc]',
          cheekColor: 'bg-fuchsia-400/50',
          heartCore: 'bg-fuchsia-400 shadow-[0_0_14px_#e879f9]',
          earColor: 'bg-purple-400',
          armBg: 'from-purple-400 to-[#10091c]',
        }
      : avatarType === 'solar_nova'
      ? {
          primary: '#f59e0b', // Amber/Gold
          glow: 'from-amber-400/40 via-orange-500/25 to-transparent',
          headBorder: 'border-amber-400/80',
          headBg: 'from-[#2b1b08] via-[#1a1005] to-[#0a0602]',
          eyeColor: 'bg-amber-300 shadow-[0_0_12px_#fbbf24]',
          cheekColor: 'bg-orange-400/50',
          heartCore: 'bg-amber-400 shadow-[0_0_14px_#f59e0b]',
          earColor: 'bg-amber-400',
          armBg: 'from-amber-400 to-[#1a1005]',
        }
      : {
          // Default: Cyber MANAS
          primary: '#22d3ee', // Cyan
          glow: 'from-cyan-400/40 via-blue-500/25 to-transparent',
          headBorder: 'border-cyan-400/80',
          headBg: 'from-[#0e1d2c] via-[#09131d] to-[#04080c]',
          eyeColor: 'bg-cyan-300 shadow-[0_0_12px_#22d3ee]',
          cheekColor: 'bg-pink-500/45',
          heartCore: 'bg-cyan-400 shadow-[0_0_14px_#38bdf8]',
          earColor: 'bg-cyan-400',
          armBg: 'from-cyan-400 to-[#09131d]',
        };

  // Expression Eyebrows Tilt
  const eyebrowLeft =
    expression === 'concerned'
      ? 'rotate-[14deg] -translate-y-0.5'
      : expression === 'happy'
      ? 'rotate-[-8deg] -translate-y-1'
      : 'rotate-0 translate-y-0';

  const eyebrowRight =
    expression === 'concerned'
      ? 'rotate-[-14deg] -translate-y-0.5'
      : expression === 'happy'
      ? 'rotate-[8deg] -translate-y-1'
      : 'rotate-0 translate-y-0';

  return (
    <div
      ref={containerRef}
      onClick={triggerWave}
      className={`relative flex flex-col items-center justify-center select-none cursor-pointer group ${sizeClasses} ${className}`}
      title="Click me to wave and interact!"
    >
      {/* Dynamic Ambient Energy Halo */}
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-tr ${theme.glow} blur-2xl transition-all duration-700 opacity-75 group-hover:opacity-100 animate-pulse`}
      />

      {/* Floating Animated Mascot Body */}
      <div
        className={`relative z-10 flex flex-col items-center animate-[mascotFloat_3.2s_ease-in-out_infinite] ${
          isWaving ? 'animate-[mascotWave_1.8s_ease-in-out]' : ''
        }`}
      >
        {/* Antennae / Ears with organic sway */}
        <div className="flex items-center gap-6 mb-[-6px] z-0">
          <div
            className={`w-1.5 h-4 sm:h-5 ${theme.earColor} rounded-full rotate-[-18deg] origin-bottom animate-[earWiggle_2.8s_ease-in-out_infinite] shadow-sm`}
          />
          <div
            className={`w-1.5 h-4 sm:h-5 ${theme.earColor} rounded-full rotate-[18deg] origin-bottom animate-[earWiggle_2.8s_ease-in-out_infinite_delay-150] shadow-sm`}
          />
        </div>

        {/* Mascot Head & Living Visor */}
        <div
          className={`relative ${headSizes} bg-gradient-to-b ${theme.headBg} border-2 ${theme.headBorder} shadow-2xl flex flex-col items-center justify-center overflow-hidden transition-all duration-300`}
        >
          {/* Subtle Inner Glass Specular */}
          <div className="absolute inset-1 rounded-[inherit] bg-gradient-to-br from-white/15 to-transparent pointer-events-none" />

          {/* Living Robot Visor Face (NO human photo image) */}
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            {/* Eyebrows with emotional angle */}
            <div className="flex justify-between w-3/4 px-1 mb-1 transition-all duration-300">
              <div
                className={`w-3.5 sm:w-5 h-1 ${theme.earColor} rounded-full transition-all duration-200 ${eyebrowLeft}`}
              />
              <div
                className={`w-3.5 sm:w-5 h-1 ${theme.earColor} rounded-full transition-all duration-200 ${eyebrowRight}`}
              />
            </div>

            {/* Expressive Glowing Eyes with Mouse Pupil Tracking */}
            <div className="flex items-center gap-3 sm:gap-5 my-0.5 sm:my-1">
              {/* Left Eye */}
              <div className="relative w-6 h-8 sm:w-8 sm:h-11 rounded-full bg-black/90 border-2 border-white/30 overflow-hidden shadow-inner flex items-center justify-center">
                <div
                  className={`w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full ${theme.eyeColor} transition-transform duration-75 flex items-center justify-center`}
                  style={{ transform: `translate(${eyeX}px, ${eyeY}px)` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-white ml-[-1px] mt-[-1px]" />
                </div>
                {/* Blinking Eyelid */}
                <div
                  className={`absolute inset-0 bg-[#080d14] transition-transform duration-100 ${
                    isBlinking ? 'translate-y-0' : '-translate-y-full'
                  }`}
                />
              </div>

              {/* Right Eye */}
              <div className="relative w-6 h-8 sm:w-8 sm:h-11 rounded-full bg-black/90 border-2 border-white/30 overflow-hidden shadow-inner flex items-center justify-center">
                <div
                  className={`w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full ${theme.eyeColor} transition-transform duration-75 flex items-center justify-center`}
                  style={{ transform: `translate(${eyeX}px, ${eyeY}px)` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-white ml-[-1px] mt-[-1px]" />
                </div>
                {/* Blinking Eyelid */}
                <div
                  className={`absolute inset-0 bg-[#080d14] transition-transform duration-100 ${
                    isBlinking ? 'translate-y-0' : '-translate-y-full'
                  }`}
                />
              </div>
            </div>

            {/* Glowing Cheeks */}
            <div className="flex justify-between w-3/4 px-1 mt-0.5">
              <div className={`w-2.5 sm:w-4 h-1.5 rounded-full ${theme.cheekColor} blur-xs`} />
              <div className={`w-2.5 sm:w-4 h-1.5 rounded-full ${theme.cheekColor} blur-xs`} />
            </div>

            {/* Reactive Speaking Mouth with Live Lip-Sync */}
            <div className="mt-1 flex items-center justify-center h-4">
              {isSpeaking ? (
                <div
                  className={`rounded-full transition-all duration-75 shadow-md ${theme.eyeColor}`}
                  style={{
                    width: mouthOpen ? (size === 'sm' ? '10px' : '18px') : size === 'sm' ? '6px' : '10px',
                    height: mouthOpen ? (size === 'sm' ? '6px' : '11px') : '3px',
                  }}
                />
              ) : expression === 'happy' ? (
                <div className="w-5 sm:w-7 h-2.5 sm:h-3.5 border-b-2 border-white rounded-full" />
              ) : expression === 'concerned' ? (
                <div className="w-4 sm:w-6 h-2 border-t-2 border-amber-300 rounded-full" />
              ) : (
                <div className="w-4 sm:w-6 h-1 bg-white/70 rounded-full" />
              )}
            </div>
          </div>
        </div>

        {/* Mascot Floating Torso & Waving Arm */}
        <div className="relative mt-[-4px] flex items-center justify-center">
          {/* Left Waving Arm */}
          <div
            className={`w-2.5 sm:w-4 h-8 sm:h-11 bg-gradient-to-b ${theme.armBg} rounded-full mr-[-4px] origin-top transition-transform ${
              isWaving ? 'animate-[waveHand_0.4s_ease-in-out_infinite]' : 'rotate-[-14deg]'
            }`}
          />

          {/* Torso with Pulsing Energy Heart Core */}
          <div className="w-12 sm:w-16 h-9 sm:h-12 bg-gradient-to-b from-[#141d2a] to-[#080d14] border border-white/20 rounded-2xl shadow-xl flex items-center justify-center relative">
            <div className={`w-3.5 sm:w-4.5 h-3.5 sm:h-4.5 rounded-full ${theme.heartCore} animate-pulse flex items-center justify-center`}>
              <div className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-white" />
            </div>
          </div>

          {/* Right Arm */}
          <div className={`w-2.5 sm:w-4 h-8 sm:h-11 bg-gradient-to-b ${theme.armBg} rounded-full ml-[-4px] origin-top rotate-[14deg]`} />
        </div>
      </div>

      {/* Physics Animations */}
      <style>{`
        @keyframes mascotFloat {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-8px) rotate(1.5deg);
          }
        }
        @keyframes waveHand {
          0%, 100% { transform: rotate(-35deg); }
          50% { transform: rotate(-80deg); }
        }
        @keyframes mascotWave {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-10px) rotate(-3deg); }
          75% { transform: translateY(-4px) rotate(3deg); }
        }
        @keyframes earWiggle {
          0%, 100% { transform: rotate(-18deg); }
          50% { transform: rotate(-6deg); }
        }
      `}</style>
    </div>
  );
};
