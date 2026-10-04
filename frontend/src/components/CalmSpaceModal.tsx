import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';
import type { Language } from '../types';

interface CalmSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang: Language;
}

export const CalmSpaceModal: React.FC<CalmSpaceModalProps> = ({
  isOpen,
  onClose,
  currentLang,
}) => {
  if (!isOpen) return null;

  const [breathPhase, setBreathPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [secondsLeft, setSecondsLeft] = useState(4);
  const [isPlayingSound, setIsPlayingSound] = useState(false);

  // Web Audio API Synthesizer
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const noiseNodeRef = useRef<AudioNode | null>(null);

  // 4s Inhale, 2s Hold, 6s Exhale Cycle
  useEffect(() => {
    const interval = setInterval(() => {
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

  const toggleSound = () => {
    if (isPlayingSound) {
      if (gainNodeRef.current && audioCtxRef.current) {
        gainNodeRef.current.gain.linearRampToValueAtTime(
          0.001,
          audioCtxRef.current.currentTime + 0.6
        );
        setTimeout(() => {
          if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
            audioCtxRef.current.suspend();
          }
          setIsPlayingSound(false);
        }, 600);
      }
    } else {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!audioCtxRef.current) {
          const ctx = new AudioContextClass();
          audioCtxRef.current = ctx;

          // Theta wave binaural drone
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(108, ctx.currentTime);
          oscRef.current = osc;

          // Rain noise
          const bufferSize = ctx.sampleRate * 2;
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          let lastOut = 0.0;
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            output[i] = (lastOut + 0.02 * white) / 1.02;
            lastOut = output[i];
            output[i] *= 1.8;
          }

          const whiteNoise = ctx.createBufferSource();
          whiteNoise.buffer = noiseBuffer;
          whiteNoise.loop = true;

          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(450, ctx.currentTime);

          const mainGain = ctx.createGain();
          mainGain.gain.setValueAtTime(0.001, ctx.currentTime);
          gainNodeRef.current = mainGain;

          whiteNoise.connect(filter);
          filter.connect(mainGain);
          osc.connect(mainGain);
          mainGain.connect(ctx.destination);

          whiteNoise.start(0);
          osc.start(0);
          noiseNodeRef.current = whiteNoise;
        }

        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }

        if (gainNodeRef.current && audioCtxRef.current) {
          gainNodeRef.current.gain.linearRampToValueAtTime(
            0.18,
            audioCtxRef.current.currentTime + 1.2
          );
        }
        setIsPlayingSound(true);
      } catch (err) {
        console.error('Audio initialization error:', err);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
    };
  }, []);

  const phaseInstruction =
    breathPhase === 'inhale'
      ? currentLang === 'ta'
        ? 'மெதுவாக மூச்சை உள்ளிழுக்கவும்...'
        : 'Inhale slowly...'
      : breathPhase === 'hold'
      ? currentLang === 'ta'
        ? 'மென்மையாக நிறுத்தி வைக்கவும்...'
        : 'Hold gently...'
      : currentLang === 'ta'
      ? 'மெதுவாக மூச்சை வெளியேற்றவும்...'
      : 'Exhale softly...';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="bg-[#000000] text-white border border-white/20 w-full max-w-xl p-8 relative flex flex-col items-center text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors"
          aria-label="Close Calm Space"
        >
          <X className="w-5 h-5" />
        </button>

        <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-white/50 mb-2">
          ( MINDFULNESS / 4-6 PACING )
        </span>

        <h3 className="text-2xl font-bold uppercase tracking-tight text-white mb-8">
          Interactive Calm Space
        </h3>

        {/* Breathing Circle Visual */}
        <div className="relative w-56 h-56 flex items-center justify-center my-6">
          <div
            className="absolute rounded-full border border-white/30 transition-all duration-1000 ease-in-out"
            style={{
              width:
                breathPhase === 'inhale'
                  ? '100%'
                  : breathPhase === 'hold'
                  ? '95%'
                  : '50%',
              height:
                breathPhase === 'inhale'
                  ? '100%'
                  : breathPhase === 'hold'
                  ? '95%'
                  : '50%',
              backgroundColor: breathPhase === 'hold' ? 'rgba(255,255,255,0.06)' : 'transparent',
            }}
          />

          <div className="relative z-10 flex flex-col items-center">
            <span className="text-5xl font-mono font-bold text-white tracking-tighter">
              {secondsLeft}s
            </span>
            <span className="text-xs font-mono uppercase tracking-widest text-white/80 mt-2">
              {breathPhase}
            </span>
          </div>
        </div>

        <p className="text-lg font-medium text-white/90 mb-8 min-h-[30px]">
          {phaseInstruction}
        </p>

        {/* Soundscape Control */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={toggleSound}
            className={`pill-btn ${isPlayingSound ? 'pill-btn-white' : 'pill-btn-outlined'}`}
          >
            {isPlayingSound ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span>{isPlayingSound ? 'Mute Ambient Audio' : 'Play Soothing Theta Sound'}</span>
          </button>

          <button onClick={onClose} className="pill-btn pill-btn-outlined">
            Return to Site
          </button>
        </div>

        <p className="mt-6 text-[10px] font-mono uppercase tracking-wider text-white/40 max-w-sm">
          Box breathing and 4-6 pacing reduce sympathetic nervous system arousal within two minutes.
        </p>
      </div>
    </div>
  );
};
