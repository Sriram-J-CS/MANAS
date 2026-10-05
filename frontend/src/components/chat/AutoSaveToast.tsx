import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, RotateCcw, X, Sparkles, Brain, Activity, BookOpen, Target, ThumbsUp } from 'lucide-react';

export interface AutoSaveEventData {
  action_id: string;
  item_id: string;
  tool: string;
  target_screen: string;
  toast_message: string;
  summary: string;
  requires_confirmation?: boolean;
  confirmation_prompt?: string;
  reminder_text?: string;
  time_or_recurrence?: string;
  pref_key?: string;
  pref_value?: string;
}

interface AutoSaveToastProps {
  event: AutoSaveEventData;
  onUndo: (actionId: string) => Promise<void>;
  onConfirm?: (event: AutoSaveEventData) => Promise<void>;
  onDismiss: () => void;
}

const SCREEN_ICONS: Record<string, any> = {
  'Memory Center': Brain,
  'Digital Mental Twin': Activity,
  'Mood Journey': Activity,
  'Journal & Goals': Target,
  'Mindful Journal': BookOpen,
  'What Works For Me': ThumbsUp,
};

export const AutoSaveToast: React.FC<AutoSaveToastProps> = ({
  event,
  onUndo,
  onConfirm,
  onDismiss,
}) => {
  const [isUndoing, setIsUndoing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [doneMsg, setDoneMsg] = useState('');

  const Icon = SCREEN_ICONS[event.target_screen] || Sparkles;

  // Auto-dismiss after 6.5s if not requiring confirmation
  useEffect(() => {
    if (event.requires_confirmation) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 6500);
    return () => clearTimeout(timer);
  }, [event.requires_confirmation, onDismiss]);

  const handleUndoClick = async () => {
    setIsUndoing(true);
    try {
      await onUndo(event.action_id);
      setIsDone(true);
      setDoneMsg('Save undone');
      setTimeout(onDismiss, 1800);
    } catch (_) {
    } finally {
      setIsUndoing(false);
    }
  };

  const handleConfirmClick = async () => {
    if (!onConfirm) return;
    setIsConfirming(true);
    try {
      await onConfirm(event);
      setIsDone(true);
      setDoneMsg('Saved successfully');
      setTimeout(onDismiss, 1800);
    } catch (_) {
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.95 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="p-3.5 sm:p-4 rounded-2xl bg-[#0D111A]/95 border border-cyan-500/30 text-white shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 text-xs w-full max-w-md ring-1 ring-white/10"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-bold text-white tracking-tight">
            <span>{isDone ? doneMsg : event.toast_message}</span>
            {!isDone && <span className="text-[10px] text-cyan-300 font-mono font-normal">· auto-saved</span>}
          </div>
          <p className="text-[11px] text-white/60 truncate mt-0.5 font-mono">
            {event.confirmation_prompt || event.summary}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {event.requires_confirmation && !isDone ? (
          <>
            <button
              onClick={handleConfirmClick}
              disabled={isConfirming}
              className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-[11px] transition-transform active:scale-95 cursor-pointer shadow-md"
            >
              {isConfirming ? 'Saving...' : 'Yes, save'}
            </button>
            <button
              onClick={onDismiss}
              className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 text-[11px] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </>
        ) : !isDone ? (
          <button
            onClick={handleUndoClick}
            disabled={isUndoing}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-cyan-300 hover:text-white font-mono font-bold text-[11px] flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <RotateCcw className={`w-3 h-3 ${isUndoing ? 'animate-spin' : ''}`} />
            <span>{isUndoing ? 'Undoing...' : 'Undo'}</span>
          </button>
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        )}

        <button
          onClick={onDismiss}
          className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
};
