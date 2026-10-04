import React from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Headphones, Volume2 } from 'lucide-react';

interface VoiceWaveformBarProps {
  isListening: boolean;
  isAvatarSpeaking: boolean;
  handsFreeMode: boolean;
  onToggleListening: () => void;
  onToggleHandsFree: () => void;
  sttTranscript: string;
  language: string;
}

export const VoiceWaveformBar: React.FC<VoiceWaveformBarProps> = ({
  isListening,
  isAvatarSpeaking,
  handsFreeMode,
  onToggleListening,
  onToggleHandsFree,
  sttTranscript,
  language,
}) => {
  const triggerHaptic = (ms = 15) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch (_) {}
    }
  };

  // 12 dynamic audio waveform heights for smooth visualizer
  const barHeights = [14, 28, 42, 20, 56, 32, 48, 22, 60, 36, 24, 16];

  return (
    <div className="flex flex-col gap-2 p-2.5 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-xl transition-all">
      <div className="flex items-center justify-between gap-3">
        {/* Big Mic Button */}
        <div className="flex items-center gap-3">
          <div className="relative">
            {isListening && (
              <span className="absolute -inset-1.5 rounded-full bg-rose-500/30 animate-ping pointer-events-none" />
            )}
            <button
              onClick={() => {
                triggerHaptic(25);
                onToggleListening();
              }}
              aria-label={isListening ? 'Stop listening' : 'Start speaking with microphone'}
              className={`relative z-10 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                isListening
                  ? 'bg-gradient-to-tr from-rose-600 to-red-500 text-white shadow-rose-500/40 scale-105 ring-2 ring-rose-400'
                  : 'bg-white/10 hover:bg-white/20 text-white/90 border border-white/20 hover:scale-105 active:scale-95'
              }`}
            >
              {isListening ? (
                <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <Mic className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </button>
          </div>

          {/* Status & Live Waveform */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-tight text-white flex items-center gap-1.5">
                {isListening ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                    <span className="text-rose-300">Listening in {language.toUpperCase()}...</span>
                  </>
                ) : isAvatarSpeaking ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                    <span className="text-cyan-300">Twin speaking out loud...</span>
                  </>
                ) : (
                  <span className="text-white/70">Voice Mode</span>
                )}
              </span>
            </div>

            {/* Live Waveform Bars */}
            <div className="flex items-center gap-1 h-6 mt-1">
              {barHeights.map((h, i) => (
                <motion.div
                  key={i}
                  animate={{
                    height: isListening
                      ? [h * 0.3, h, h * 0.5, h * 0.8, h * 0.3]
                      : isAvatarSpeaking
                      ? [h * 0.2, h * 0.6, h * 0.4]
                      : 4,
                    opacity: isListening ? 1 : isAvatarSpeaking ? 0.8 : 0.25,
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 0.6 + (i % 4) * 0.15,
                    ease: 'easeInOut',
                    delay: i * 0.04,
                  }}
                  className={`w-1 rounded-full ${
                    isListening
                      ? 'bg-rose-400'
                      : isAvatarSpeaking
                      ? 'bg-cyan-400'
                      : 'bg-white/40'
                  }`}
                  style={{ minHeight: '4px' }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Hands-Free Conversation Toggle Pill */}
        <div className="flex items-center">
          <button
            onClick={() => {
              triggerHaptic(15);
              onToggleHandsFree();
            }}
            aria-pressed={handsFreeMode}
            aria-label="Toggle hands-free conversation mode"
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-all duration-200 ${
              handsFreeMode
                ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200 shadow-md shadow-cyan-500/20 scale-105'
                : 'bg-white/5 border-white/15 text-white/50 hover:text-white/80 hover:border-white/30'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Hands-Free:</span>
            <span>{handsFreeMode ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Transcript feedback banner when speaking */}
      {isListening && sttTranscript && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="text-xs font-mono text-white/80 px-2 py-1 bg-white/5 rounded-lg border border-white/10 truncate"
        >
          <span className="text-white/40 mr-1.5">You:</span>
          "{sttTranscript}"
        </motion.div>
      )}
    </div>
  );
};
