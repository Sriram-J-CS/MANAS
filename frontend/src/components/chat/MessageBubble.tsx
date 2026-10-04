import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  Sparkles,
  PhoneCall,
  Wind,
  Compass,
  Heart,
  Activity,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  MessageCircleWarning,
} from 'lucide-react';
import type { ChatMessage, MascotExpression } from '../../types';
import { RealMascot } from '../RealMascot';

interface MessageBubbleProps {
  message: ChatMessage;
  userName: string;
  avatarType: string;
  currentExpression: MascotExpression;
  isAvatarSpeaking: boolean;
  onOpenHelp?: () => void;
  onStartBreathing?: () => void;
  onStartGrounding?: () => void;
  isCurrentlySpeaking?: boolean;
  currentWordIndex?: number;
  /** Called when user submits feedback; rating: 1 = thumbs up, -1 = thumbs down, 'not_understood' */
  onFeedback?: (messageId: string, rating: 1 | -1 | 'not_understood') => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  userName,
  avatarType,
  currentExpression,
  isAvatarSpeaking,
  onOpenHelp,
  onStartBreathing,
  onStartGrounding,
  isCurrentlySpeaking = false,
  currentWordIndex = -1,
  onFeedback,
}) => {
  const isUser = message.sender === 'user';
  const isHighRisk = message.isHighRisk || message.crisis || message.risk_level === 'high';
  const isMediumRisk = message.risk_level === 'medium';
  const hasHelplines = Boolean(message.helplines && message.helplines.length > 0);

  // Feedback state: null = not submitted, 'up'|'down'|'not_understood' = submitted
  const [feedbackState, setFeedbackState] = useState<null | 'up' | 'down' | 'not_understood'>(null);
  const [showConsentNote, setShowConsentNote] = useState(false);

  const handleFeedback = (rating: 1 | -1 | 'not_understood') => {
    if (feedbackState !== null) return; // Already submitted
    const key = rating === 1 ? 'up' : rating === -1 ? 'down' : 'not_understood';
    setFeedbackState(key);
    setShowConsentNote(true);
    onFeedback?.(message.id, rating);
    // Auto-hide consent note
    setTimeout(() => setShowConsentNote(false), 3500);
  };

  const getEmotionBadgeColor = (emo?: string) => {
    switch (emo) {
      case 'anxiety':
      case 'stressed':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'sadness':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      case 'joy':
      case 'relief':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'anger':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      default:
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
    }
  };

  const getStressBadgeColor = (stress?: number) => {
    if (stress === undefined || stress === null) return null;
    if (stress >= 7) return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
    if (stress >= 4) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
      className={`flex flex-col w-full my-2.5 ${isUser ? 'items-end' : 'items-start'}`}
    >
      <div
        className={`flex items-start gap-2.5 max-w-[94%] sm:max-w-[82%] ${
          isUser ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {/* Avatar Head Icon for Digital Twin */}
        {!isUser && (
          <div className="relative shrink-0 mt-0.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-cyan-900/60 to-violet-900/60 border border-white/20 flex items-center justify-center overflow-hidden shadow-md">
              <RealMascot
                size="sm"
                avatarType={avatarType || 'cyber_manas'}
                expression={message.expression || currentExpression}
                isSpeaking={isAvatarSpeaking}
                interactive={false}
              />
            </div>
            {isAvatarSpeaking && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400 border border-black animate-ping" />
            )}
          </div>
        )}

        {/* Bubble Box */}
        <div
          className={`px-4 py-3 sm:px-5 sm:py-4 rounded-2xl text-sm leading-relaxed backdrop-blur-xl shadow-lg transition-all ${
            isUser
              ? 'bg-gradient-to-tr from-white via-white to-zinc-100 text-slate-950 font-medium rounded-tr-sm shadow-white/5 border border-white/40'
              : isHighRisk
              ? 'bg-rose-950/85 border-2 border-rose-500/80 text-white shadow-rose-900/30 rounded-tl-sm'
              : 'bg-white/[0.08] border border-white/15 text-white/95 rounded-tl-sm hover:border-white/25 shadow-black/40'
          }`}
        >
          {/* Top Bar for Bot: State Badge & Stress Indicator */}
          {!isUser && (message.state_label || message.stress_level !== undefined || message.detected_emotion) && (
            <div className="flex flex-wrap items-center gap-1.5 mb-2.5 pb-2 border-b border-white/10 text-[10px] font-mono">
              {message.state_label && (
                <span
                  className={`px-2 py-0.5 rounded-full border flex items-center gap-1 font-semibold ${getEmotionBadgeColor(
                    message.detected_emotion
                  )}`}
                >
                  <Heart className="w-2.5 h-2.5" />
                  <span>{message.state_label}</span>
                </span>
              )}

              {message.stress_level !== undefined && (
                <span
                  className={`px-2 py-0.5 rounded-full border flex items-center gap-1 font-semibold ${getStressBadgeColor(
                    message.stress_level
                  )}`}
                  title="Real-time estimated psychological load (0-10 scale)"
                >
                  <Activity className="w-2.5 h-2.5" />
                  <span>Stress: {message.stress_level}/10</span>
                </span>
              )}
            </div>
          )}

          {/* Emergency Safety Alert for High-Risk Responses */}
          {isHighRisk && (
            <div className="flex items-center gap-1.5 text-rose-300 font-bold text-xs mb-2.5 font-mono pb-2 border-b border-rose-500/30">
              <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse shrink-0" />
              <span>Emergency Safety Protocol · Verified Helplines Active</span>
            </div>
          )}

          {/* Message Text with Karaoke Support */}
          <div className="whitespace-pre-wrap break-words selection:bg-cyan-500/30 font-sans tracking-normal text-sm sm:text-base leading-relaxed">
            {isCurrentlySpeaking && !isUser
              ? message.text.split(/\s+/).map((word, wIdx) => (
                  <React.Fragment key={wIdx}>
                    <span
                      className={`inline transition-colors duration-150 ${
                        wIdx === currentWordIndex
                          ? 'bg-cyan-400 text-slate-950 px-1 py-0.5 rounded font-bold'
                          : ''
                      }`}
                    >
                      {word}
                    </span>
                    {' '}
                  </React.Fragment>
                ))
              : message.text}
          </div>

          {/* Suggested Exercise Card: 4-7-8 Breathing */}
          {message.suggested_exercise === 'breathing_4_7_8' && (
            <div className="mt-3.5 pt-3 border-t border-white/10">
              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
                    <Wind className="w-4 h-4 text-cyan-300" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-cyan-200 font-mono tracking-tight">
                      Recommended: 4-7-8 Somatic Breathing
                    </h4>
                    <p className="text-[11px] text-cyan-200/70 font-sans">
                      4s Inhale · 7s Hold · 8s Exhale to soothe somatic tension
                    </p>
                  </div>
                </div>
                {onStartBreathing && (
                  <button
                    onClick={onStartBreathing}
                    className="px-3 py-1.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-[11px] tracking-wide shrink-0 transition-transform active:scale-95 shadow-md"
                  >
                    Start Breathing
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Suggested Exercise Card: 5-4-3-2-1 Sensory Grounding */}
          {message.suggested_exercise === 'grounding_54321' && (
            <div className="mt-3.5 pt-3 border-t border-white/10">
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <Compass className="w-4 h-4 text-emerald-300" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-200 font-mono tracking-tight">
                      Recommended: 5-4-3-2-1 Sensory Grounding
                    </h4>
                    <p className="text-[11px] text-emerald-200/70 font-sans">
                      Reconnect with your 5 senses to interrupt panic or spirals
                    </p>
                  </div>
                </div>
                {onStartGrounding && (
                  <button
                    onClick={onStartGrounding}
                    className="px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-[11px] tracking-wide shrink-0 transition-transform active:scale-95 shadow-md"
                  >
                    Start Grounding
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Verified Crisis Helpline Cards */}
          {(isHighRisk || isMediumRisk || hasHelplines) && (
            <div className="mt-3.5 pt-3 border-t border-rose-500/30">
              <span className="text-[10px] font-mono text-rose-300 tracking-wider uppercase font-bold block mb-2">
                Verified Emergency Helplines (24/7 Free):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {(message.helplines && message.helplines.length > 0
                  ? message.helplines
                  : [
                      { name: 'Tele-MANAS', number: '14416', alt: '1800 891 4416' },
                      { name: 'National Emergency', number: '112' },
                      { name: 'KIRAN', number: '1800-599-0019' },
                    ]
                ).map((hl, i) => (
                  <a
                    key={i}
                    href={`tel:${hl.number}`}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-between text-xs font-mono transition-all group active:scale-98 shadow-sm"
                  >
                    <div className="flex items-center gap-1.5">
                      <PhoneCall className="w-3 h-3 text-rose-400 group-hover:scale-110 transition-transform" />
                      <span className="font-bold">{hl.name}</span>
                    </div>
                    <span className="text-cyan-300 font-bold underline">{hl.number}</span>
                  </a>
                ))}
              </div>

              {onOpenHelp && (
                <button
                  onClick={onOpenHelp}
                  className="mt-2.5 text-[11px] text-rose-300 hover:text-white underline font-mono flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3" /> View Comprehensive Safety Net Directory
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Timestamp & Sender Tag + Feedback Buttons Under Bubble */}
      <div
        className={`flex items-center gap-2 text-[10px] font-mono text-white/50 mt-1.5 px-1 ${
          isUser ? 'mr-1' : 'ml-11'
        }`}
      >
        <span>{isUser ? userName : `${userName}'s Inner Twin`}</span>
        <span>·</span>
        <span>{message.time || 'Just now'}</span>
        {!isUser && (
          <span className="text-[9px] text-cyan-300/80 flex items-center gap-0.5">
            <Sparkles className="w-2.5 h-2.5 text-cyan-300" />
            <span>AI Empathetic Twin</span>
          </span>
        )}
      </div>

      {/* Feedback Buttons — only for bot messages */}
      {!isUser && onFeedback && (
        <div className={`flex items-center gap-1.5 ml-11 mt-0.5`}>
          <AnimatePresence mode="wait">
            {feedbackState === null ? (
              <motion.div
                key="buttons"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-1"
              >
                <button
                  id={`feedback-up-${message.id}`}
                  aria-label="This reply felt helpful"
                  title="Helpful"
                  onClick={() => handleFeedback(1)}
                  className="p-1 rounded-full hover:bg-emerald-500/20 text-white/30 hover:text-emerald-400 transition-all active:scale-90"
                >
                  <ThumbsUp className="w-3 h-3" />
                </button>
                <button
                  id={`feedback-down-${message.id}`}
                  aria-label="This reply wasn't quite right"
                  title="Didn't help"
                  onClick={() => handleFeedback(-1)}
                  className="p-1 rounded-full hover:bg-rose-500/20 text-white/30 hover:text-rose-400 transition-all active:scale-90"
                >
                  <ThumbsDown className="w-3 h-3" />
                </button>
                <button
                  id={`feedback-understood-${message.id}`}
                  aria-label="This didn't feel understood"
                  title="Didn't feel understood"
                  onClick={() => handleFeedback('not_understood')}
                  className="px-1.5 py-0.5 rounded-full hover:bg-amber-500/15 text-white/25 hover:text-amber-300 text-[9px] font-mono flex items-center gap-0.5 transition-all active:scale-95"
                >
                  <MessageCircleWarning className="w-3 h-3" />
                  <span>Didn't feel understood</span>
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="thanks"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-1"
              >
                <span className={`text-[9px] font-mono flex items-center gap-1 ${
                  feedbackState === 'up' ? 'text-emerald-400' :
                  feedbackState === 'not_understood' ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  {feedbackState === 'up' ? 'Thanks! Glad it helped.' :
                   feedbackState === 'not_understood' ? "Thanks — we'll work on this." :
                   'Thanks for the feedback.'}
                </span>
                {showConsentNote && (
                  <span className="text-[8px] text-white/30 font-mono">Stored only with your consent.</span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};
