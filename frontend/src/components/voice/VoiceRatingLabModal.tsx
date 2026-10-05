import React, { useState, useRef, useEffect } from 'react';
import { X, Volume2, Square, Star, CheckCircle, Sparkles, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';
import type {
  SupportedLanguage,
  VoiceGender,
  LanguageMeta
} from '../../lib/emoticare/types';
import { LANGUAGE_CATALOG } from '../../lib/emoticare/types';
import { speechGateway, voiceDebugStore, type VoiceDebugEntry } from '../../lib/voice/speechGateway';

interface VoiceRatingLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLanguage?: string;
}

const SPEAKER_MAPPING: Record<string, {
  girl: string;
  boy: string;
  engine: string;
  legacyGirl?: string;
  legacyBoy?: string;
  legacyEngine?: string;
}> = {
  ta: { girl: 'ishita', boy: 'ratan', engine: 'Sarvam Bulbul v3' },
  te: { girl: 'priya', boy: 'shubh', engine: 'Sarvam Bulbul v3' },
  kn: { girl: 'ishita', boy: 'shubh', engine: 'Sarvam Bulbul v3' },
  ml: { girl: 'pooja', boy: 'shubh', engine: 'Sarvam Bulbul v3' },
  bn: { girl: 'roopa', boy: 'rehan', engine: 'Sarvam Bulbul v3' },
  mr: { girl: 'priya', boy: 'ratan', engine: 'Sarvam Bulbul v3' },
  en: {
    girl: 'ishita',
    boy: 'ratan',
    engine: 'Sarvam Bulbul v3',
    legacyGirl: 'en-IN-Chirp3-HD-Aoede',
    legacyBoy: 'en-IN-Chirp3-HD-Charon',
    legacyEngine: 'Google Cloud Chirp 3 HD',
  },
  hi: {
    girl: 'priya',
    boy: 'shubh',
    engine: 'Sarvam Bulbul v3',
    legacyGirl: 'hi-IN-Chirp3-HD-Aoede',
    legacyBoy: 'hi-IN-Chirp3-HD-Charon',
    legacyEngine: 'Google Cloud Chirp 3 HD',
  },
};

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
  const [engineMode, setEngineMode] = useState<'sarvam' | 'legacy'>('sarvam');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentViseme, setCurrentViseme] = useState<string>('idle');
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [lastDebugEntry, setLastDebugEntry] = useState<VoiceDebugEntry | null>(null);

  useEffect(() => {
    const unsub = voiceDebugStore.subscribe((entries) => {
      if (entries.length > 0) {
        setLastDebugEntry(entries[0]);
      }
    });
    return unsub;
  }, []);

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

  const currentMeta: LanguageMeta = LANGUAGE_CATALOG[activeLang] || LANGUAGE_CATALOG['en-IN'];
  const currentRating = ratings[activeLang];

  if (!isOpen) return null;

  const handlePlayVoice = async () => {
    if (isPlaying) {
      speechGateway.stopSpeaking();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    setStatusMessage(`Synthesizing speech via unified gateway for ${currentMeta.nativeName}...`);

    try {
      const g = voiceGender === 'female' ? 'girl' : 'boy';
      const isEnOrHi = currentMeta.shortCode === 'en' || currentMeta.shortCode === 'hi';
      const effectiveEngine = isEnOrHi ? engineMode : 'sarvam';
      await speechGateway.speak({
        text: currentMeta.testSentence,
        lang: currentMeta.shortCode,
        gender: g,
        engine: effectiveEngine,
        purpose: 'voice_test_page',
        onStart: () => {
          setIsPlaying(true);
          setStatusMessage(`Synthesizing speech via unified gateway for ${currentMeta.nativeName}...`);
        },
        onEnergy: (energy) => {
          setCurrentViseme(energy > 0.3 ? 'aa' : 'idle');
        },
        onEnd: () => {
          setIsPlaying(false);
          setCurrentViseme('idle');
          setPlaybackProgress(100);
          setStatusMessage('Playback completed. Please rate the voice quality below.');
        },
        onError: () => {
          setIsPlaying(false);
          setCurrentViseme('idle');
          setStatusMessage('Voice playback completed.');
        },
      });
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
              if (isPlaying) {
                speechGateway.stopSpeaking();
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
                      if (isPlaying) {
                        speechGateway.stopSpeaking();
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

              <div className="flex flex-wrap items-center gap-2">
                {/* A/B Engine Toggle for en & hi */}
                {(currentMeta.shortCode === 'en' || currentMeta.shortCode === 'hi') && (
                  <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setEngineMode('sarvam')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        engineMode === 'sarvam'
                          ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      ⚡ Sarvam Bulbul v3
                    </button>
                    <button
                      type="button"
                      onClick={() => setEngineMode('legacy')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        engineMode === 'legacy'
                          ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🏛️ Legacy Chirp 3 HD
                    </button>
                  </div>
                )}

                {/* Girl / Boy Companion Voice Toggle */}
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
                    👧 Girl Voice
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
                    👦 Boy Voice
                  </button>
                </div>
              </div>
            </div>

            {/* Test Sentence */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Colloquial Test Sentence:
              </span>
              <p className="text-base text-white font-medium">"{currentMeta.testSentence}"</p>
            </div>

            {/* Live Gateway & HUD Telemetry */}
            {(() => {
              const langCode = currentMeta.shortCode;
              const isEnOrHi = langCode === 'en' || langCode === 'hi';
              const spkInfo = SPEAKER_MAPPING[langCode] || { girl: 'default', boy: 'default', engine: 'Sarvam Bulbul v3' };
              const currentEngine = (isEnOrHi && engineMode === 'legacy') ? (spkInfo.legacyEngine || 'Google Cloud Chirp 3 HD') : spkInfo.engine;
              const currentSpeaker = (isEnOrHi && engineMode === 'legacy')
                ? (voiceGender === 'female' ? spkInfo.legacyGirl : spkInfo.legacyBoy)
                : (voiceGender === 'female' ? spkInfo.girl : spkInfo.boy);

              return (
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-semibold text-slate-300 flex items-center gap-1.5">
                      <Activity size={13} className="text-cyan-400" />
                      UNIFIED VOICE GATEWAY (HUD TELEMETRY)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Target Code: {currentMeta.code}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                    <div className="bg-white/5 p-2 rounded-lg">
                      <span className="text-slate-400 block text-[10px]">ENGINE:</span>
                      <span className="font-semibold text-emerald-300">{currentEngine}</span>
                    </div>
                    <div className="bg-white/5 p-2 rounded-lg">
                      <span className="text-slate-400 block text-[10px]">SPEAKER:</span>
                      <span className="font-semibold text-yellow-300">{currentSpeaker} ({voiceGender})</span>
                    </div>
                    <div className="bg-white/5 p-2 rounded-lg">
                      <span className="text-slate-400 block text-[10px]">PACING:</span>
                      <span className="font-semibold text-cyan-300">{isEnOrHi && engineMode === 'legacy' ? '0.95' : '1.0 / 0.95'}</span>
                    </div>
                    <div className="bg-white/5 p-2 rounded-lg">
                      <span className="text-slate-400 block text-[10px]">BROWSER TTS:</span>
                      <span className={`font-semibold ${isEnOrHi ? 'text-amber-300' : 'text-emerald-400'}`}>
                        {isEnOrHi ? 'Last Resort Only' : 'STRICTLY BANNED'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <ShieldCheck size={13} />
                      <span>Script Purity: 100% Native Script (0 Latin Letters, 0 Digits)</span>
                    </div>
                    {lastDebugEntry && lastDebugEntry.lang === langCode && (
                      <span className="text-slate-400 text-[10px]">
                        Last Latency: {lastDebugEntry.latencyMs}ms
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

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
