import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, X, Play, Pause, RotateCcw, Volume2, VolumeX, CheckCircle2, Sparkles } from 'lucide-react';
import { speechGateway } from '../../lib/voice/speechGateway';

export type BreathingPattern = '4-7-8' | 'box' | '4-6';

interface BreathingWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  language?: string;
  companionGender?: 'girl' | 'boy';
  onSyncAvatarBreathe?: (phase: 'inhale' | 'hold' | 'exhale' | 'rest') => void;
}

type Phase = 'inhale' | 'hold' | 'exhale' | 'rest';

interface PatternConfig {
  id: BreathingPattern;
  name: string;
  tagline: string;
  phases: Phase[];
  durations: Record<Phase, number>;
}

const PATTERNS: Record<BreathingPattern, PatternConfig> = {
  '4-7-8': {
    id: '4-7-8',
    name: '4-7-8 Somatic',
    tagline: 'Deep parasympathetic nervous system release (Inhale 4s · Hold 7s · Exhale 8s)',
    phases: ['inhale', 'hold', 'exhale'],
    durations: {
      inhale: 4,
      hold: 7,
      exhale: 8,
      rest: 0,
    },
  },
  box: {
    id: 'box',
    name: 'Box (4-4-4-4)',
    tagline: 'Equalized focus & physiological grounding (4s In · 4s Hold · 4s Out · 4s Rest)',
    phases: ['inhale', 'hold', 'exhale', 'rest'],
    durations: {
      inhale: 4,
      hold: 4,
      exhale: 4,
      rest: 4,
    },
  },
  '4-6': {
    id: '4-6',
    name: '4-6 Heart Rhythm',
    tagline: 'Extended exhale to lower resting heart rate (Inhale 4s · Exhale 6s)',
    phases: ['inhale', 'exhale'],
    durations: {
      inhale: 4,
      hold: 0,
      exhale: 6,
      rest: 0,
    },
  },
};

const VOICE_LINES: Record<string, Record<Phase, string>> = {
  en: {
    inhale: 'Breathe in slowly',
    hold: 'Hold gently',
    exhale: 'Breathe out slowly',
    rest: 'Rest and pause',
  },
  hi: {
    inhale: 'धीरे-धीरे सांस अंदर लें',
    hold: 'सांस को रोककर रखें',
    exhale: 'धीरे-धीरे सांस बाहर छोड़ें',
    rest: 'विश्राम करें',
  },
  ta: {
    inhale: 'மெதுவாக மூச்சை உள்ளே இழுக்கவும்',
    hold: 'மூச்சை அடக்கி வைக்கவும்',
    exhale: 'மெதுவாக மூச்சை வெளிவிடவும்',
    rest: 'ஓய்வெடுக்கவும்',
  },
  te: {
    inhale: 'నెమ్మదిగా ఊపిరి పీల్చుకోండి',
    hold: 'ఊపిరిని ఆపండి',
    exhale: 'నెమ్మదిగా ఊపిరి వదలండి',
    rest: 'విశ్రాంతి తీసుకోండి',
  },
  kn: {
    inhale: 'ನಿಧಾನವಾಗಿ ಉಸಿರೆಳೆದುಕೊಳ್ಳಿ',
    hold: 'ಉಸಿರನ್ನು ಹಿಡಿದಿಟ್ಟುಕೊಳ್ಳಿ',
    exhale: 'ನಿಧಾನವಾಗಿ ಉಸಿರು ಬಿಡಿ',
    rest: 'ವಿಶ್ರಾಂತಿ ಪಡೆಯಿರಿ',
  },
  ml: {
    inhale: 'പതുക്കെ ശ്വാസമെടുക്കൂ',
    hold: 'ശ്വാസം അടക്കിവെക്കൂ',
    exhale: 'പതുക്കെ ശ്വാസം വിടൂ',
    rest: 'വിശ്രമിക്കൂ',
  },
  bn: {
    inhale: 'ধীরে ধীরে শ্বাস নিন',
    hold: 'শ্বাস ধরে রাখুন',
    exhale: 'ধীরে ধীরে শ্বাস ছাড়ুন',
    rest: 'বিশ্রাম নিন',
  },
  mr: {
    inhale: 'हळूहळू श्वास घ्या',
    hold: 'श्वास रोखून धरा',
    exhale: 'हळूहळू श्वास सोडा',
    rest: 'विश्रांती घ्या',
  },
};

export const BreathingWidget: React.FC<BreathingWidgetProps> = ({
  isOpen,
  onClose,
  onComplete,
  language = 'en',
  companionGender = 'girl',
  onSyncAvatarBreathe,
}) => {
  const [patternId, setPatternId] = useState<BreathingPattern>('4-7-8');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [phaseIndex, setPhaseIndex] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(PATTERNS['4-7-8'].durations.inhale);
  const [completedCycles, setCompletedCycles] = useState<number>(0);
  const [voiceGuidance, setVoiceGuidance] = useState<boolean>(true);
  const [sessionSaved, setSessionSaved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const pattern = PATTERNS[patternId];
  const currentPhase: Phase = pattern.phases[phaseIndex] || 'inhale';

  // Haptic feedback
  const triggerHaptic = (ms = 15) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch (_) {}
    }
  };

  // Speak voice cue at start of phase
  const speakPhaseCue = (p: Phase) => {
    if (!voiceGuidance) return;
    const langDict = VOICE_LINES[language] || VOICE_LINES.en;
    const text = langDict[p] || VOICE_LINES.en[p];
    speechGateway.speak({
      text,
      lang: language,
      gender: companionGender,
      purpose: 'breathing_guidance',
      pitch: companionGender === 'girl' ? 1.15 : 0.9,
    });
  };

  // Sync avatar breathing
  useEffect(() => {
    if (!isOpen) return;
    onSyncAvatarBreathe?.(currentPhase);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('manas:avatar_breathe', { detail: { phase: currentPhase } })
      );
    }
  }, [isOpen, currentPhase, onSyncAvatarBreathe]);

  // Main countdown timer
  useEffect(() => {
    if (!isOpen || !isActive) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1;

        // Transition to next phase
        triggerHaptic(20);
        const nextIndex = (phaseIndex + 1) % pattern.phases.length;
        const nextPhase = pattern.phases[nextIndex];
        const nextDuration = pattern.durations[nextPhase];

        if (nextIndex === 0) {
          setCompletedCycles((c) => c + 1);
        }

        setPhaseIndex(nextIndex);
        speakPhaseCue(nextPhase);
        return nextDuration;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isActive, phaseIndex, pattern, voiceGuidance, language, companionGender]);

  // Handle changing pattern
  const handleSelectPattern = (newPattern: BreathingPattern) => {
    setPatternId(newPattern);
    const p = PATTERNS[newPattern];
    setPhaseIndex(0);
    setSecondsLeft(p.durations.inhale);
    setCompletedCycles(0);
    triggerHaptic(10);
    speakPhaseCue('inhale');
  };

  // Save session to backend DB
  const handleSaveSession = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('manas_access_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // 1. Log to wellness entries
      await fetch('/api/wellness', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          metric_type: 'activity',
          score: 5,
          note: `Completed ${completedCycles + 1} cycles of ${pattern.name} breathing`,
        }),
      });

      // 2. Log to What Works efficacy
      await fetch('/api/interventions/feedback', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          strategy: `${pattern.name} Breathing`,
          helpful: true,
        }),
      });

      setSessionSaved(true);
      setTimeout(() => {
        setSessionSaved(false);
      }, 3000);
    } catch (err) {
      console.warn('Failed to save breathing session:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  // Scale of animated circle: expand on inhale, hold, contract on exhale, rest
  let circleScale = 1.0;
  if (currentPhase === 'inhale') {
    circleScale = 1.45;
  } else if (currentPhase === 'hold') {
    circleScale = 1.45;
  } else if (currentPhase === 'exhale') {
    circleScale = 0.95;
  } else {
    circleScale = 1.0;
  }

  const phaseDurationSec = pattern.durations[currentPhase] || 4;

  const phaseTitles: Record<Phase, string> = {
    inhale: 'Breathe In Slowly',
    hold: 'Hold In Stillness',
    exhale: 'Release and Let Go',
    rest: 'Pause & Notice',
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-xl bg-gradient-to-b from-[#0A1A18] via-[#0D1520] to-[#08080C] border border-teal-500/25 rounded-3xl p-6 sm:p-8 text-white shadow-2xl overflow-hidden font-sans"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
                <Wind className="w-5 h-5 animate-pulse" />
              </span>
              <div>
                <h3 className="text-base font-bold text-teal-100 font-serif">Guided Somatic Breathing</h3>
                <p className="text-[11px] font-mono text-teal-300/70">
                  Avatar synced · Voice guidance in your language
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVoiceGuidance(!voiceGuidance)}
                className={`p-2 rounded-full border transition-colors cursor-pointer ${
                  voiceGuidance
                    ? 'border-teal-500/40 bg-teal-500/20 text-teal-300'
                    : 'border-white/10 text-white/40 hover:text-white'
                }`}
                title={voiceGuidance ? 'Mute voice cues' : 'Enable voice cues'}
              >
                {voiceGuidance ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Pattern Selector Pills */}
          <div className="grid grid-cols-3 gap-2 my-4 relative z-10">
            {(['4-7-8', 'box', '4-6'] as BreathingPattern[]).map((pid) => {
              const p = PATTERNS[pid];
              const isSelected = patternId === pid;
              return (
                <button
                  key={pid}
                  type="button"
                  id={`breathing-pattern-${pid}`}
                  onClick={() => handleSelectPattern(pid)}
                  className={`py-2 px-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'border-teal-400 bg-teal-500/25 text-white font-bold shadow-sm ring-1 ring-teal-400/50'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-mono font-bold">{p.name}</div>
                  <div className="text-[9px] font-mono text-teal-200/60 uppercase tracking-wider">
                    {pid === '4-7-8' ? 'Relax' : pid === 'box' ? 'Focus' : 'Pacing'}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] font-mono text-center text-teal-200/80 mb-2 relative z-10">
            {pattern.tagline}
          </p>

          {/* Central Animated Breathing Circle */}
          <div className="flex flex-col items-center justify-center py-8 sm:py-10 relative z-10">
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
              {/* Outer soft glow ring */}
              <motion.div
                animate={{
                  scale: circleScale * 1.15,
                  opacity: currentPhase === 'hold' ? [0.35, 0.65, 0.35] : 0.4,
                }}
                transition={{
                  duration: phaseDurationSec,
                  ease: currentPhase === 'hold' ? 'easeInOut' : 'linear',
                }}
                className="absolute inset-0 rounded-full bg-gradient-to-tr from-teal-500/30 via-emerald-400/20 to-cyan-400/30 blur-xl pointer-events-none"
              />

              {/* Middle dashed track */}
              <div className="absolute inset-2 rounded-full border border-teal-500/20 border-dashed" />

              {/* Main Animated Circle */}
              <motion.div
                animate={{
                  scale: circleScale,
                }}
                transition={{
                  duration: phaseDurationSec,
                  ease: 'easeInOut',
                }}
                className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full flex flex-col items-center justify-center text-center p-4 shadow-2xl border transition-colors ${
                  currentPhase === 'inhale'
                    ? 'bg-gradient-to-br from-teal-500/40 to-emerald-600/30 border-teal-300/60 shadow-teal-500/30'
                    : currentPhase === 'hold'
                    ? 'bg-gradient-to-br from-cyan-500/40 to-teal-600/30 border-cyan-300/60 shadow-cyan-500/30'
                    : currentPhase === 'exhale'
                    ? 'bg-gradient-to-br from-emerald-600/30 to-slate-800/40 border-emerald-400/40'
                    : 'bg-gradient-to-br from-slate-800/40 to-teal-900/30 border-teal-500/30'
                }`}
              >
                <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-white drop-shadow">
                  {secondsLeft}s
                </span>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal-200 mt-1">
                  {currentPhase}
                </span>
                <span className="text-[10px] text-white/70 font-mono mt-0.5 max-w-[120px] leading-tight">
                  {phaseTitles[currentPhase]}
                </span>
              </motion.div>
            </div>

            {/* Cycle Counter */}
            <div className="mt-4 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-teal-300/80">
              Completed Cycles: <span className="font-bold text-white">{completedCycles}</span>
            </div>
          </div>

          {/* Controls Bottom Bar */}
          <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsActive(!isActive);
                  triggerHaptic(10);
                }}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isActive ? 'Pause' : 'Resume'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPhaseIndex(0);
                  setSecondsLeft(pattern.durations.inhale);
                  setCompletedCycles(0);
                  triggerHaptic(10);
                }}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer"
                title="Reset session"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {sessionSaved ? (
                <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved to DB!
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveSession}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-black font-mono font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                  <span>{isSaving ? 'Saving...' : 'Save Session'}</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BreathingWidget;
