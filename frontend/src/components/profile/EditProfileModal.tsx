import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Check, Volume2, Sparkles, Heart } from 'lucide-react';
import type { UserProfile } from '../OnboardingModal';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../i18n/languages';
import { speechGateway } from '../../lib/voice/speechGateway';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
}

const GIRL_TONES = [
  { id: 'ananya', name: 'Ananya', style: 'Warm & Empathetic' },
  { id: 'diya', name: 'Diya', style: 'Gentle & Soft' },
  { id: 'meera', name: 'Meera', style: 'Bright & Encouraging' },
];

const BOY_TONES = [
  { id: 'aarav', name: 'Aarav', style: 'Calm & Grounding' },
  { id: 'kabir', name: 'Kabir', style: 'Warm & Steady' },
  { id: 'arjun', name: 'Arjun', style: 'Soft & Friendly' },
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onUpdateProfile,
}) => {
  const [name, setName] = useState<string>(userProfile.name || 'Friend');
  const [age, setAge] = useState<number>(userProfile.age || 20);
  const [language, setLanguage] = useState<string>(userProfile.language || 'en');
  const [companion, setCompanion] = useState<'girl' | 'boy'>(
    userProfile.companion === 'boy' || userProfile.gender === 'boy' ? 'boy' : 'girl'
  );
  const [voiceTone, setVoiceTone] = useState<string>(
    userProfile.voiceTone || userProfile.voicePref || (companion === 'boy' ? 'aarav' : 'ananya')
  );
  const [isPlayingTest, setIsPlayingTest] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setName(userProfile.name || 'Friend');
      setAge(userProfile.age || 20);
      setLanguage(userProfile.language || 'en');
      const c = userProfile.companion === 'boy' || userProfile.gender === 'boy' ? 'boy' : 'girl';
      setCompanion(c);
      setVoiceTone(userProfile.voiceTone || userProfile.voicePref || (c === 'boy' ? 'aarav' : 'ananya'));
      setSaveSuccess(false);
    }
  }, [isOpen, userProfile]);

  if (!isOpen) return null;

  const currentTones = companion === 'boy' ? BOY_TONES : GIRL_TONES;

  const handleCompanionChange = (newCompanion: 'girl' | 'boy') => {
    setCompanion(newCompanion);
    const validTones = newCompanion === 'boy' ? BOY_TONES : GIRL_TONES;
    if (!validTones.some((t) => t.id === voiceTone)) {
      setVoiceTone(validTones[0].id);
    }
  };

  const handleTestVoice = () => {
    setIsPlayingTest(true);
    const samples: Record<string, string> = {
      en: `Hello ${name}! I am your ${companion === 'girl' ? 'girl' : 'boy'} companion with ${voiceTone} voice tone.`,
      hi: `नमस्ते ${name}! मैं आपका साथी हूँ, और मैं हमेशा आपके साथ हूँ।`,
      ta: `வணக்கம் ${name}! நான் எப்போதும் உங்கள் துணையாக இருப்பேன்.`,
      te: `నమస్కారం ${name}! నేను ఎల్లప్పుడూ మీ తోడుగా ఉంటాను.`,
      kn: `ನಮಸ್ಕಾರ ${name}! ನಾನು ಯಾವಾಗಲೂ ನಿಮ್ಮೊಂದಿಗೆ ಇರುತ್ತೇನೆ.`,
      ml: `നമസ്കാരം ${name}! ഞാൻ എപ്പോഴും കൂടെയുണ്ടാകും.`,
      bn: `নমস্কার ${name}! আমি সবসময় আপনার পাশে আছি।`,
      mr: `नमस्कार ${name}! मी नेहमी तुमच्या पाठीशी आहे.`,
    };

    const text = samples[language] || samples.en;

    speechGateway.speak({
      text,
      lang: language,
      gender: companion,
      tone: voiceTone,
      purpose: 'preview',
      pitch: companion === 'girl' ? 1.15 : 0.9,
      onEnd: () => setIsPlayingTest(false),
      onError: () => setIsPlayingTest(false),
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const updated: Partial<UserProfile> = {
      name: name.trim() || 'Friend',
      age: Math.max(13, Math.min(120, age)),
      language,
      companion,
      gender: companion,
      avatarType: companion,
      voiceGender: companion,
      voicePref: voiceTone,
      voiceTone,
      voicePitch: companion === 'girl' ? 1.15 : 0.9,
    };

    onUpdateProfile(updated);

    try {
      const token = localStorage.getItem('manas_access_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch('/api/user/profile', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: updated.name,
          age: updated.age,
          language: updated.language,
          companion: updated.companion,
          voice_tone: updated.voiceTone,
        }),
      });
    } catch (err) {
      console.warn('Failed to persist profile to server:', err);
    } finally {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => {
        onClose();
      }, 700);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-[#FFFFFF] rounded-3xl shadow-2xl border border-[#0A0A0A]/10 overflow-hidden font-sans text-[#0A0A0A]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#0A0A0A]/8 flex items-center justify-between bg-[#FDFBF7]">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-violet-100 text-[#8B5CF6]">
                <User className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-base font-bold text-[#0A0A0A] font-serif">Edit Profile</h3>
                <p className="text-[11px] font-mono text-[#0A0A0A]/50">Name, age, language, companion & voice</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-black/5 text-[#0A0A0A]/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* 1. Name & Age */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-mono font-bold text-[#0A0A0A]/70 uppercase tracking-wider">
                  Your Name
                </label>
                <input
                  type="text"
                  id="edit-profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#0A0A0A]/15 bg-[#FDFBF7] text-sm focus:outline-none focus:border-[#8B5CF6]"
                  placeholder="Your Name"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-[#0A0A0A]/70 uppercase tracking-wider">
                  Age
                </label>
                <input
                  type="number"
                  id="edit-profile-age"
                  min="13"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(parseInt(e.target.value, 10) || 18)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#0A0A0A]/15 bg-[#FDFBF7] text-sm focus:outline-none focus:border-[#8B5CF6]"
                  required
                />
              </div>
            </div>

            {/* 2. Language */}
            <div className="space-y-1">
              <label className="text-xs font-mono font-bold text-[#0A0A0A]/70 uppercase tracking-wider block">
                Primary Language
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {SUPPORTED_LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setLanguage(l.code)}
                    className={`py-1.5 px-2 rounded-xl border text-xs font-mono transition-all cursor-pointer text-center ${
                      language === l.code
                        ? 'border-[#8B5CF6] bg-[#8B5CF6] text-white font-bold shadow-xs'
                        : 'border-[#0A0A0A]/10 bg-[#FDFBF7] hover:bg-[#F3F0E6] text-[#0A0A0A]/80'
                    }`}
                  >
                    <div className="text-[11px] font-bold">{l.nativeName}</div>
                    <div className="text-[9px] opacity-75 truncate">{l.englishName}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Companion Gender (Girl / Boy) */}
            <div className="space-y-1">
              <label className="text-xs font-mono font-bold text-[#0A0A0A]/70 uppercase tracking-wider block">
                Companion
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  id="companion-select-girl"
                  onClick={() => handleCompanionChange('girl')}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                    companion === 'girl'
                      ? 'border-[#8B5CF6] bg-violet-50/80 ring-1 ring-[#8B5CF6]'
                      : 'border-[#0A0A0A]/10 bg-[#FDFBF7] hover:bg-[#F3F0E6]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">♀</span>
                    <div className="text-left">
                      <div className="text-xs font-bold font-mono">Girl Companion</div>
                      <div className="text-[10px] text-[#0A0A0A]/60">Maya / 3D Rig</div>
                    </div>
                  </div>
                  {companion === 'girl' && <Check className="w-4 h-4 text-[#8B5CF6]" />}
                </button>

                <button
                  type="button"
                  id="companion-select-boy"
                  onClick={() => handleCompanionChange('boy')}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                    companion === 'boy'
                      ? 'border-[#8B5CF6] bg-violet-50/80 ring-1 ring-[#8B5CF6]'
                      : 'border-[#0A0A0A]/10 bg-[#FDFBF7] hover:bg-[#F3F0E6]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">♂</span>
                    <div className="text-left">
                      <div className="text-xs font-bold font-mono">Boy Companion</div>
                      <div className="text-[10px] text-[#0A0A0A]/60">Aarav / 3D Rig</div>
                    </div>
                  </div>
                  {companion === 'boy' && <Check className="w-4 h-4 text-[#8B5CF6]" />}
                </button>
              </div>
            </div>

            {/* 4. Voice Tone (strictly filtered by companion gender) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-bold text-[#0A0A0A]/70 uppercase tracking-wider">
                  Voice Timbre ({companion === 'girl' ? 'Female' : 'Male'})
                </label>
                <button
                  type="button"
                  onClick={handleTestVoice}
                  disabled={isPlayingTest}
                  className="text-xs font-mono text-[#8B5CF6] hover:text-[#7C3AED] flex items-center gap-1 cursor-pointer font-bold"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{isPlayingTest ? 'Speaking...' : 'Test Voice'}</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {currentTones.map((tone) => (
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

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="submit"
                id="edit-profile-save-button"
                disabled={isSaving}
                className={`w-full py-3 rounded-2xl font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  saveSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#0A0A0A] hover:bg-neutral-800 text-white shadow-md'
                }`}
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Profile Saved!</span>
                  </>
                ) : isSaving ? (
                  <span>Saving...</span>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default EditProfileModal;
