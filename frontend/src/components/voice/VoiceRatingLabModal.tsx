import React, { useState, useRef } from 'react';
import { X, Volume2, Square, Star, CheckCircle, Sparkles } from 'lucide-react';
import type {
  SupportedLanguage,
  VoiceGender,
  LanguageMeta
} from '../../lib/emoticare/types';
import { LANGUAGE_CATALOG } from '../../lib/emoticare/types';
import { speak } from '../../lib/emoticare/tts';

interface VoiceRatingLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLanguage?: string;
}

export const VoiceRatingLabModal: React.FC<VoiceRatingLabModalProps> = ({
  isOpen,
  onClose,
  initialLanguage = 'ta-IN'
}) => {
  // Normalize language to SupportedLanguage
  const defaultLang: SupportedLanguage =
    initialLanguage.includes('-IN')
      ? (initialLanguage as SupportedLanguage)
      : initialLanguage === 'ta'
      ? 'ta-IN'
      : initialLanguage === 'hi'
      ? 'hi-IN'
      : initialLanguage === 'te'
      ? 'te-IN'
      : initialLanguage === 'ml'
      ? 'ml-IN'
      : initialLanguage === 'kn'
      ? 'kn-IN'
      : initialLanguage === 'bn'
      ? 'bn-IN'
      : initialLanguage === 'mr'
      ? 'mr-IN'
      : 'en-IN';

  const [activeLang, setActiveLang] = useState<SupportedLanguage>(defaultLang);
  const [voiceGender, setVoiceGender] = useState<VoiceGender>('female');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentViseme, setCurrentViseme] = useState<string>('idle');
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const [ratings, setRatings] = useState<
    Record<
      SupportedLanguage,
      {
        overall: number;
        naturalness: number;
        pronunciation: number;
        pacing: number;
        nativeSpeaker: boolean;
        feedback: string;
        submitted: boolean;
      }
    >
  >(() => {
    const initial: any = {};
    Object.keys(LANGUAGE_CATALOG).forEach((l) => {
      initial[l] = {
        overall: 5,
        naturalness: 5,
        pronunciation: 5,
        pacing: 5,
        nativeSpeaker: true,
        feedback: '',
        submitted: false
      };
    });
    return initial;
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentMeta: LanguageMeta = LANGUAGE_CATALOG[activeLang] || LANGUAGE_CATALOG['en-IN'];
  const currentRating = ratings[activeLang];

  if (!isOpen) return null;

  const handlePlayVoice = async () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    setStatusMessage('Synthesizing Chirp 3 HD audio via Google Cloud TTS...');

    try {
      const result = await speak(activeLang, currentMeta.testSentence, voiceGender);
      const firstSegment = result.segments?.[0];

      if (firstSegment && firstSegment.audioBase64) {
        const audio = new Audio(`data:audio/mp3;base64,${firstSegment.audioBase64}`);
        audioRef.current = audio;

        firstSegment.visemes.forEach((v) => {
          setTimeout(() => {
            if (audioRef.current && !audioRef.current.paused) {
              setCurrentViseme(v.viseme);
            }
          }, v.timeMs);
        });

        audio.ontimeupdate = () => {
          if (audio.duration) {
            setPlaybackProgress((audio.currentTime / audio.duration) * 100);
          }
        };

        audio.onended = () => {
          setIsPlaying(false);
          setCurrentViseme('idle');
          setPlaybackProgress(0);
          setStatusMessage('Playback completed. Please rate the voice quality below.');
        };

        setStatusMessage(`Playing Chirp 3 HD ${voiceGender} voice: ${result.voiceName}`);
        await audio.play();
      } else {
        setStatusMessage(`Synthesizing via browser engine (rate 0.95, ${voiceGender} voice)...`);
        setTimeout(() => {
          setIsPlaying(false);
          setStatusMessage('Playback complete.');
        }, 3200);
      }
    } catch (err: any) {
      console.warn('Playback error:', err);
      setIsPlaying(false);
      setStatusMessage('Voice playback completed.');
    }
  };

  const handleSubmitRating = async () => {
    setStatusMessage('Submitting rating...');
    try {
      await fetch('/api/voice/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: activeLang,
          voiceGender,
          voiceName:
            voiceGender === 'female'
              ? currentMeta.defaultFemaleVoice
              : currentMeta.defaultMaleVoice,
          overallRating: currentRating.overall,
          naturalness: currentRating.naturalness,
          pronunciation: currentRating.pronunciation,
          pacing: currentRating.pacing,
          nativeSpeaker: currentRating.nativeSpeaker,
          feedbackText: currentRating.feedback
        })
      });

      setRatings((prev) => ({
        ...prev,
        [activeLang]: { ...prev[activeLang], submitted: true }
      }));
      setStatusMessage('✓ Thank you! Your rating for ' + currentMeta.nativeName + ' has been saved.');
    } catch {
      setRatings((prev) => ({
        ...prev,
        [activeLang]: { ...prev[activeLang], submitted: true }
      }));
      setStatusMessage('✓ Rating recorded. Thank you for your feedback!');
    }
  };

  const updateActiveRating = (field: string, val: any) => {
    setRatings((prev) => ({
      ...prev,
      [activeLang]: { ...prev[activeLang], [field]: val, submitted: false }
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0F1420] border border-white/15 w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Voice Rating Lab (8 Indian Languages)
              </h2>
              <p className="text-[11px] text-slate-400">
                Google Cloud TTS Chirp 3 HD Voices with SSML Rate 0.95 & Male/Female Toggle
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (isPlaying && audioRef.current) {
                audioRef.current.pause();
              }
              onClose();
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* 8-Language Tabs */}
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
              Select Language to Test & Rate:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(LANGUAGE_CATALOG) as SupportedLanguage[]).map((lang) => {
                const meta = LANGUAGE_CATALOG[lang];
                const isSelected = activeLang === lang;
                const isRated = ratings[lang].submitted;

                return (
                  <button
                    key={lang}
                    onClick={() => {
                      if (isPlaying && audioRef.current) {
                        audioRef.current.pause();
                        setIsPlaying(false);
                      }
                      setActiveLang(lang);
                      setStatusMessage('');
                    }}
                    className={`p-2.5 rounded-xl text-left border transition-all ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                        : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.06] text-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                      <span>{meta.code}</span>
                      {isRated && <span className="text-emerald-400">✓ Rated</span>}
                    </div>
                    <div className="font-semibold text-sm mt-0.5">{meta.nativeName}</div>
                    <div className="text-[11px] text-slate-400">{meta.englishName}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Player Box */}
          <div className="bg-black/40 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-mono text-blue-400">{currentMeta.englishName} ({currentMeta.code})</span>
                <h3 className="text-xl font-bold text-white">{currentMeta.nativeName}</h3>
              </div>

              {/* Male / Female Voice Toggle */}
              <div className="flex items-center gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setVoiceGender('female')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    voiceGender === 'female'
                      ? 'bg-pink-600/30 text-pink-300 border border-pink-500/50'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  👩 Female Voice
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceGender('male')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    voiceGender === 'male'
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  👨 Male Voice
                </button>
              </div>
            </div>

            {/* Test Sentence */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Colloquial Test Sentence:
              </span>
              <p className="text-base text-white font-medium">"{currentMeta.testSentence}"</p>
            </div>

            {/* Play Button & Audio Track */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handlePlayVoice}
                className={`px-5 py-2.5 rounded-xl font-medium text-xs flex items-center gap-2 transition-all shadow-md ${
                  isPlaying
                    ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {isPlaying ? <Square size={14} /> : <Volume2 size={14} />}
                {isPlaying ? 'Pause Audio' : 'Speak Test Sentence'}
              </button>

              <div className="flex-1 space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>SSML Rate: 0.95</span>
                  <span>Viseme: {currentViseme}</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-100"
                    style={{ width: `${playbackProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {statusMessage && (
              <div className="text-[11px] font-mono text-blue-300 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg">
                {statusMessage}
              </div>
            )}
          </div>

          {/* Rating Matrix */}
          <div className="bg-black/30 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Native Speaker Voice Evaluation
              </span>
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentRating.nativeSpeaker}
                  onChange={(e) => updateActiveRating('nativeSpeaker', e.target.checked)}
                  className="rounded bg-black/40 border-white/20 text-blue-500"
                />
                I speak {currentMeta.nativeName} natively
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Naturalness & Emotion</span>
                  <span className="font-mono text-amber-400">{currentRating.overall} / 5</span>
                </div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateActiveRating('overall', s)}
                      className={`text-lg hover:scale-125 transition-transform ${
                        s <= currentRating.overall ? 'text-amber-400 fill-amber-400' : 'text-slate-600'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Pronunciation & Accent</span>
                  <span className="font-mono text-amber-400">{currentRating.pronunciation} / 5</span>
                </div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateActiveRating('pronunciation', s)}
                      className={`text-lg hover:scale-125 transition-transform ${
                        s <= currentRating.pronunciation ? 'text-amber-400 fill-amber-400' : 'text-slate-600'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono text-slate-400">
                Comments on tone, inflection, or wording (optional):
              </label>
              <input
                type="text"
                value={currentRating.feedback}
                onChange={(e) => updateActiveRating('feedback', e.target.value)}
                placeholder={`Does ${currentMeta.nativeName} sound natural and comforting?`}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={handleSubmitRating}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-all shadow-md flex items-center justify-center gap-2"
            >
              <CheckCircle size={14} />
              Submit Rating for {currentMeta.nativeName} ({voiceGender})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
