import React, { useState } from 'react';
import type { ChatMessage } from '../../types';
import {
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  MessageCircleWarning,
  CheckCircle2,
  Volume2,
  VolumeX,
  RotateCcw,
  Wind,
  Compass,
  ShieldAlert,
  Heart,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isTyping?: boolean;
  onSelectExercise?: (exerciseId: string) => void;
  onStartBreathing?: () => void;
  onStartGrounding?: () => void;
  onOpenHelp?: () => void;
  onSpeak?: (text: string) => void;
  isAvatarSpeaking?: boolean;
  speakingMessageId?: string | null;
  onRetry?: (text: string) => void;
  onFeedback?: (messageId: string, rating: 1 | -1 | 'not_understood') => void;
  className?: string;
}

/** Micro-feedback row for a single bot message */
const FeedbackRow: React.FC<{
  messageId: string;
  onFeedback: (messageId: string, rating: 1 | -1 | 'not_understood') => void;
  onSpeak?: () => void;
  isSpeakingThis?: boolean;
}> = ({ messageId, onFeedback, onSpeak, isSpeakingThis }) => {
  const [state, setState] = useState<null | 'up' | 'down' | 'not_understood'>(null);

  const handle = (rating: 1 | -1 | 'not_understood') => {
    if (state !== null) return;
    setState(rating === 1 ? 'up' : rating === -1 ? 'down' : 'not_understood');
    onFeedback(messageId, rating);
  };

  return (
    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[#0A0A0A]/6 text-[11px] font-mono text-[#0A0A0A]/60">
      <div className="flex items-center gap-1.5">
        <AnimatePresence mode="wait">
          {state === null ? (
            <motion.div
              key="btns"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1"
            >
              <button
                id={`feedback-up-${messageId}`}
                aria-label="Helpful"
                title="This response felt helpful"
                onClick={() => handle(1)}
                className="px-2 py-1 rounded-full border border-[#0A0A0A]/10 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-[#0A0A0A]/70 flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
              >
                <ThumbsUp className="w-3 h-3" />
                <span className="text-[10px]">Helpful</span>
              </button>
              <button
                id={`feedback-down-${messageId}`}
                aria-label="Not helpful"
                title="Not helpful"
                onClick={() => handle(-1)}
                className="p-1 rounded-full border border-[#0A0A0A]/10 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 text-[#0A0A0A]/60 transition-all active:scale-95 cursor-pointer shadow-2xs"
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
              <button
                id={`feedback-understood-${messageId}`}
                aria-label="Didn't feel understood"
                title="Didn't feel understood"
                onClick={() => handle('not_understood')}
                className="px-2 py-1 rounded-full border border-[#0A0A0A]/10 bg-white hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 text-[#0A0A0A]/70 flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
              >
                <MessageCircleWarning className="w-3 h-3 text-amber-600" />
                <span className="text-[10px]">Didn't feel understood</span>
              </button>
            </motion.div>
          ) : (
            <motion.span
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`text-[10px] font-mono flex items-center gap-1 font-semibold ${
                state === 'up'
                  ? 'text-emerald-600'
                  : state === 'not_understood'
                  ? 'text-amber-600'
                  : 'text-rose-500'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              {state === 'up' ? 'Helpful feedback recorded' : state === 'not_understood' ? "Noted — adjusting empathy" : 'Feedback saved'}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Speak / Listen Button */}
      {onSpeak && (
        <button
          type="button"
          onClick={onSpeak}
          aria-label={isSpeakingThis ? 'Speaking message aloud' : 'Speak message aloud'}
          title={isSpeakingThis ? 'Speaking...' : 'Listen aloud'}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-mono transition-all cursor-pointer ${
            isSpeakingThis
              ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#8B5CF6] font-bold shadow-xs'
              : 'border-[#0A0A0A]/10 bg-white hover:bg-[#8B5CF6]/10 hover:text-[#8B5CF6] text-[#0A0A0A]/60'
          }`}
        >
          {isSpeakingThis ? (
            <>
              <Volume2 className="w-3 h-3 text-[#8B5CF6] animate-pulse" />
              <span>Speaking</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3 h-3" />
              <span>Speak</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};

export const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  isTyping = false,
  onStartBreathing,
  onStartGrounding,
  onOpenHelp,
  onSpeak,
  speakingMessageId,
  onRetry,
  onFeedback,
  className = '',
}) => {
  const getEmotionBadge = (emo?: string, stateLabel?: string) => {
    const label = stateLabel || emo || 'Attuned';
    let badgeStyle = 'bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20';
    if (emo === 'concerned' || emo === 'sad') {
      badgeStyle = 'bg-rose-500/10 text-rose-700 border-rose-500/20';
    } else if (emo === 'happy' || emo === 'encouraging') {
      badgeStyle = 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
    } else if (emo === 'thinking') {
      badgeStyle = 'bg-amber-500/10 text-amber-700 border-amber-500/20';
    }
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono font-medium tracking-wide ${badgeStyle}`}>
        <Heart className="w-2.5 h-2.5" />
        <span>{label}</span>
      </span>
    );
  };

  return (
    <div className={`space-y-4 font-sans select-text ${className}`}>
      {messages.map((m) => {
        const isBot = m.sender === 'mascot';
        const isHighRisk = m.isHighRisk || m.crisis || m.risk_level === 'high';

        return (
          <div
            key={m.id}
            id={`message-${m.id}`}
            className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}
          >
            {isBot ? (
              /* Mascot Message Bubble */
              <div className="w-full max-w-[94%] sm:max-w-[88%] md:max-w-[85%]">
                <div
                  className={`rounded-2xl rounded-tl-xs p-4 sm:p-5 shadow-xs space-y-3 transition-all ${
                    isHighRisk
                      ? 'bg-rose-50 border-2 border-rose-500/60 text-[#0A0A0A]'
                      : m.isError
                      ? 'bg-rose-50 border border-rose-300 text-rose-950'
                      : 'bg-[#FDFBF7] border border-[#0A0A0A]/12 text-[#0A0A0A]'
                  }`}
                >
                  {/* Top Metadata Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[#0A0A0A]/8">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-pulse" />
                      <span className="text-[11px] font-mono font-bold tracking-wider text-[#0A0A0A]/80 uppercase">
                        MANAS MASCOT
                      </span>
                      {getEmotionBadge(m.expression || m.emotion, m.state_label)}
                    </div>

                    {m.stress_level !== undefined && m.stress_level !== null && (
                      <span className="text-[10px] font-mono text-[#0A0A0A]/60 flex items-center gap-1">
                        <Activity className="w-2.5 h-2.5 text-[#8B5CF6]" />
                        <span>Stress {m.stress_level}/10</span>
                      </span>
                    )}
                  </div>

                  {/* Thinking state bubble */}
                  {m.isThinking ? (
                    <div className="flex items-center gap-2 py-3 px-1 text-xs font-mono text-[#8B5CF6]">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-bounce" />
                      </div>
                      <span className="font-medium text-[#8B5CF6]">Reflecting and attuning with you...</span>
                    </div>
                  ) : m.isError ? (
                    /* Error State with Retry Button */
                    <div className="space-y-2 py-1">
                      <p className="text-xs text-rose-700 font-mono">
                        {m.text || 'Unable to reach the mental health companion. Please check your connection and retry.'}
                      </p>
                      {onRetry && (
                        <button
                          type="button"
                          onClick={() => onRetry(m.retryText || '')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-mono font-bold shadow-xs transition-transform active:scale-95 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retry</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Standard Streamed Message Text */
                    <div className="text-[14px] sm:text-[15px] leading-relaxed break-words whitespace-pre-wrap text-[#0A0A0A]">
                      {m.text}
                      {m.isStreaming && (
                        <span className="inline-block w-1.5 h-4 ml-1 bg-[#8B5CF6] animate-pulse align-middle" />
                      )}
                    </div>
                  )}

                  {/* High Risk Safety Warning */}
                  {isHighRisk && (
                    <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 text-xs font-mono flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold">Tele-MANAS Crisis Safety Active</span>
                        <p className="text-[11px] text-rose-800">
                          Please reach out immediately. Free, confidential mental health support is available 24/7.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Embedded Exercise Card: 4-7-8 Breathing */}
                  {m.suggested_exercise === 'breathing_4_7_8' && (
                    <div className="p-3 rounded-xl bg-cyan-50/80 border border-cyan-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center shrink-0">
                          <Wind className="w-4 h-4 text-cyan-700" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-cyan-900 font-mono">
                            Recommended: 4-7-8 Somatic Breathing
                          </h4>
                          <p className="text-[11px] text-cyan-800/80">
                            4s Inhale · 7s Hold · 8s Exhale to regulate somatic tension
                          </p>
                        </div>
                      </div>
                      {onStartBreathing && (
                        <button
                          type="button"
                          onClick={onStartBreathing}
                          className="px-3.5 py-1.5 rounded-full bg-cyan-700 hover:bg-cyan-800 text-white font-mono font-bold text-xs shrink-0 shadow-xs transition-transform active:scale-95 cursor-pointer self-start sm:self-center"
                        >
                          Start Breathing
                        </button>
                      )}
                    </div>
                  )}

                  {/* Embedded Exercise Card: 5-4-3-2-1 Sensory Grounding */}
                  {m.suggested_exercise === 'grounding_54321' && (
                    <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                          <Compass className="w-4 h-4 text-emerald-700" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-emerald-900 font-mono">
                            Recommended: 5-4-3-2-1 Sensory Grounding
                          </h4>
                          <p className="text-[11px] text-emerald-800/80">
                            Engage your 5 senses to break panic spirals and ground in the present
                          </p>
                        </div>
                      </div>
                      {onStartGrounding && (
                        <button
                          type="button"
                          onClick={onStartGrounding}
                          className="px-3.5 py-1.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-mono font-bold text-xs shrink-0 shadow-xs transition-transform active:scale-95 cursor-pointer self-start sm:self-center"
                        >
                          Start Grounding
                        </button>
                      )}
                    </div>
                  )}

                  {/* Embedded Emergency Helplines */}
                  {(isHighRisk || (m.helplines && m.helplines.length > 0)) && (
                    <div className="pt-2 border-t border-rose-200/60">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-rose-700 font-bold block mb-1.5">
                        Emergency 24/7 Helplines:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(m.helplines && m.helplines.length > 0
                          ? m.helplines
                          : [
                              { name: 'Tele-MANAS', number: '14416', alt: '1800 891 4416' },
                              { name: 'Emergency', number: '112' },
                              { name: 'KIRAN', number: '1800-599-0019' },
                            ]
                        ).map((hl, i) => (
                          <a
                            key={i}
                            href={`tel:${hl.number}`}
                            className="px-2.5 py-1 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-mono font-bold transition-all shadow-2xs"
                          >
                            {hl.name}: {hl.number}
                          </a>
                        ))}
                        {onOpenHelp && (
                          <button
                            type="button"
                            onClick={onOpenHelp}
                            className="px-2.5 py-1 rounded-full border border-rose-400 text-rose-800 hover:bg-rose-100 text-[11px] font-mono cursor-pointer"
                          >
                            All Helplines ↗
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions & Feedback Row */}
                  {!m.isThinking && !m.isError && (
                    <FeedbackRow
                      messageId={m.id}
                      onFeedback={onFeedback || (() => {})}
                      onSpeak={onSpeak ? () => onSpeak(m.spoken_text || m.text) : undefined}
                      isSpeakingThis={speakingMessageId === m.id}
                    />
                  )}
                </div>
              </div>
            ) : (
              /* User Message Bubble */
              <div className="max-w-[85%] sm:max-w-[78%] px-4 py-2.5 rounded-2xl rounded-tr-xs bg-[#0A0A0A] text-[#FFFFFF] text-[14px] sm:text-[15px] leading-relaxed shadow-xs font-sans whitespace-pre-wrap break-words">
                {m.text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ChatMessages;
