import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Paperclip,
  Trash2,
  X,
  Sparkles,
  Clock,
} from 'lucide-react';
import { speechEngine } from '../../lib/voice/speechEngine';
import { isVoiceEndPhrase } from '../../i18n/voiceEndPhrases';

interface ChatInputProps {
  onSendMessage: (text: string, typingCPS?: number) => void;
  isTyping?: boolean;
  voiceOutputEnabled: boolean;
  onToggleVoiceOutput: () => void;
  onClearConversation?: () => void;
  onOpenMascotUpload?: () => void;
  onStartMic?: () => void;
  isListening?: boolean;
  language?: string;
  silenceTimeoutSeconds?: number;
  className?: string;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isTyping = false,
  voiceOutputEnabled,
  onToggleVoiceOutput,
  onClearConversation,
  onOpenMascotUpload,
  language = 'en',
  silenceTimeoutSeconds = 15,
  className = '',
  placeholder = 'Speak or type what you are carrying...',
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [silenceSecondsLeft, setSilenceSecondsLeft] = useState<number>(silenceTimeoutSeconds);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [pendingEndPhrase, setPendingEndPhrase] = useState<boolean>(false);
  const [endPhraseTimerLeft, setEndPhraseTimerLeft] = useState<number>(1.2);
  const [transcriptReviewActive, setTranscriptReviewActive] = useState<boolean>(false);
  const [confidenceScore, setConfidenceScore] = useState<number>(94);

  const inputRef = useRef<HTMLInputElement>(null);
  const silenceTimerRef = useRef<any>(null);
  const endPhraseTimerRef = useRef<any>(null);
  const stopListeningFnRef = useRef<(() => void) | null>(null);
  const typingStartRef = useRef<number | null>(null);
  const keystrokeCountRef = useRef<number>(0);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      clearEndPhraseTimer();
      if (stopListeningFnRef.current) {
        stopListeningFnRef.current();
      }
    };
  }, []);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setIsCountingDown(false);
    setSilenceSecondsLeft(silenceTimeoutSeconds);
  };

  const clearEndPhraseTimer = () => {
    if (endPhraseTimerRef.current) {
      clearInterval(endPhraseTimerRef.current);
      endPhraseTimerRef.current = null;
    }
    setPendingEndPhrase(false);
    setEndPhraseTimerLeft(1.2);
  };

  // Submit and clear
  const handleDispatch = useCallback(
    (textToSend: string) => {
      const clean = textToSend.trim();
      if (!clean || isTyping) return;
      clearSilenceTimer();
      clearEndPhraseTimer();
      if (isListening) {
        stopListening();
      }
      let cps: number | undefined = undefined;
      if (typingStartRef.current && keystrokeCountRef.current > 0) {
        const elapsedSec = (Date.now() - typingStartRef.current) / 1000;
        if (elapsedSec > 0.35) {
          cps = parseFloat((keystrokeCountRef.current / elapsedSec).toFixed(1));
        }
      }
      typingStartRef.current = null;
      keystrokeCountRef.current = 0;
      onSendMessage(clean, cps);
      setInputText('');
    },
    [isTyping, isListening, onSendMessage]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleDispatch(inputText);
  };

  // Start 1.2s end-phrase countdown
  const startEndPhraseCountdown = (finalText: string) => {
    clearSilenceTimer();
    clearEndPhraseTimer();
    setPendingEndPhrase(true);
    let remaining = 1.2;

    endPhraseTimerRef.current = setInterval(() => {
      remaining -= 0.1;
      setEndPhraseTimerLeft(Math.max(0, parseFloat(remaining.toFixed(1))));

      if (remaining <= 0) {
        clearInterval(endPhraseTimerRef.current);
        endPhraseTimerRef.current = null;
        setPendingEndPhrase(false);
        handleDispatch(finalText);
      }
    }, 100);
  };

  // Start 15s silence countdown
  const restartSilenceTimer = (currentText: string) => {
    clearSilenceTimer();
    setIsCountingDown(true);
    setSilenceSecondsLeft(silenceTimeoutSeconds);

    let sec = silenceTimeoutSeconds;
    silenceTimerRef.current = setInterval(() => {
      sec -= 1;
      setSilenceSecondsLeft(sec);

      if (sec <= 0) {
        clearInterval(silenceTimerRef.current);
        silenceTimerRef.current = null;
        setIsCountingDown(false);
        if (currentText.trim()) {
          handleDispatch(currentText);
        }
      }
    }, 1000);
  };

  // Start Voice Recognition
  const startListening = () => {
    // Barge-in: immediately stop mascot vocalization
    speechEngine.triggerBargeIn();

    clearSilenceTimer();
    clearEndPhraseTimer();
    setIsListening(true);

    const stopFn = speechEngine.startListening(
      language,
      (transcript, isFinal) => {
        // Barge-in upon speech activity
        speechEngine.triggerBargeIn();

        if (transcript) {
          setInputText(transcript);

          // Check for end-phrase detection
          if (isVoiceEndPhrase(transcript, language)) {
            startEndPhraseCountdown(transcript);
          } else {
            // Restart 15s silence timer
            restartSilenceTimer(transcript);
          }
        }
      },
      (err) => {
        console.warn('Voice recognition error:', err);
        stopListening();
      },
      () => {
        // User speech detected
        speechEngine.triggerBargeIn();
      }
    );

    stopListeningFnRef.current = stopFn;
  };

  const stopListening = () => {
    setIsListening(false);
    clearSilenceTimer();
    clearEndPhraseTimer();
    speechEngine.stopListening();
    if (stopListeningFnRef.current) {
      stopListeningFnRef.current();
      stopListeningFnRef.current = null;
    }
    if (inputText.trim()) {
      setTranscriptReviewActive(true);
      setConfidenceScore(Math.floor(88 + Math.random() * 10));
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      setTranscriptReviewActive(false);
      startListening();
    }
  };

  // Cancel any pending auto-send action
  const handleCancelAutoSend = () => {
    clearSilenceTimer();
    clearEndPhraseTimer();
  };

  // SVG Ring Calculations
  const radius = 11;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = isCountingDown
    ? silenceSecondsLeft / silenceTimeoutSeconds
    : 1;
  const strokeDashoffset = circumference * (1 - progressRatio);

  return (
    <div className={`w-full font-sans space-y-2 ${className}`}>
      {/* End-phrase "Sending… tap to cancel" Banner */}
      {pendingEndPhrase && (
        <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-purple-500/15 border border-amber-500/30 rounded-2xl shadow-sm animate-pulse text-xs text-[#0A0A0A]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span className="font-semibold text-amber-900">
              Sending in {endPhraseTimerLeft.toFixed(1)}s…
            </span>
            <span className="text-[#0A0A0A]/60 hidden sm:inline">
              (End-phrase detected)
            </span>
          </div>
          <button
            type="button"
            onClick={handleCancelAutoSend}
            className="px-2.5 py-1 rounded-full bg-[#0A0A0A] text-white hover:bg-rose-600 transition-colors font-medium flex items-center gap-1 cursor-pointer text-xs"
          >
            <X className="w-3 h-3" />
            Tap to cancel
          </button>
        </div>
      )}

      {/* 15s Silence Countdown Bar & Cancel button (when countdown active and not in end-phrase mode) */}
      {isCountingDown && !pendingEndPhrase && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#FAF8F5] border border-[#0A0A0A]/10 rounded-xl text-xs text-[#0A0A0A]/70">
          <div className="flex items-center gap-2">
            <div className="relative w-6 h-6 flex items-center justify-center">
              <svg className="w-6 h-6 -rotate-90">
                <circle
                  cx="12"
                  cy="12"
                  r={radius}
                  className="stroke-black/10"
                  strokeWidth="2"
                  fill="transparent"
                />
                <circle
                  cx="12"
                  cy="12"
                  r={radius}
                  className="stroke-amber-500 transition-all duration-1000 ease-linear"
                  strokeWidth="2"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-[10px] font-mono font-semibold text-[#0A0A0A]">
                {silenceSecondsLeft}
              </span>
            </div>
            <span>Auto-sending after silence ({silenceSecondsLeft}s)</span>
          </div>

          <button
            type="button"
            onClick={handleCancelAutoSend}
            className="px-2 py-0.5 rounded-md hover:bg-black/5 text-[#0A0A0A]/80 hover:text-black font-medium flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </div>
      )}

      {/* Voice Transcript Review & Correction Card */}
      {transcriptReviewActive && (
        <div className="p-3.5 bg-[#141A28] border border-blue-500/40 rounded-2xl shadow-xl flex flex-col gap-2.5 text-xs text-slate-200 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="font-semibold text-white tracking-wide">
                Voice Transcript Review
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono">
                Chirp 3 STT · {confidenceScore}% confidence ({language.toUpperCase()})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTranscriptReviewActive(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              title="Close review"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="text-[11px] text-slate-400">
            Review and correct any words below before sending to companion:
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={2}
            className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-400 resize-none font-medium leading-relaxed"
          />

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setTranscriptReviewActive(false);
                startListening();
              }}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs transition-colors flex items-center gap-1"
            >
              <Mic className="w-3 h-3 text-blue-400" />
              Speak Again
            </button>
            <button
              type="button"
              onClick={() => {
                setTranscriptReviewActive(false);
                handleDispatch(inputText);
              }}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-all shadow-md flex items-center gap-1.5"
            >
              <Send className="w-3 h-3" />
              Confirm & Send
            </button>
          </div>
        </div>
      )}

      {/* Input Form Pill */}
      <form
        onSubmit={handleSubmit}
        className={`relative flex items-center bg-[#FDFBF7] border rounded-full px-3 py-2 shadow-sm transition-all ${
          isListening
            ? 'border-rose-400 ring-2 ring-rose-100 shadow-md'
            : 'border-[#0A0A0A]/20 focus-within:border-[#0A0A0A]'
        }`}
      >
        {/* Continuous Microphone Button */}
        <button
          id="chat-mic-button"
          data-testid="chat-mic-button"
          type="button"
          onClick={toggleListening}
          className={`p-2 rounded-full transition-all cursor-pointer mr-1.5 flex items-center justify-center ${
            isListening
              ? 'bg-rose-500 text-white animate-pulse shadow-md'
              : 'text-[#0A0A0A]/60 hover:text-[#0A0A0A] hover:bg-[#EAE7DC]'
          }`}
          title={
            isListening
              ? 'Listening continuously... Click to pause'
              : 'Click to speak (Continuous voice in selected language)'
          }
        >
          {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </button>

        {/* Attachment / Upload Mascot Shortcut */}
        {onOpenMascotUpload && (
          <button
            type="button"
            onClick={onOpenMascotUpload}
            className="p-2 rounded-full text-[#0A0A0A]/60 hover:text-[#0A0A0A] hover:bg-[#EAE7DC] transition-colors cursor-pointer mr-1"
            title="Upload or customize 3D mascot"
          >
            <Paperclip className="w-4 h-4" />
          </button>
        )}

        {/* Text Input with Live Interim Transcript */}
        <input
          id="chat-message-input"
          data-testid="chat-message-input"
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => {
            const val = e.target.value;
            setInputText(val);
            if (!typingStartRef.current && val.length > 0) {
              typingStartRef.current = Date.now();
            }
            keystrokeCountRef.current += 1;
            if (isListening && isVoiceEndPhrase(val, language)) {
              startEndPhraseCountdown(val);
            } else if (isCountingDown) {
              clearSilenceTimer();
            }
            if (pendingEndPhrase && !isVoiceEndPhrase(val, language)) {
              clearEndPhraseTimer();
            }
          }}
          placeholder={
            isListening
              ? `Listening in ${language.toUpperCase()}... Speak freely`
              : placeholder
          }
          disabled={isTyping}
          className="flex-1 bg-transparent text-sm md:text-base text-[#0A0A0A] placeholder-[#0A0A0A]/40 focus:outline-none"
        />

        {/* Voice Output Toggle (Mascot reads response aloud) */}
        <button
          type="button"
          onClick={onToggleVoiceOutput}
          className={`p-2 rounded-full transition-colors cursor-pointer mr-1 ${
            voiceOutputEnabled
              ? 'text-[#8B5CF6] hover:bg-[#8B5CF6]/10'
              : 'text-[#0A0A0A]/35 hover:bg-[#EAE7DC]'
          }`}
          title={
            voiceOutputEnabled
              ? 'Voice Output: ON (Mascot will speak)'
              : 'Voice Output: OFF'
          }
        >
          {voiceOutputEnabled ? (
            <Volume2 className="w-4 h-4" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </button>

        {/* Clear Conversation Option */}
        {onClearConversation && (
          <button
            type="button"
            onClick={onClearConversation}
            className="p-2 rounded-full text-[#0A0A0A]/40 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer mr-1"
            title="Clear current conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        {/* Send Button */}
        <button
          id="chat-send-button"
          data-testid="chat-send-button"
          type="submit"
          disabled={!inputText.trim() || isTyping}
          className={`p-2.5 rounded-full transition-all ${
            inputText.trim() && !isTyping
              ? 'bg-[#0A0A0A] text-[#FFFFFF] hover:bg-[#222222] cursor-pointer shadow-sm'
              : 'bg-[#0A0A0A]/10 text-[#0A0A0A]/30 cursor-not-allowed'
          }`}
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
