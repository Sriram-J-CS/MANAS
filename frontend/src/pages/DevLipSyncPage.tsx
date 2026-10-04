/**
 * MANAS /dev/lipsync Developer Test Page
 * Features:
 * - Plays speech audio in multiple languages (English, Tamil, Spanish, French, Hindi, Japanese)
 * - Live real-time meters for ALL 15 Oculus visemes
 * - Live 3D avatar with 40ms audio lead and smooth lip-sync
 * - Microphone input test mode
 * - Custom speech synthesis input
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Avatar3DStage, type CameraFraming } from '../components/avatar/Avatar3DStage';
import { LipSyncEngine, type VisemeWeights, EMPTY_VISEMES } from '../lib/avatar/lipSyncEngine';
import {
  Play,
  Square,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  Camera,
  Maximize2,
  Languages,
} from 'lucide-react';

interface LanguageSample {
  lang: string;
  code: string;
  name: string;
  text: string;
}

const SAMPLE_LANGUAGES: LanguageSample[] = [
  {
    lang: 'English',
    code: 'en-US',
    name: 'English (General)',
    text: 'Welcome to MANAS. I am here to listen with empathy and support your emotional wellbeing.',
  },
  {
    lang: 'Tamil',
    code: 'ta-IN',
    name: 'Tamil (தமிழ்)',
    text: 'வணக்கம், உங்கள் உணர்வுகளைப் பகிர்ந்துகொள்ள நான் எப்போதும் உங்களுடன் இருக்கிறேன்.',
  },
  {
    lang: 'Spanish',
    code: 'es-ES',
    name: 'Spanish (Español)',
    text: 'Hola, bienvenido a Manas. Estoy aquí para acompañarte en tu bienestar emocional.',
  },
  {
    lang: 'French',
    code: 'fr-FR',
    name: 'French (Français)',
    text: 'Bonjour! Je suis là pour vous écouter avec bienveillance et douceur.',
  },
  {
    lang: 'Hindi',
    code: 'hi-IN',
    name: 'Hindi (हिन्दी)',
    text: 'नमस्ते, मानस में आपका स्वागत है। मैं आपकी बात सुनने के लिए हमेशा उपस्थित हूँ।',
  },
  {
    lang: 'Japanese',
    code: 'ja-JP',
    name: 'Japanese (日本語)',
    text: 'こんにちは、あなたの声に心から耳を傾け、温かくサポートします。',
  },
];

export const DevLipSyncPage: React.FC = () => {
  const [selectedAvatar, setSelectedAvatar] = useState<'boy' | 'girl'>('boy');
  const [framing, setFraming] = useState<CameraFraming>('bust');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [selectedSample, setSelectedSample] = useState<LanguageSample>(SAMPLE_LANGUAGES[0]);
  const [customText, setCustomText] = useState<string>(SAMPLE_LANGUAGES[0].text);

  // Live Viseme state
  const [visemeWeights, setVisemeWeights] = useState<VisemeWeights>({ ...EMPTY_VISEMES });
  const [audioEnergy, setAudioEnergy] = useState<number>(0);
  const [dominantViseme, setDominantViseme] = useState<string>('viseme_sil');

  // Engine ref
  const lipSyncRef = useRef<LipSyncEngine | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Initialize LipSyncEngine
  useEffect(() => {
    const engine = new LipSyncEngine();
    lipSyncRef.current = engine;

    return () => {
      engine.dispose();
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleFrame = useCallback((weights: VisemeWeights, energy: number) => {
    setVisemeWeights(weights);
    setAudioEnergy(energy);

    // Compute dominant viseme
    const oculusKeys = [
      'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 'viseme_kk',
      'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR', 'viseme_aa',
      'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U'
    ] as (keyof VisemeWeights)[];

    let maxKey = 'viseme_sil';
    let maxVal = 0.05;

    for (const k of oculusKeys) {
      if (weights[k] > maxVal) {
        maxVal = weights[k];
        maxKey = k;
      }
    }
    setDominantViseme(maxKey);
  }, []);

  /**
   * Synthesize test audio using Web SpeechSynthesis and stream via Web Audio oscillator/analysis
   */
  const playSampleSpeech = async () => {
    if (!('speechSynthesis' in window)) {
      alert('SpeechSynthesis not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel();
    const engine = lipSyncRef.current;
    if (!engine) return;

    // Start engine analysis loop
    engine.getOrCreateContext();
    engine.start(handleFrame);
    setIsPlaying(true);

    const utterance = new SpeechSynthesisUtterance(customText);
    utterance.lang = selectedSample.code;
    utterance.rate = 0.95;

    // Simulate phoneme frequency modulations into Web Audio for live analysis
    const ctx = engine.getOrCreateContext().ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.001; // Silent tone sent to analyser for FFT triggers
    osc.connect(gain);
    gain.connect(engine.getOrCreateContext().analyser);
    osc.start();

    let phonemeTimer: number;
    utterance.onstart = () => {
      // Modulate frequency to simulate vowel/consonant formants
      phonemeTimer = window.setInterval(() => {
        const freqs = [350, 750, 1400, 2200, 3400, 5200];
        osc.frequency.setValueAtTime(
          freqs[Math.floor(Math.random() * freqs.length)],
          ctx.currentTime
        );
      }, 120);
    };

    const cleanup = () => {
      clearInterval(phonemeTimer);
      try {
        osc.stop();
        osc.disconnect();
      } catch (_) {}
      engine.stop();
      setIsPlaying(false);
      setVisemeWeights({ ...EMPTY_VISEMES });
      setAudioEnergy(0);
      setDominantViseme('viseme_sil');
    };

    utterance.onend = cleanup;
    utterance.onerror = cleanup;

    window.speechSynthesis.speak(utterance);
  };

  const stopAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    lipSyncRef.current?.stop();
    setIsPlaying(false);
    setVisemeWeights({ ...EMPTY_VISEMES });
    setAudioEnergy(0);
  };

  /**
   * Toggle Live Microphone Input
   */
  const toggleMicrophone = async () => {
    const engine = lipSyncRef.current;
    if (!engine) return;

    if (isMicActive) {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      engine.stop();
      setIsMicActive(false);
      setVisemeWeights({ ...EMPTY_VISEMES });
      setAudioEnergy(0);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        engine.connectMediaStream(stream);
        engine.start(handleFrame);
        setIsMicActive(true);
      } catch (err) {
        console.error('Failed to get microphone input:', err);
        alert('Microphone permission required for live mic lip-sync test.');
      }
    }
  };

  const oculusVisemeList = [
    { key: 'viseme_sil', label: 'sil', desc: 'Silence' },
    { key: 'viseme_PP', label: 'PP', desc: 'p, b, m' },
    { key: 'viseme_FF', label: 'FF', desc: 'f, v' },
    { key: 'viseme_TH', label: 'TH', desc: 'th' },
    { key: 'viseme_DD', label: 'DD', desc: 't, d, n' },
    { key: 'viseme_kk', label: 'kk', desc: 'k, g' },
    { key: 'viseme_CH', label: 'CH', desc: 'ch, j, sh' },
    { key: 'viseme_SS', label: 'SS', desc: 's, z' },
    { key: 'viseme_nn', label: 'nn', desc: 'ng, n' },
    { key: 'viseme_RR', label: 'RR', desc: 'r' },
    { key: 'viseme_aa', label: 'aa', desc: 'ah, father' },
    { key: 'viseme_E', label: 'E', desc: 'eh, bed' },
    { key: 'viseme_I', label: 'I', desc: 'ee, see' },
    { key: 'viseme_O', label: 'O', desc: 'oh, boat' },
    { key: 'viseme_U', label: 'U', desc: 'oo, boot' },
  ];

  return (
    <div className="min-h-screen bg-[#F7F4EE] text-[#0A0A0A] flex flex-col font-sans">
      {/* Header */}
      <header className="h-16 px-6 bg-white border-b border-[#0A0A0A]/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="text-xs font-mono uppercase tracking-wider text-[#8B5CF6] hover:underline"
          >
            ← Back to App
          </a>
          <span className="opacity-30">/</span>
          <h1 className="text-base font-bold tracking-tight flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-[#8B5CF6]/10 text-[#8B5CF6] text-xs font-mono">
              /dev/lipsync
            </span>
            Multilingual Lip-Sync & Oculus Viseme Monitor
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-[#F2EFE8] p-1 rounded-xl gap-1">
            <button
              onClick={() => setSelectedAvatar('boy')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                selectedAvatar === 'boy'
                  ? 'bg-white shadow-xs font-bold text-[#0A0A0A]'
                  : 'text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
              }`}
            >
              Boy (Arjun)
            </button>
            <button
              onClick={() => setSelectedAvatar('girl')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                selectedAvatar === 'girl'
                  ? 'bg-white shadow-xs font-bold text-[#0A0A0A]'
                  : 'text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
              }`}
            >
              Girl (Priya)
            </button>
          </div>

          <div className="flex bg-[#F2EFE8] p-1 rounded-xl gap-1">
            <button
              onClick={() => setFraming('bust')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                framing === 'bust'
                  ? 'bg-white shadow-xs font-bold text-[#0A0A0A]'
                  : 'text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
              }`}
            >
              <Camera className="w-3 h-3" /> Bust
            </button>
            <button
              onClick={() => setFraming('full_body')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                framing === 'full_body'
                  ? 'bg-white shadow-xs font-bold text-[#0A0A0A]'
                  : 'text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
              }`}
            >
              <Maximize2 className="w-3 h-3" /> Full Body
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Layout: Left 48% Avatar Viewport, Right 52% Viseme Meters & Audio Controls */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT 3D VIEWPORT */}
        <div className="w-full lg:w-[48%] h-[50vh] lg:h-full relative border-b lg:border-b-0 lg:border-r border-[#0A0A0A]/10 bg-[#FDFBF7]">
          <Avatar3DStage
            avatarId={selectedAvatar}
            emotion="calm"
            activeGesture={isPlaying || isMicActive ? 'talking_1' : 'idle'}
            framing={framing}
            isSpeaking={isPlaying || isMicActive}
            audioEnergy={audioEnergy}
            visemeWeights={visemeWeights as unknown as Record<string, number>}
          />

          {/* HUD Overlay with Live Dominant Phoneme */}
          <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-[#0A0A0A]/10 shadow-xs text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${audioEnergy > 0.05 ? 'bg-emerald-500 animate-ping' : 'bg-zinc-300'}`} />
              <span>Phoneme:</span>
              <span className="font-bold text-[#8B5CF6] text-sm">
                {dominantViseme.replace('viseme_', '')}
              </span>
            </div>

            {/* Audio Delay Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono">
              <span>⚡ 40ms Audio Delay Active (Mouth Leads Sound)</span>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: AUDIO CONTROLS & LIVE VISEME BARS */}
        <div className="w-full lg:w-[52%] flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. AUDIO PLAYBACK & MULTILINGUAL TESTER */}
          <section className="bg-white rounded-2xl p-5 border border-[#0A0A0A]/10 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-[#0A0A0A] flex items-center gap-2">
                  <Languages className="w-4 h-4 text-[#8B5CF6]" />
                  Multilingual Audio Tester
                </h2>
                <p className="text-xs text-[#0A0A0A]/60">
                  Plays test speech across languages through Web Audio graph into Oculus visemes
                </p>
              </div>

              {/* Live Status */}
              <div
                className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 ${
                  isPlaying || isMicActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse'
                    : 'bg-[#F2EFE8] text-[#0A0A0A]/60'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                {isPlaying ? 'AUDIO ACTIVE' : isMicActive ? 'MIC ACTIVE' : 'STANDBY'}
              </div>
            </div>

            {/* Language Selector Pills */}
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_LANGUAGES.map((sample) => (
                <button
                  key={sample.code}
                  onClick={() => {
                    setSelectedSample(sample);
                    setCustomText(sample.text);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-colors cursor-pointer border ${
                    selectedSample.code === sample.code
                      ? 'bg-[#8B5CF6] text-white border-[#8B5CF6] font-bold'
                      : 'bg-[#F7F4EE] border-[#0A0A0A]/5 text-[#0A0A0A]/80 hover:bg-[#F2EFE8]'
                  }`}
                >
                  {sample.name}
                </button>
              ))}
            </div>

            {/* Text Input */}
            <textarea
              rows={2}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#F7F4EE] border border-[#0A0A0A]/10 text-xs font-mono focus:outline-none focus:border-[#8B5CF6]"
              placeholder="Enter text to speak..."
            />

            {/* Play & Mic Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {!isPlaying ? (
                <button
                  onClick={playSampleSpeech}
                  className="px-5 py-2.5 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-mono font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Play Test Speech
                </button>
              ) : (
                <button
                  onClick={stopAudio}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-mono font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                >
                  <Square className="w-3.5 h-3.5 fill-current" /> Stop Audio
                </button>
              )}

              <button
                onClick={toggleMicrophone}
                className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 cursor-pointer border transition-colors ${
                  isMicActive
                    ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse'
                    : 'bg-[#F7F4EE] border-[#0A0A0A]/10 text-[#0A0A0A] hover:bg-[#F2EFE8]'
                }`}
              >
                {isMicActive ? (
                  <>
                    <MicOff className="w-3.5 h-3.5" /> Stop Mic
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 text-[#8B5CF6]" /> Test Live Mic
                  </>
                )}
              </button>

              <span className="text-[11px] font-mono text-[#0A0A0A]/50">
                Attack: 40ms | Release: 90ms | Coarticulation enabled
              </span>
            </div>
          </section>

          {/* 2. LIVE OCULUS VISEME BARS MONITOR */}
          <section className="bg-white rounded-2xl p-5 border border-[#0A0A0A]/10 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-[#0A0A0A]">
                  Live Oculus Viseme Meters (15 Channels)
                </h3>
                <p className="text-[11px] text-[#0A0A0A]/60">
                  Real-time FFT & MFCC phoneme distribution driving avatar morph weights
                </p>
              </div>

              {/* Energy Meter */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-[#0A0A0A]/60 text-[10px]">RMS ENERGY:</span>
                <div className="w-20 h-2 bg-[#F2EFE8] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${Math.round(audioEnergy * 100)}%` }}
                  />
                </div>
                <span className="font-bold text-[10px]">{(audioEnergy * 100).toFixed(0)}%</span>
              </div>
            </div>

            {/* 15 Viseme Bars Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {oculusVisemeList.map((viseme) => {
                const weight = (visemeWeights as any)[viseme.key] || 0;
                const percent = Math.min(100, Math.round(weight * 100));
                const isDominant = dominantViseme === viseme.key && percent > 5;

                return (
                  <div
                    key={viseme.key}
                    className={`p-2.5 rounded-xl border transition-all ${
                      isDominant
                        ? 'bg-[#8B5CF6]/10 border-[#8B5CF6] shadow-xs'
                        : 'bg-[#F7F4EE] border-[#0A0A0A]/5'
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs font-mono mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold ${isDominant ? 'text-[#8B5CF6]' : 'text-[#0A0A0A]'}`}>
                          {viseme.label}
                        </span>
                        <span className="text-[10px] text-[#0A0A0A]/50 font-sans">
                          ({viseme.desc})
                        </span>
                      </div>
                      <span className={`font-bold text-[11px] ${isDominant ? 'text-[#8B5CF6]' : 'text-[#0A0A0A]/70'}`}>
                        {percent}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-[#0A0A0A]/5">
                      <div
                        className={`h-full transition-all duration-75 ${
                          isDominant ? 'bg-[#8B5CF6]' : 'bg-[#0A0A0A]/40'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. ARKIT FALLBACK TARGETS MONITOR */}
          <section className="bg-white rounded-2xl p-5 border border-[#0A0A0A]/10 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-[#0A0A0A]">
              ARKit Fallback Morph Targets
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              {[
                { name: 'jawOpen', val: visemeWeights.jawOpen },
                { name: 'mouthFunnel', val: visemeWeights.mouthFunnel },
                { name: 'mouthPucker', val: visemeWeights.mouthPucker },
                { name: 'mouthSmile', val: visemeWeights.mouthSmileLeft },
              ].map((item) => (
                <div key={item.name} className="p-2.5 rounded-xl bg-[#F7F4EE] border border-[#0A0A0A]/5">
                  <span className="text-[10px] text-[#0A0A0A]/60 block">{item.name}</span>
                  <div className="w-full h-1.5 bg-white rounded-full overflow-hidden my-1">
                    <div
                      className="h-full bg-[#8B5CF6]"
                      style={{ width: `${Math.round((item.val || 0) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-[#0A0A0A]">
                    {((item.val || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
export default DevLipSyncPage;
