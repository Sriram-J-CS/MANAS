import React, { useState, useEffect } from 'react';
import { X, Sparkles, Monitor, MoveHorizontal, Shirt, Check, Volume2, Play, Shield, Trash2, Download, AlertTriangle } from 'lucide-react';
import type { UserProfile } from './OnboardingModal';
import { RealMascot } from './RealMascot';
import type { OutfitType } from './ThreeMascot/ThreeCartoonMascot';
import { speechEngine } from '../lib/voice/speechEngine';

interface ChatSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onDeleteData?: () => void;
}

const SAMPLE_PHRASES: Record<string, string> = {
  ta: 'வணக்கம், நான் எப்போதும் உங்களுடன் துணை நிற்பேன்.',
  hi: 'नमस्ते, मैं हमेशा आपकी बात सुनने और साथ देने के लिए यहाँ हूँ।',
  te: 'నమస్కారం, నేను ఎల్లప్పుడూ మీకు తోడుగా ఉంటాను.',
  kn: 'ನಮಸ್ಕಾರ, ನಾನು ಯಾವಾಗಲೂ ನಿಮ್ಮೊಂದಿಗೆ ಇರುತ್ತೇನೆ.',
  ml: 'നമസ്കാരം, ഞാൻ എപ്പോഴും നിങ്ങളുടെ കൂടെയുണ്ടാകും.',
  bn: 'নমস্কার, আমি সর্বদা আপনার পাশে আছি।',
  mr: 'नमस्कार, मी नेहमी तुमच्या पाठीशी आहे.',
  en: 'Hello, I am right here beside you whenever you need to talk.',
};

const OUTFITS_LIST: Array<{ id: OutfitType; label: string; color: string; desc: string }> = [
  { id: 'hoodie', label: 'Cozy Hoodie', color: '#3b82f6', desc: 'Fleece comfort' },
  { id: 'formal', label: 'Smart Blazer', color: '#475569', desc: 'Professional focus' },
  { id: 'kurta_saree', label: 'Kurta / Saree', color: '#d97706', desc: 'Traditional grace' },
  { id: 'sports', label: 'Tracksuit', color: '#10b981', desc: 'Active energy' },
  { id: 'pyjamas', label: 'Pyjamas', color: '#8b5cf6', desc: 'Sleep & rest' },
  { id: 'festive', label: 'Festive', color: '#e11d48', desc: 'Celebration' },
];

export const ChatSettingsModal: React.FC<ChatSettingsModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onUpdateProfile,
  isFullscreen,
  onToggleFullscreen,
  onDeleteData,
}) => {
  const [isPlayingVoiceTest, setIsPlayingVoiceTest] = useState(false);
  const [autoSaveChat, setAutoSaveChat] = useState<boolean>(true);
  const [manualOnlyMode, setManualOnlyMode] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deleteConfirmPhrase, setDeleteConfirmPhrase] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem('manas_access_token');
        const res = await fetch('/api/settings/app', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setAutoSaveChat(data.auto_save_chat ?? true);
          setManualOnlyMode(data.manual_only_mode ?? false);
        }
      } catch (_) {}
    };
    fetchSettings();
  }, [isOpen]);

  const handleToggleAutoSave = async (val: boolean) => {
    setAutoSaveChat(val);
    try {
      const token = localStorage.getItem('manas_access_token');
      await fetch('/api/settings/app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ auto_save_chat: val }),
      });
    } catch (_) {}
  };

  const handleToggleManualOnly = async (val: boolean) => {
    setManualOnlyMode(val);
    if (val) setAutoSaveChat(false);
    try {
      const token = localStorage.getItem('manas_access_token');
      await fetch('/api/settings/app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ manual_only_mode: val, ...(val ? { auto_save_chat: false } : {}) }),
      });
    } catch (_) {}
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem('manas_access_token');
      const res = await fetch('/api/privacy/export', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `manas_encrypted_export_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setStatusMsg('Export downloaded successfully.');
        setTimeout(() => setStatusMsg(''), 3000);
      }
    } catch (_) {
      setStatusMsg('Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteEverything = async () => {
    if (deleteConfirmPhrase.trim() !== 'DELETE EVERYTHING') {
      return;
    }
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('manas_access_token');
      const res = await fetch('/api/settings/delete-everything', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ confirm_phrase: 'DELETE EVERYTHING' }),
      });
      if (res.ok) {
        setShowDeleteConfirm(false);
        if (onDeleteData) {
          onDeleteData();
        } else {
          localStorage.clear();
          window.location.reload();
        }
      }
    } catch (_) {
      setStatusMsg('Purge failed.');
    } finally {
      setIsDeleting(false);
    }
  };

  const speakSample = (gender: 'boy' | 'girl', pitch: number) => {
    setIsPlayingVoiceTest(true);
    const lang = userProfile.language || 'en';
    const sample = SAMPLE_PHRASES[lang] || SAMPLE_PHRASES.en;
    speechEngine.speak(sample, lang, {
      gender,
      pitch,
      onEnd: () => setIsPlayingVoiceTest(false),
      onError: () => setIsPlayingVoiceTest(false),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="bg-[#0b0e14] text-white border border-white/20 max-w-lg w-full rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base uppercase tracking-tight text-white">
                Companion & Mascot Settings
              </h3>
              <p className="text-[11px] font-mono text-white/50">
                Personalize your AI Digital Twin experience
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm font-sans">
          {/* Section 0: 3D Mascot Character */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-white/80 mb-2">
              1. 3D Cartoon Mascot Base
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onUpdateProfile({ avatarType: 'boy' })}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  userProfile.avatarType === 'boy'
                    ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400'
                    : 'border-white/15 bg-white/5 hover:border-white/40'
                }`}
              >
                <div className="text-xl mb-1">👦</div>
                <span className="font-bold text-xs uppercase text-white block">Boy Mascot</span>
                <span className="text-[10px] text-cyan-300 font-mono">Full 3D Rig</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateProfile({ avatarType: 'girl' })}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  userProfile.avatarType === 'girl'
                    ? 'border-pink-400 bg-pink-950/40 ring-1 ring-pink-400'
                    : 'border-white/15 bg-white/5 hover:border-white/40'
                }`}
              >
                <div className="text-xl mb-1">👧</div>
                <span className="font-bold text-xs uppercase text-white block">Girl Mascot</span>
                <span className="text-[10px] text-pink-300 font-mono">Full 3D Rig</span>
              </button>
            </div>
          </div>

          {/* Section: Voice & Gender Tone Persona */}
          <div className="pt-2 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-white/80 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>2. Voice & Gender Tone</span>
              </label>
              <span className="text-[10px] font-mono text-cyan-300">
                {(userProfile.voiceGender || (userProfile.avatarType === 'girl' ? 'girl' : 'boy')) === 'girl'
                  ? '👧 Girl Voice'
                  : '👦 Boy Voice'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  onUpdateProfile({ voiceGender: 'boy', voicePitch: 0.88 });
                  speakSample('boy', 0.88);
                }}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  (userProfile.voiceGender || (userProfile.avatarType === 'girl' ? 'girl' : 'boy')) === 'boy'
                    ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400'
                    : 'border-white/15 bg-white/5 hover:border-white/40'
                }`}
              >
                <div className="text-xl mb-1">👦</div>
                <span className="font-bold text-xs uppercase text-white block">Boy Voice</span>
                <span className="text-[10px] text-cyan-300 font-mono">Deeper, Grounded</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onUpdateProfile({ voiceGender: 'girl', voicePitch: 1.18 });
                  speakSample('girl', 1.18);
                }}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  (userProfile.voiceGender || (userProfile.avatarType === 'girl' ? 'girl' : 'boy')) === 'girl'
                    ? 'border-pink-400 bg-pink-950/40 ring-1 ring-pink-400'
                    : 'border-white/15 bg-white/5 hover:border-white/40'
                }`}
              >
                <div className="text-xl mb-1">👧</div>
                <span className="font-bold text-xs uppercase text-white block">Girl Voice</span>
                <span className="text-[10px] text-pink-300 font-mono">Gentle, Soft Tone</span>
              </button>
            </div>

            {/* Test Voice in Active Language Button */}
            <button
              type="button"
              disabled={isPlayingVoiceTest}
              onClick={() => {
                const currentGender =
                  userProfile.voiceGender || (userProfile.avatarType === 'girl' ? 'girl' : 'boy');
                const currentPitch = userProfile.voicePitch || (currentGender === 'girl' ? 1.18 : 0.88);
                speakSample(currentGender, currentPitch);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-mono text-cyan-300 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {isPlayingVoiceTest
                  ? 'Speaking sample...'
                  : `Test Voice in ${userProfile.language ? userProfile.language.toUpperCase() : 'Active Language'}`}
              </span>
            </button>
          </div>

          {/* Section 0.5: Wardrobe Outfits */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-mono uppercase tracking-wider text-white/80 flex items-center gap-1.5">
                <Shirt className="w-3.5 h-3.5 text-cyan-400" />
                <span>3. Wardrobe Outfit (6 Styles)</span>
              </label>
              <span className="text-[10px] font-mono text-cyan-300">
                Active: {userProfile.outfit || 'hoodie'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {OUTFITS_LIST.map((item) => {
                const isSelected = (userProfile.outfit || 'hoodie') === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onUpdateProfile({ outfit: item.id });
                      fetch('/api/avatar/wardrobe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          avatar_type: userProfile.avatarType || 'boy',
                          outfit: item.id,
                        }),
                      }).catch(() => {});
                    }}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-cyan-400 bg-white/15 ring-1 ring-cyan-400'
                        : 'border-white/10 bg-white/5 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {isSelected && <Check className="w-3 h-3 text-cyan-400 stroke-[3]" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{item.label}</p>
                      <p className="text-[9px] font-mono text-white/50">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 1: Mascot Companion Selection */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-white/80 mb-3">
              3. Or Choose Stylized Spirit Preset
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. Cyber MANAS */}
              <button
                type="button"
                onClick={() =>
                  onUpdateProfile({
                    avatarType: 'cyber_manas',
                    avatarUrl: 'cyber_manas',
                    isCustomAvatar: false,
                  })
                }
                className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  userProfile.avatarType === 'cyber_manas' || userProfile.avatarType === 'mascot'
                    ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400'
                    : 'border-white/15 bg-white/5 hover:border-white/40'
                }`}
              >
                <div className="w-14 h-16 flex items-center justify-center pointer-events-none shrink-0">
                  <RealMascot size="sm" avatarType="cyber_manas" expression="happy" interactive={false} />
                </div>
                <div>
                  <span className="font-bold text-xs uppercase block text-white">
                    Cyber MANAS
                  </span>
                  <span className="text-[10px] text-cyan-300 font-mono">
                    Intuitive AI Mascot
                  </span>
                </div>
              </button>

              {/* 2. Zen Sage */}
              <button
                type="button"
                onClick={() =>
                  onUpdateProfile({
                    avatarType: 'zen_sage',
                    avatarUrl: 'zen_sage',
                    isCustomAvatar: false,
                  })
                }
                className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                  userProfile.avatarType === 'zen_sage' || userProfile.avatarType === 'girl'
                    ? 'border-emerald-400 bg-emerald-950/40 ring-1 ring-emerald-400'
                    : 'border-white/15 bg-white/5 hover:border-white/40'
                }`}
              >
                <div className="w-14 h-16 flex items-center justify-center pointer-events-none shrink-0">
                  <RealMascot size="sm" avatarType="zen_sage" expression="happy" interactive={false} />
                </div>
                <div>
                  <span className="font-bold text-xs uppercase block text-white">
                    Zen Sage
                  </span>
                  <span className="text-[10px] text-emerald-300 font-mono">
                    Tranquil Mindful Guide
                  </span>
                </div>
              </button>

              {/* 3. Aura Cloud */}
              <button
                type="button"
                onClick={() =>
                  onUpdateProfile({
                    avatarType: 'aura_cloud',
                    avatarUrl: 'aura_cloud',
                    isCustomAvatar: false,
                  })
                }
                className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                  userProfile.avatarType === 'aura_cloud'
                    ? 'border-purple-400 bg-purple-950/40 ring-1 ring-purple-400'
                    : 'border-white/15 bg-white/5 hover:border-white/40'
                }`}
              >
                <div className="w-14 h-16 flex items-center justify-center pointer-events-none shrink-0">
                  <RealMascot size="sm" avatarType="aura_cloud" expression="concerned" interactive={false} />
                </div>
                <div>
                  <span className="font-bold text-xs uppercase block text-white">
                    Aura Cloud
                  </span>
                  <span className="text-[10px] text-purple-300 font-mono">
                    Gentle Empathy
                  </span>
                </div>
              </button>

              {/* 4. Solar Nova */}
              <button
                type="button"
                onClick={() =>
                  onUpdateProfile({
                    avatarType: 'solar_nova',
                    avatarUrl: 'solar_nova',
                    isCustomAvatar: false,
                  })
                }
                className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                  userProfile.avatarType === 'solar_nova'
                    ? 'border-amber-400 bg-amber-950/40 ring-1 ring-amber-400'
                    : 'border-white/15 bg-white/5 hover:border-white/40'
                }`}
              >
                <div className="w-14 h-16 flex items-center justify-center pointer-events-none shrink-0">
                  <RealMascot size="sm" avatarType="solar_nova" expression="happy" interactive={false} />
                </div>
                <div>
                  <span className="font-bold text-xs uppercase block text-white">
                    Solar Nova
                  </span>
                  <span className="text-[10px] text-amber-300 font-mono">
                    Radiant Optimism
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Section 2: Movable Website Mascot Feature */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-xs uppercase tracking-wider text-white block">
                  Movable Website Mascot
                </span>
                <span className="text-[11px] text-white/50 font-mono block">
                  Interactive floating assistant that moves around the site
                </span>
              </div>
              <button
                onClick={() =>
                  onUpdateProfile({
                    mascotEnabled: !(userProfile.mascotEnabled ?? true),
                  })
                }
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  (userProfile.mascotEnabled ?? true) ? 'bg-cyan-500' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    (userProfile.mascotEnabled ?? true) ? 'translate-x-6.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Mascot Dock Position: Left or Right */}
            {(userProfile.mascotEnabled ?? true) && (
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="text-xs font-mono text-white/80 flex items-center gap-2">
                  <MoveHorizontal className="w-4 h-4 text-cyan-400" />
                  Mascot Screen Position
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onUpdateProfile({ mascotPosition: 'left' })}
                    className={`px-3 py-1 rounded-xl text-xs font-mono transition-all ${
                      userProfile.mascotPosition === 'left'
                        ? 'bg-white text-black font-bold'
                        : 'border border-white/20 text-white/70 hover:border-white'
                    }`}
                  >
                    Left Side
                  </button>
                  <button
                    onClick={() => onUpdateProfile({ mascotPosition: 'right' })}
                    className={`px-3 py-1 rounded-xl text-xs font-mono transition-all ${
                      (userProfile.mascotPosition ?? 'right') === 'right'
                        ? 'bg-white text-black font-bold'
                        : 'border border-white/20 text-white/70 hover:border-white'
                    }`}
                  >
                    Right Side
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Whole Big Screen Mode */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between">
            <div>
              <span className="font-bold text-xs uppercase tracking-wider text-white block">
                Whole Big Screen Chat
              </span>
              <span className="text-[11px] text-white/50 font-mono block">
                Expand chat interface to occupy entire screen viewport
              </span>
            </div>
            <button
              onClick={onToggleFullscreen}
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                isFullscreen
                  ? 'bg-cyan-500 text-black border-cyan-400 font-bold'
                  : 'border-white/20 text-white hover:border-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>{isFullscreen ? 'Big Screen Active' : 'Enable Big Screen'}</span>
            </button>
          </div>

          {/* Section 4: Auto-Save & Manual-Only Mode */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <label className="block text-xs font-mono uppercase tracking-wider text-white/80">
              4. Automatic Chat Extraction
            </label>

            {/* Auto-save from chat toggle */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-white block">
                  Auto-Save From Chat
                </span>
                <span className="text-[11px] text-white/50 font-sans block leading-relaxed mt-0.5">
                  Background extraction detects mood, stress, memories, and wellness tools from conversation (default on).
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleAutoSave(!autoSaveChat)}
                disabled={manualOnlyMode}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ml-3 ${
                  autoSaveChat && !manualOnlyMode ? 'bg-cyan-500' : 'bg-slate-700'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoSaveChat && !manualOnlyMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Manual only mode toggle */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-white block">
                  Manual Only Mode
                </span>
                <span className="text-[11px] text-white/50 font-sans block leading-relaxed mt-0.5">
                  Disables all chat-driven saves. You maintain 100% control by logging data solely via manual forms.
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleManualOnly(!manualOnlyMode)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ml-3 ${
                  manualOnlyMode ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    manualOnlyMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Section 5: Data & Privacy Controls */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <label className="block text-xs font-mono uppercase tracking-wider text-white/80">
              5. Data Privacy & Portability (DPDP Act)
            </label>

            {statusMsg && (
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
                {statusMsg}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleExportData}
                disabled={isExporting}
                className="flex-1 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-mono flex items-center justify-center gap-2 text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isExporting ? 'Exporting...' : 'Export My Data (JSON)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex-1 p-3 rounded-2xl bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/30 text-xs font-mono flex items-center justify-center gap-2 text-rose-300 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Delete Everything</span>
              </button>
            </div>

            {/* Delete Confirmation Box */}
            {showDeleteConfirm && (
              <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 space-y-3 mt-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-rose-300 text-xs font-bold font-mono uppercase">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Irreversible Data Erasure
                </div>
                <p className="text-xs text-rose-200/80 leading-relaxed font-sans">
                  This will permanently delete all encrypted chat messages, memories, wellness logs, goals, journal entries, and presence. Type <span className="font-mono font-bold text-white bg-rose-900/60 px-1 rounded">DELETE EVERYTHING</span> to confirm:
                </p>
                <input
                  type="text"
                  value={deleteConfirmPhrase}
                  onChange={(e) => setDeleteConfirmPhrase(e.target.value)}
                  placeholder="DELETE EVERYTHING"
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-rose-500/30 text-white font-mono text-xs focus:outline-none focus:border-rose-400"
                />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmPhrase('');
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-mono text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteEverything}
                    disabled={deleteConfirmPhrase.trim() !== 'DELETE EVERYTHING' || isDeleting}
                    className="px-4 py-1.5 rounded-xl text-xs font-mono font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? 'Deleting...' : 'Confirm Purge'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-black border-t border-white/10 flex items-center justify-between">
          <span className="text-[11px] font-mono text-white/40">
            Changes auto-saved
          </span>
          <button
            onClick={onClose}
            className="pill-btn pill-btn-white py-2 px-6 text-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
