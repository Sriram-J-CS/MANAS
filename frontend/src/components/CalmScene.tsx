import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Wind, Info } from 'lucide-react';
import type { Language } from '../types';
import { translations } from '../content/translations';

interface CalmSceneProps {
  currentLang: Language;
}

export const CalmScene: React.FC<CalmSceneProps> = ({ currentLang }) => {
  const t = translations[currentLang].calm;
  const [breathPhase, setBreathPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [secondsLeft, setSecondsLeft] = useState(4);
  const [isPlayingSound, setIsPlayingSound] = useState(false);

  // Web Audio API Ambient Sound Synthesizer (Generative Rain & Theta Drone)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const noiseNodeRef = useRef<AudioNode | null>(null);

  // 4s Inhale, 2s Hold, 6s Exhale Cycle (12-second total mindfulness loop)
  useEffect(() => {
    const interval: ReturnType<typeof setInterval> = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (breathPhase === 'inhale') {
            setBreathPhase('hold');
            return 2;
          } else if (breathPhase === 'hold') {
            setBreathPhase('exhale');
            return 6;
          } else {
            setBreathPhase('inhale');
            return 4;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [breathPhase]);

  // Ambient soundscape generator using pure Web Audio API
  const toggleSound = () => {
    if (isPlayingSound) {
      // Fade out
      if (gainNodeRef.current && audioCtxRef.current) {
        gainNodeRef.current.gain.linearRampToValueAtTime(
          0.001,
          audioCtxRef.current.currentTime + 0.8
        );
        setTimeout(() => {
          if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
            audioCtxRef.current.suspend();
          }
          setIsPlayingSound(false);
        }, 800);
      }
    } else {
      // Start Audio Context on user gesture
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContextClass();
        }

        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        // Master Gain
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
        masterGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1.2);
        masterGain.connect(ctx.destination);
        gainNodeRef.current = masterGain;

        // Soothing warm sine drone (frequency 144 Hz)
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(144, ctx.currentTime);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(320, ctx.currentTime);

        osc.connect(filter);
        filter.connect(masterGain);
        osc.start();
        oscRef.current = osc;

        // Generate gentle brown/pink noise rain texture
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 2.5; // brownian noise
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(450, ctx.currentTime);

        whiteNoise.connect(noiseFilter);
        noiseFilter.connect(masterGain);
        whiteNoise.start();
        noiseNodeRef.current = whiteNoise;

        setIsPlayingSound(true);
      } catch (e) {
        console.warn('AudioContext failed:', e);
      }
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
    };
  }, []);

  return (
    <section
      id="calm"
      className="relative w-full py-28 md:py-36 bg-gradient-to-b from-[#FAF7F2] via-[#EAE6DF] to-[#FAF7F2] overflow-hidden select-none"
    >
      {/* Ambient background particles and rings */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
        <div className="w-[500px] h-[500px] rounded-full border border-[#5FA88B]/30 animate-ping [animation-duration:8s]" />
        <div className="absolute w-[800px] h-[800px] rounded-full border border-[#A99BE0]/20" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        {/* Monospaced Section Header */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-[#E6E0D6] text-xs font-mono tracking-wider text-[#5FA88B] mb-6">
          <Wind className="w-3.5 h-3.5" />
          <span>{t.label}</span>
        </div>

        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#101820] tracking-tight">
          {t.title}
        </h2>
        <p className="mt-3.5 text-base sm:text-lg text-[#5B6673] max-w-2xl mx-auto">
          {t.subtitle}
        </p>

        {/* Breathing Animation Canvas / Interactive Orb */}
        <div className="my-14 flex flex-col items-center justify-center">
          <div className="relative w-72 h-72 sm:w-84 sm:h-84 flex items-center justify-center">
            {/* Outer pulsating aura */}
            <div
              className={`absolute inset-0 rounded-full transition-all duration-[3000ms] ease-in-out ${
                breathPhase === 'inhale'
                  ? 'scale-115 bg-[#5FA88B]/20 blur-xl'
                  : breathPhase === 'hold'
                  ? 'scale-115 bg-[#A99BE0]/25 blur-xl'
                  : 'scale-90 bg-[#276E8B]/15 blur-md'
              }`}
            />

            {/* Middle decorative soft ring */}
            <div
              className={`absolute w-60 h-60 sm:w-72 sm:h-72 rounded-full border-2 border-dashed border-[#5FA88B]/40 transition-all duration-[3000ms] ${
                breathPhase === 'inhale' ? 'scale-110 rotate-45' : 'scale-95 rotate-0'
              }`}
            />

            {/* Inner Core Breathing Circle */}
            <div
              className={`relative z-10 w-44 h-44 sm:w-52 sm:h-52 rounded-full flex flex-col items-center justify-center text-white shadow-2xl transition-all duration-[4000ms] ease-in-out ${
                breathPhase === 'inhale'
                  ? 'scale-110 bg-gradient-to-tr from-[#5FA88B] to-[#276E8B]'
                  : breathPhase === 'hold'
                  ? 'scale-110 bg-gradient-to-tr from-[#A99BE0] to-[#5FA88B]'
                  : 'scale-85 bg-gradient-to-tr from-[#276E8B] to-[#101820]'
              }`}
            >
              <span className="text-sm uppercase font-mono tracking-widest opacity-90">
                {breathPhase === 'inhale'
                  ? t.inhale
                  : breathPhase === 'hold'
                  ? t.hold
                  : t.exhale}
              </span>
              <span className="text-4xl sm:text-5xl font-black mt-2 font-mono">
                {secondsLeft}s
              </span>
            </div>
          </div>

          {/* Soundscape Control Button */}
          <div className="mt-8 flex flex-col items-center gap-2">
            <button
              onClick={toggleSound}
              className={`inline-flex items-center gap-2.5 px-6 py-3 rounded-full text-xs font-bold transition-all duration-300 shadow-sm ${
                isPlayingSound
                  ? 'bg-[#5FA88B] text-white shadow-md'
                  : 'bg-white text-[#1F2A37] border border-[#E6E0D6] hover:bg-[#FAF7F2]'
              }`}
            >
              {isPlayingSound ? (
                <>
                  <Volume2 className="w-4 h-4 animate-bounce" />
                  <span>{t.soundOn}</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-[#5B6673]" />
                  <span>{t.soundOff}</span>
                </>
              )}
            </button>
            <span className="text-[11px] font-mono text-[#5B6673]/70">
              {t.soundHint}
            </span>
          </div>
        </div>

        {/* Clinical Note on Mindful Breathing */}
        <div className="max-w-xl mx-auto bg-white/70 backdrop-blur-xs border border-[#E6E0D6] rounded-2xl p-4 flex items-start gap-3 text-left">
          <Info className="w-5 h-5 text-[#276E8B] shrink-0 mt-0.5" />
          <p className="text-xs text-[#5B6673] leading-relaxed">
            {t.disclaimer}
          </p>
        </div>
      </div>
    </section>
  );
};
