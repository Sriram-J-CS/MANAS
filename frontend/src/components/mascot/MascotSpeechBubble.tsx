import React, { useState, useEffect } from 'react';
import { Sparkles, Wind, Compass, PhoneCall, ShieldAlert, Activity, Volume2, ThumbsUp, ThumbsDown, MessageSquareHeart, Check } from 'lucide-react';
import type { MascotEmotion } from '../../lib/emotion/emotionEngine';

interface MascotSpeechBubbleProps {
  message: string;
  messageId?: string;
  emotion?: MascotEmotion;
  isTyping?: boolean;
  isSpeaking?: boolean;
  stateLabel?: string;
  stressLevel?: number | null;
  helplines?: Array<{ name: string; number: string; alt?: string }>;
  suggestedExercise?: string;
  isHighRisk?: boolean;
  onStartBreathing?: () => void;
  onStartGrounding?: () => void;
  onOpenHelp?: () => void;
  onReplayVoice?: () => void;
  onFeedback?: (rating: 'thumbs_up' | 'thumbs_down' | 'not_understood', consent: boolean) => void;
  className?: string;
}

export const MascotSpeechBubble: React.FC<MascotSpeechBubbleProps> = ({
  message,
  messageId: _messageId,
  emotion = 'calm',
  isTyping = false,
  isSpeaking = false,
  stateLabel,
  stressLevel,
  helplines = [],
  suggestedExercise = 'none',
  isHighRisk = false,
  onStartBreathing,
  onStartGrounding,
  onOpenHelp,
  onReplayVoice,
  onFeedback,
  className = '',
}) => {
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null);
  const [allowConsent, setAllowConsent] = useState<boolean>(() => {
    return localStorage.getItem('manas_feedback_consent') === 'true';
  });
  // Smooth progressive typewriter text
  const [displayedText, setDisplayedText] = useState<string>('');

  useEffect(() => {
    if (!message) {
      setDisplayedText('');
      return;
    }

    // Fast smooth typewriter
    let currentIdx = 0;
    const len = message.length;
    // For long texts, advance multiple characters at a time for snappy feel
    const step = len > 180 ? 4 : len > 80 ? 2 : 1;

    setDisplayedText(message.slice(0, 1));
    const interval = setInterval(() => {
      currentIdx += step;
      if (currentIdx >= len) {
        setDisplayedText(message);
        clearInterval(interval);
      } else {
        setDisplayedText(message.slice(0, currentIdx));
      }
    }, 18);

    return () => clearInterval(interval);
  }, [message]);

  if (!message && !isTyping) return null;

  const paragraphs = displayedText.split('\n');

  return (
    <div
      className={`relative z-30 transition-all duration-300 ease-out select-text ${className}`}
      style={{
        filter: 'drop-shadow(0 14px 28px rgba(10, 10, 10, 0.08))',
      }}
    >
      {/* Speech Bubble Container */}
      <div className="relative bg-[#FFFFFF] border border-[#0A0A0A]/12 rounded-3xl p-5 md:p-6 text-[#0A0A0A] space-y-3.5 max-w-xl">
        {/* Subtle Visual Tail Connecting toward Mascot */}
        <div
          className="hidden md:block absolute -left-3 top-9 w-4 h-4 bg-[#FFFFFF] border-b border-l border-[#0A0A0A]/12 rotate-45 transform"
          aria-hidden="true"
        />

        {/* Top Metadata Header (Mascot identity, Emotion tag, Stress score) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0A0A0A]/8 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#8B5CF6] font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
              MANAS MASCOT
            </span>

            {stateLabel && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20">
                {stateLabel}
              </span>
            )}

            <span className="capitalize text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#F3F0E6] text-[#0A0A0A]/70">
              {emotion}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {stressLevel !== undefined && stressLevel !== null && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border flex items-center gap-1 ${
                  stressLevel >= 7
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : stressLevel >= 4
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                <Activity className="w-2.5 h-2.5" />
                <span>Stress {stressLevel}/10</span>
              </span>
            )}

            {onReplayVoice && (
              <button
                type="button"
                onClick={onReplayVoice}
                className="p-1 rounded-full text-[#0A0A0A]/50 hover:text-[#0A0A0A] hover:bg-[#F3F0E6] transition-colors cursor-pointer"
                title="Replay Voice"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Message Content with Typing Animation */}
        <div className="space-y-2.5 text-base sm:text-[17px] leading-[1.65] font-normal text-[#0A0A0A] font-sans">
          {paragraphs.map((para, idx) => {
            const trimmed = para.trim();
            if (!trimmed) return <div key={idx} className="h-1" />;
            return (
              <p key={idx} className="break-words whitespace-pre-wrap">
                {trimmed}
              </p>
            );
          })}
        </div>

        {/* Typewriter Thinking / Speaking Status Indicator */}
        {(isTyping || isSpeaking) && (
          <div className="flex items-center gap-2 text-xs font-mono text-[#8B5CF6] pt-1">
            <span className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-ping" />
            <span>{isSpeaking ? 'Speaking with you...' : 'Listening & thinking with care...'}</span>
          </div>
        )}

        {/* Suggested Somatic Breathing Card */}
        {suggestedExercise === 'breathing_4_7_8' && onStartBreathing && (
          <div className="mt-3 p-3 rounded-2xl bg-[#FDFBF7] border border-[#8B5CF6]/30 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#8B5CF6]/15 flex items-center justify-center text-[#8B5CF6] shrink-0">
                <Wind className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-bold font-mono text-[#0A0A0A]">
                  4-7-8 Somatic Breathing
                </div>
                <div className="text-[11px] text-[#0A0A0A]/60">
                  4s Inhale · 7s Hold · 8s Exhale
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onStartBreathing}
              className="px-3 py-1.5 rounded-full bg-[#8B5CF6] text-white text-xs font-mono font-bold hover:bg-[#7C3AED] transition-colors cursor-pointer shrink-0"
            >
              Begin →
            </button>
          </div>
        )}

        {/* Suggested Sensory Grounding Card */}
        {suggestedExercise === 'grounding_54321' && onStartGrounding && (
          <div className="mt-3 p-3 rounded-2xl bg-[#FDFBF7] border border-emerald-500/30 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-600 shrink-0">
                <Compass className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-bold font-mono text-[#0A0A0A]">
                  5-4-3-2-1 Sensory Grounding
                </div>
                <div className="text-[11px] text-[#0A0A0A]/60">
                  Calm racing sensory overload
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onStartGrounding}
              className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-mono font-bold hover:bg-emerald-500 transition-colors cursor-pointer shrink-0"
            >
              Anchor →
            </button>
          </div>
        )}

        {/* High Risk / Crisis Protocol Helplines Card */}
        {(isHighRisk || (helplines && helplines.length > 0)) && (
          <div className="mt-3 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
            <div className="flex items-center gap-1.5 text-rose-700 font-mono text-xs font-bold">
              <ShieldAlert className="w-4 h-4 text-rose-600 animate-pulse" />
              <span>Verified 24/7 Crisis Support</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(helplines.length > 0
                ? helplines
                : [
                    { name: 'Tele-MANAS', number: '14416', alt: '1800 891 4416' },
                    { name: 'National Emergency', number: '112' },
                  ]
              ).map((h, idx) => (
                <a
                  key={idx}
                  href={`tel:${h.number}`}
                  className="px-2.5 py-1.5 rounded-xl bg-white border border-rose-200 hover:border-rose-400 text-[#0A0A0A] flex items-center justify-between text-xs font-mono transition-colors"
                >
                  <span className="font-bold">{h.name}</span>
                  <span className="text-rose-600 font-bold underline flex items-center gap-1">
                    <PhoneCall className="w-3 h-3" /> {h.number}
                  </span>
                </a>
              ))}
            </div>
            {onOpenHelp && (
              <button
                type="button"
                onClick={onOpenHelp}
                className="text-[11px] text-rose-700 underline font-mono hover:text-rose-900"
              >
                View Full Safety Directory →
              </button>
            )}
          </div>
        )}

        {/* Phase 5: Empathy Feedback & Consent Row */}
        <div className="pt-2 border-t border-[#0A0A0A]/6 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-[#0A0A0A]/50">
            <span className="text-[11px] font-mono">Felt helpful?</span>
            <button
              type="button"
              aria-label="Thumbs up - Felt helpful"
              onClick={() => {
                setFeedbackSent('thumbs_up');
                onFeedback?.('thumbs_up', allowConsent);
              }}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                feedbackSent === 'thumbs_up'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs'
                  : 'bg-white border-[#0A0A0A]/10 hover:border-[#0A0A0A]/30 text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Thumbs down - Not helpful"
              onClick={() => {
                setFeedbackSent('thumbs_down');
                onFeedback?.('thumbs_down', allowConsent);
              }}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                feedbackSent === 'thumbs_down'
                  ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                  : 'bg-white border-[#0A0A0A]/10 hover:border-[#0A0A0A]/30 text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
              }`}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedbackSent('not_understood');
                onFeedback?.('not_understood', allowConsent);
              }}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1 ${
                feedbackSent === 'not_understood'
                  ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-xs'
                  : 'bg-white border-[#0A0A0A]/10 hover:border-amber-400 text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
              }`}
            >
              <MessageSquareHeart className="w-3 h-3 text-amber-600" />
              <span>Didn't feel understood</span>
            </button>
            {feedbackSent && (
              <span className="text-[11px] text-emerald-600 font-mono flex items-center gap-1 animate-fade-in">
                <Check className="w-3 h-3" /> Recorded
              </span>
            )}
          </div>

          {/* Privacy & Opt-in consent */}
          <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-[#0A0A0A]/40 hover:text-[#0A0A0A]/70 select-none">
            <input
              type="checkbox"
              checked={allowConsent}
              onChange={(e) => {
                const next = e.target.checked;
                setAllowConsent(next);
                localStorage.setItem('manas_feedback_consent', next ? 'true' : 'false');
              }}
              className="rounded border-[#0A0A0A]/20 text-[#8B5CF6] focus:ring-0 w-3 h-3 cursor-pointer"
            />
            <span>Allow anonymous review to improve empathy</span>
          </label>
        </div>
      </div>
    </div>
  );
};
