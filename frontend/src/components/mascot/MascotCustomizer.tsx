import React, { useState, useEffect } from 'react';
import {
  Check,
  Volume2,
  RotateCcw,
  ShieldCheck,
  Upload,
  User,
  Sparkles,
  Play,
} from 'lucide-react';
import { MascotViewer } from './MascotViewer';
import { MascotUploader } from './MascotUploader';
import {
  getMascotConfig,
  saveMascotConfig,
  type MascotConfig,
  type MascotPersonality,
  type MascotBackground,
} from '../../lib/mascot/mascotConfig';
import { clearStoredMascotModel, getStoredMascotModel } from '../../lib/mascot/mascotModelStorage';
import type { MascotEmotion } from '../../lib/emotion/emotionEngine';
import { speechGateway } from '../../lib/voice/speechGateway';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../i18n/languages';
import type { UserProfile } from '../OnboardingModal';

export interface MascotCustomizerProps {
  onClose?: () => void;
  onApply?: (config: MascotConfig) => void;
  userProfile?: UserProfile;
  onUpdateProfile?: (updated: Partial<UserProfile>) => void;
}

const GIRL_TONES = [
  { id: 'ananya', name: 'Ananya', style: 'Warm & Empathetic' },
  { id: 'diya', name: 'Diya', style: 'Gentle & Soft' },
  { id: 'janani', name: 'Janani', style: 'Bright & Encouraging' },
];

const BOY_TONES = [
  { id: 'aarav', name: 'Aarav', style: 'Calm & Grounding' },
  { id: 'kabir', name: 'Kabir', style: 'Warm & Steady' },
  { id: 'arjun', name: 'Arjun', style: 'Soft & Friendly' },
];

export const MascotCustomizer: React.FC<MascotCustomizerProps> = ({
  onClose,
  onApply,
  userProfile,
  onUpdateProfile,
}) => {
  const [config, setConfig] = useState<MascotConfig>(getMascotConfig());
  const [activeTab, setActiveTab] = useState<'companion' | 'settings' | 'expressions' | 'upload'>('companion');
  const [previewEmotion, setPreviewEmotion] = useState<MascotEmotion>('calm');
  const [testSpeechEnergy, setTestSpeechEnergy] = useState<number>(0);
  const [isTestSpeaking, setIsTestSpeaking] = useState<boolean>(false);

  // Companion state
  const initialCompanion = userProfile?.companion === 'boy' || userProfile?.gender === 'boy' ? 'boy' : 'girl';
  const [companion, setCompanion] = useState<'girl' | 'boy'>(initialCompanion);
  const [voiceTone, setVoiceTone] = useState<string>(
    userProfile?.voiceTone || userProfile?.voicePref || (initialCompanion === 'boy' ? 'aarav' : 'ananya')
  );
  const [mascotName, setMascotName] = useState<string>(userProfile?.name || config.name || 'Maya');
  const [language, setLanguage] = useState<string>(userProfile?.language || 'en');

  // Uploaded model info
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [modelType, setModelType] = useState<'glb' | 'gltf' | 'fbx' | 'obj' | 'image' | null>(null);

  // Load custom model if exists
  useEffect(() => {
    getStoredMascotModel().then((stored) => {
      if (stored) {
        setModelUrl(stored.objectUrl);
        setModelType(stored.fileType);
      }
    });
  }, []);

  const availableTones = companion === 'boy' ? BOY_TONES : GIRL_TONES;

  const handleCompanionChange = (newCompanion: 'girl' | 'boy') => {
    setCompanion(newCompanion);
    const validTones = newCompanion === 'boy' ? BOY_TONES : GIRL_TONES;
    if (!validTones.some((t) => t.id === voiceTone)) {
      setVoiceTone(validTones[0].id);
    }
  };

  const handleTestVoice = () => {
    setIsTestSpeaking(true);
    const samples: Record<string, string> = {
      en: `Hello! I am ${mascotName}, your ${companion === 'girl' ? 'girl' : 'boy'} companion with ${voiceTone} voice tone.`,
      hi: `नमस्ते! मैं ${mascotName} हूँ, आपका साथी। मैं हमेशा आपके साथ हूँ।`,
      ta: `வணக்கம்! நான் ${mascotName}, உங்கள் துணை. நான் எப்போதும் உங்களுடன் இருப்பேன்.`,
      te: `నమస్కారం! నేను ${mascotName}, మీ తోడుగా ఉంటాను.`,
      kn: `ನಮಸ್ಕಾರ! ನಾನು ${mascotName}, ನಿಮ್ಮ ಗೆಳೆಯ.`,
      ml: `നമസ്കാരം! ഞാൻ ${mascotName}, നിങ്ങളുടെ കൂടെയുണ്ട്.`,
      bn: `নমস্কার! আমি ${mascotName}, আপনার বন্ধু।`,
      mr: `नमस्कार! मी ${mascotName}, तुमचा साथीदार आहे.`,
    };
    const text = samples[language] || samples.en;

    speechGateway.speak({
      text,
      lang: language,
      gender: companion,
      tone: voiceTone,
      purpose: 'preview',
      pitch: companion === 'girl' ? 1.15 : 0.9,
      onEnergy: (energy) => setTestSpeechEnergy(energy),
      onEnd: () => {
        setIsTestSpeaking(false);
        setTestSpeechEnergy(0);
      },
      onError: () => {
        setIsTestSpeaking(false);
        setTestSpeechEnergy(0);
      },
    });
  };

  const handleSave = async () => {
    // 1. Save procedural mascot config
    const updatedMascotConfig = saveMascotConfig({
      ...config,
      name: mascotName,
    });

    // 2. Apply instantly to avatar & voice in userProfile
    if (onUpdateProfile) {
      onUpdateProfile({
        name: mascotName,
        companion,
        gender: companion,
        avatarType: companion,
        voiceGender: companion,
        voiceTone,
        voicePref: voiceTone,
        language,
        voicePitch: companion === 'girl' ? 1.15 : 0.9,
      });
    }

    // 3. Persist to DB
    try {
      const token = localStorage.getItem('manas_access_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch('/api/user/profile', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: mascotName,
          language,
          companion,
          voice_tone: voiceTone,
        }),
      });
    } catch (err) {
      console.warn('Failed to persist profile:', err);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('manas:custom_mascot_uploaded'));
    }

    onApply?.(updatedMascotConfig);
    onClose?.();
  };

  const handleResetDefault = async () => {
    await clearStoredMascotModel();
    setModelUrl(null);
    setModelType(null);
    setCompanion('girl');
    setVoiceTone('ananya');
    setMascotName('Maya');
    setLanguage('en');
    const def = saveMascotConfig({
      name: 'Maya',
      personality: 'friendly',
      isCustomModel: false,
      background: 'warm_cream',
      speakingEnabled: true,
      animationsEnabled: true,
      voiceSpeed: 0.95,
      expressionIntensity: 1.0,
    });
    setConfig(def);
  };

  const emotionsList: MascotEmotion[] = [
    'neutral',
    'happy',
    'sad',
    'concerned',
    'empathetic',
    'calm',
    'encouraging',
  ];

  const personalities: MascotPersonality[] = [
    'friendly',
    'calm',
    'encouraging',
    'playful',
    'professional',
  ];

  const backgrounds: Array<{ id: MascotBackground; label: string; color: string }> = [
    { id: 'warm_cream', label: 'Warm Cream', color: '#FDFBF7' },
    { id: 'zen_sand', label: 'Zen Sand', color: '#F7F4EC' },
    { id: 'gentle_lavender', label: 'Lavender', color: '#F5F3FF' },
    { id: 'soft_sage', label: 'Soft Sage', color: '#F0FDF4' },
    { id: 'clean_white', label: 'Clean White', color: '#FFFFFF' },
  ];

  return (
    <div className="w-full flex flex-col md:flex-row h-full max-h-[85vh] bg-[#FFFFFF] rounded-3xl overflow-hidden font-sans border border-[#0A0A0A]/10 shadow-2xl">
      {/* LEFT 45%: 3D AVATAR PREVIEW */}
      <div className="w-full md:w-[45%] h-[280px] md:h-full relative flex flex-col bg-[#FDFBF7] border-b md:border-b-0 md:border-r border-[#0A0A0A]/10">
        <div className="flex-1 w-full h-full relative">
          <MascotViewer
            emotion={previewEmotion}
            isSpeaking={isTestSpeaking}
            audioEnergy={testSpeechEnergy}
            customModelUrl={modelUrl}
            customModelType={modelType}
          />
        </div>

        {/* Floating companion badge & test voice */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20 pointer-events-none">
          <div className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md border border-[#0A0A0A]/10 text-[11px] font-mono font-bold text-[#0A0A0A] pointer-events-auto shadow-2xs">
            {companion === 'girl' ? '♀ Maya (Girl)' : '♂ Aarav (Boy)'}
          </div>

          <button
            type="button"
            onClick={handleTestVoice}
            disabled={isTestSpeaking}
            className="px-3 py-1 rounded-full bg-[#8B5CF6] text-white hover:bg-[#7C3AED] transition-colors text-xs font-mono font-medium flex items-center gap-1.5 shadow-sm pointer-events-auto cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{isTestSpeaking ? 'Speaking...' : 'Test Voice'}</span>
          </button>
        </div>

        {/* Bottom current emotion */}
        <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
          <div className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md border border-[#0A0A0A]/10 text-[11px] font-mono text-[#0A0A0A]/70 pointer-events-auto">
            Tone: <span className="font-bold capitalize text-[#8B5CF6]">{voiceTone}</span>
          </div>
        </div>
      </div>

      {/* RIGHT 55%: CONTROLS (COMPANION, VOICE, SETTINGS) */}
      <div className="w-full md:w-[55%] flex-1 flex flex-col overflow-y-auto p-6 space-y-5">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#0A0A0A]/10 pb-3">
          {(
            [
              { id: 'companion', label: 'COMPANION & VOICE' },
              { id: 'settings', label: 'SETTINGS' },
              { id: 'expressions', label: 'EXPRESSIONS' },
              { id: 'upload', label: '3D MODEL' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                activeTab === t.id
                  ? 'bg-[#0A0A0A] text-white font-bold'
                  : 'text-[#0A0A0A]/60 hover:bg-[#F3F0E6]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB 1: COMPANION & VOICE (Core Requirement) */}
        {activeTab === 'companion' && (
          <div className="space-y-4">
            {/* 1. Companion Selection (Girl / Boy) */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-[#0A0A0A] uppercase tracking-wider block">
                1. Choose Companion (Applies Instantly)
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleCompanionChange('girl')}
                  className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    companion === 'girl'
                      ? 'border-[#8B5CF6] bg-violet-50/80 ring-1 ring-[#8B5CF6]'
                      : 'border-[#0A0A0A]/10 bg-[#FDFBF7] hover:bg-[#F3F0E6]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">♀</span>
                    <div>
                      <div className="text-xs font-bold font-mono">Girl Companion</div>
                      <div className="text-[10px] text-[#0A0A0A]/60">Maya / 3D Model</div>
                    </div>
                  </div>
                  {companion === 'girl' && <Check className="w-4 h-4 text-[#8B5CF6]" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleCompanionChange('boy')}
                  className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    companion === 'boy'
                      ? 'border-[#8B5CF6] bg-violet-50/80 ring-1 ring-[#8B5CF6]'
                      : 'border-[#0A0A0A]/10 bg-[#FDFBF7] hover:bg-[#F3F0E6]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">♂</span>
                    <div>
                      <div className="text-xs font-bold font-mono">Boy Companion</div>
                      <div className="text-[10px] text-[#0A0A0A]/60">Aarav / 3D Model</div>
                    </div>
                  </div>
                  {companion === 'boy' && <Check className="w-4 h-4 text-[#8B5CF6]" />}
                </button>
              </div>
            </div>

            {/* 2. Voice Tone (Strictly filtered by Companion Gender) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-bold text-[#0A0A0A] uppercase tracking-wider">
                  2. Voice Tone ({companion === 'girl' ? 'Female' : 'Male'})
                </label>
                <button
                  type="button"
                  onClick={handleTestVoice}
                  disabled={isTestSpeaking}
                  className="text-xs font-mono text-[#8B5CF6] hover:text-[#7C3AED] flex items-center gap-1 cursor-pointer font-bold"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{isTestSpeaking ? 'Playing...' : 'Test Voice'}</span>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {availableTones.map((tone) => (
                  <button
                    key={tone.id}
                    type="button"
                    onClick={() => setVoiceTone(tone.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      voiceTone === tone.id
                        ? 'border-[#8B5CF6] bg-[#8B5CF6] text-white font-bold shadow-xs'
                        : 'border-[#0A0A0A]/10 bg-[#FDFBF7] hover:bg-[#F3F0E6] text-[#0A0A0A]'
                    }`}
                  >
                    <div className="text-xs font-mono">{tone.name}</div>
                    <div className={`text-[10px] truncate ${voiceTone === tone.id ? 'text-white/80' : 'text-[#0A0A0A]/50'}`}>
                      {tone.style}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Name & Language */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-[#0A0A0A] uppercase tracking-wider">
                  Companion Name
                </label>
                <input
                  type="text"
                  value={mascotName}
                  onChange={(e) => setMascotName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FDFBF7] border border-[#0A0A0A]/15 text-xs font-sans focus:outline-none focus:border-[#8B5CF6]"
                  placeholder="e.g. Maya or Aarav"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-[#0A0A0A] uppercase tracking-wider">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FDFBF7] border border-[#0A0A0A]/15 text-xs font-sans focus:outline-none focus:border-[#8B5CF6]"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.nativeName} ({l.englishName})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PROCEDURAL SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-mono font-bold text-[#0A0A0A] uppercase tracking-wider block mb-2">
                Personality Tone
              </label>
              <div className="grid grid-cols-3 gap-2">
                {personalities.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setConfig({ ...config, personality: p })}
                    className={`py-2 px-3 rounded-xl text-xs font-mono tracking-wide capitalize border transition-all cursor-pointer ${
                      config.personality === p
                        ? 'bg-[#8B5CF6] text-white border-[#8B5CF6] font-bold shadow-xs'
                        : 'border-[#0A0A0A]/15 bg-[#FDFBF7] text-[#0A0A0A] hover:bg-[#F3F0E6]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Speaking & Animations */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-[#FDFBF7] border border-[#0A0A0A]/10 flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono font-bold text-[#0A0A0A]">Read Aloud</div>
                  <div className="text-[10px] text-[#0A0A0A]/60">Voice output enabled</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.speakingEnabled}
                  onChange={(e) => setConfig({ ...config, speakingEnabled: e.target.checked })}
                  className="w-4 h-4 accent-[#8B5CF6] cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-2xl bg-[#FDFBF7] border border-[#0A0A0A]/10 flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono font-bold text-[#0A0A0A]">Breathing</div>
                  <div className="text-[10px] text-[#0A0A0A]/60">Sync gestures</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.animationsEnabled}
                  onChange={(e) => setConfig({ ...config, animationsEnabled: e.target.checked })}
                  className="w-4 h-4 accent-[#8B5CF6] cursor-pointer"
                />
              </div>
            </div>

            {/* Stage Space Background */}
            <div>
              <label className="text-xs font-mono font-bold text-[#0A0A0A] uppercase tracking-wider block mb-2">
                Space Background Tone
              </label>
              <div className="grid grid-cols-3 gap-2">
                {backgrounds.map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => setConfig({ ...config, background: bg.id })}
                    className={`py-2 px-3 rounded-xl text-xs font-mono border flex items-center gap-2 transition-all cursor-pointer ${
                      config.background === bg.id
                        ? 'border-[#0A0A0A] bg-white font-bold shadow-xs'
                        : 'border-[#0A0A0A]/10 bg-[#FDFBF7] hover:bg-[#F3F0E6]'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-[#0A0A0A]/20"
                      style={{ backgroundColor: bg.color }}
                    />
                    <span className="text-[11px] truncate">{bg.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: EXPRESSIONS PREVIEW */}
        {activeTab === 'expressions' && (
          <div className="space-y-4">
            <label className="text-xs font-mono font-bold text-[#0A0A0A] uppercase tracking-wider block">
              Preview Mascot Facial Expressions
            </label>
            <div className="flex flex-wrap gap-2">
              {emotionsList.map((emo) => (
                <button
                  key={emo}
                  type="button"
                  onClick={() => setPreviewEmotion(emo)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono capitalize transition-all cursor-pointer ${
                    previewEmotion === emo
                      ? 'bg-[#8B5CF6] text-white font-bold shadow-xs'
                      : 'bg-[#FDFBF7] border border-[#0A0A0A]/15 text-[#0A0A0A] hover:bg-[#F3F0E6]'
                  }`}
                >
                  {emo}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: 3D MODEL UPLOAD */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <MascotUploader
              onUploadSuccess={({ objectUrl, fileType }) => {
                setModelUrl(objectUrl);
                setModelType(fileType as any);
                setConfig({ ...config, isCustomModel: true });
              }}
            />

            {modelUrl && (
              <button
                type="button"
                onClick={handleResetDefault}
                className="w-full py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-mono transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Default Companion</span>
              </button>
            )}
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <div className="pt-4 border-t border-[#0A0A0A]/10 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-full border border-[#0A0A0A]/20 bg-[#FDFBF7] hover:bg-[#F3F0E6] text-[#0A0A0A] text-xs font-mono font-bold tracking-wider transition-colors cursor-pointer text-center"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3 px-4 rounded-full bg-[#0A0A0A] hover:bg-[#222222] text-white text-xs font-mono font-bold tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Check className="w-3.5 h-3.5" />
            Apply & Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default MascotCustomizer;
