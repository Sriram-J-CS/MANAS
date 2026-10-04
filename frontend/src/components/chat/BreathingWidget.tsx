import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, X, Play, RotateCcw } from 'lucide-react';

interface BreathingWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  durationSecs?: number;
}

type Phase = 'inhale' | 'hold' | 'exhale' | 'rest';

const PHASE_DURATION: Record<Phase, number> = {
  inhale: 4,
  hold: 4,
  exhale: 4,
  rest: 4,
};

const PHASE_LABELS: Record<Phase, { title: string; subtitle: string }> = {
  inhale: { title: 'Breathe In Slowly', subtitle: 'Feel your chest expand with cool, fresh air' },
  hold: { title: 'Hold Gently', subtitle: 'Rest in this stillness, without tension' },
  exhale: { title: 'Release Slowly', subtitle: 'Let all the tension melt out of your shoulders' },
  rest: { title: 'Rest & Be Present', subtitle: 'Notice the quiet calm in your body' },
};

export const BreathingWidget: React.FC<BreathingWidgetProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [isActive, setIsActive] = useState<boolean>(true);
  const [phase, setPhase] = useState<Phase>('inhale');
  const [secondsLeft, setSecondsLeft] = useState<number>(4);
  const [completedCycles, setCompletedCycles] = useState<number>(0);
  const targetCycles = 4;

  // Haptic feedback helper
  const triggerHaptic = (ms = 15) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch (_) {}
    }
  };

  useEffect(() => {
    if (!isOpen || !isActive) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1;

        // Transition to next phase
        triggerHaptic(20);
        if (phase === 'inhale') {
          setPhase('hold');
          return PHASE_DURATION.hold;
        } else if (phase === 'hold') {
          setPhase('exhale');
          return PHASE_DURATION.exhale;
        } else if (phase === 'exhale') {
          setPhase('rest');
          return PHASE_DURATION.rest;
        } else {
          // cycle completed
          setCompletedCycles((c) => {
            const next = c + 1;
            if (next >= targetCycles && onComplete) {
              onComplete();
            }
            return next;
          });
          setPhase('inhale');
          return PHASE_DURATION.inhale;
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, isActive, phase, onComplete]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="my-3 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-teal-950/60 via-slate-950/80 to-emerald-950/40 border border-teal-500/30 backdrop-blur-xl shadow-2xl relative overflow-hidden"
      >
        {/* Soft background pulse glow */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between relative z-10 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <Wind className="w-4 h-4 animate-pulse" />
            </span>
            <div>
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-teal-200">
                4-4-4-4 Box Breathing Guide
              </h4>
              <span className="text-[10px] text-teal-300/60 font-mono">
                Cycle {Math.min(completedCycles + 1, targetCycles)} of {targetCycles} · Reduces sympathetic arousal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setIsActive(!isActive);
                triggerHaptic(10);
              }}
              className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title={isActive ? 'Pause' : 'Resume'}
            >
              {isActive ? <span className="text-xs font-mono px-2 py-0.5 rounded border border-white/20">Pause</span> : <Play className="w-3.5 h-3.5 text-teal-300" />}
            </button>
            <button
              onClick={() => {
                setPhase('inhale');
                setSecondsLeft(4);
                setCompletedCycles(0);
                triggerHaptic(10);
              }}
              className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="Reset"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                triggerHaptic(10);
                onClose();
              }}
              className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Central Breathing Animation */}
        <div className="flex flex-col items-center justify-center py-4 relative z-10">
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center">
            {/* Outer pulsating wave ring */}
            <motion.div
              animate={{
                scale: phase === 'inhale' ? 1.45 : phase === 'hold' ? 1.45 : phase === 'exhale' ? 1.0 : 1.05,
                opacity: phase === 'hold' ? [0.4, 0.7, 0.4] : 0.4,
              }}
              transition={{
                duration: phase === 'inhale' ? 4 : phase === 'exhale' ? 4 : 2,
                ease: 'easeInOut',
                repeat: phase === 'hold' ? Infinity : 0,
              }}
              className="absolute inset-0 rounded-full border border-teal-400/30 bg-teal-500/10 blur-sm pointer-events-none"
            />

            {/* Core expanding/contracting sphere */}
            <motion.div
              animate={{
                scale: phase === 'inhale' ? 1.3 : phase === 'hold' ? 1.3 : 0.85,
                boxShadow:
                  phase === 'inhale' || phase === 'hold'
                    ? '0 0 35px rgba(45, 212, 191, 0.5)'
                    : '0 0 15px rgba(20, 184, 166, 0.2)',
              }}
              transition={{
                duration: phase === 'inhale' ? 4 : phase === 'exhale' ? 4 : 1,
                ease: 'easeInOut',
              }}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-teal-600 via-emerald-500 to-cyan-400 flex flex-col items-center justify-center text-slate-950 font-bold shadow-xl border border-teal-200/50"
            >
              <span className="text-2xl sm:text-3xl font-mono leading-none tracking-tight">
                {secondsLeft}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest mt-0.5 opacity-80">
                sec
              </span>
            </motion.div>
          </div>

          {/* Phase text */}
          <div className="text-center mt-3">
            <h5 className="text-sm sm:text-base font-bold text-white tracking-tight">
              {PHASE_LABELS[phase].title}
            </h5>
            <p className="text-xs text-teal-200/70 font-mono mt-0.5 max-w-xs">
              {PHASE_LABELS[phase].subtitle}
            </p>
          </div>
        </div>

        {/* Bottom progress dots */}
        <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-teal-500/20">
          {(['inhale', 'hold', 'exhale', 'rest'] as Phase[]).map((p) => (
            <span
              key={p}
              className={`text-[9px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider transition-all ${
                phase === p
                  ? 'bg-teal-400 text-slate-950 font-bold scale-105'
                  : 'bg-white/5 text-white/40 border border-white/10'
              }`}
            >
              {p}
            </span>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
