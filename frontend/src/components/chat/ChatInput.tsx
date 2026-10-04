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
  onSendMessage: (text: string) => void;
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

  const inputRef = useRef<HTMLInputElement>(null);
  const silenceTimerRef = useRef<any>(null);
  const endPhraseTimerRef = useRef<any>(null);
  const stopListeningFnRef = useRef<(() => void) | null>(null);

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
      onSendMessage(clean);
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
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
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
