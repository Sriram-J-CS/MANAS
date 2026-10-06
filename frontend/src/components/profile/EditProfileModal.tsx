import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Check, Volume2, Sparkles, ShieldCheck, Phone, AlertCircle, Lock } from 'lucide-react';
import type { UserProfile } from '../OnboardingModal';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../i18n/languages';
import { speechGateway } from '../../lib/voice/speechGateway';
import {
  supabase,
  linkPhoneToUser,
  verifyPhoneLinkOtp,
  normalizePhone,
  isSmsTestMode,
} from '../../lib/supabase';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
}

const GIRL_TONES = [
  { id: 'ananya', name: 'Ananya', style: 'Warm & Empathetic' },
  { id: 'diya',   name: 'Diya',   style: 'Gentle & Soft' },
  { id: 'meera',  name: 'Meera',  style: 'Bright & Encouraging' },
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
  const [companionName, setCompanionName] = useState<string>(
    userProfile.companionName || (userProfile.companion === 'boy' ? 'Aarav' : 'Maya')
  );
  const [age, setAge] = useState<number>(userProfile.age || 20);
  const [language, setLanguage] = useState<string>(userProfile.language || 'en');
  const [companion, setCompanion] = useState<'girl' | 'boy'>(
    userProfile.companion === 'boy' || userProfile.gender === 'boy' ? 'boy' : 'girl'
  );
  const [voiceGender, setVoiceGender] = useState<'girl' | 'boy'>(
    userProfile.voiceGender || (userProfile.companion === 'boy' ? 'boy' : 'girl')
  );
  const [voiceTone, setVoiceTone] = useState<string>(
    userProfile.voiceTone || userProfile.voicePref || (voiceGender === 'boy' ? 'aarav' : 'ananya')
  );
  const [isPlayingTest, setIsPlayingTest] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Secure anonymous account state
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [securePhone, setSecurePhone] = useState<string>('+91 ');
  const [secureOtp, setSecureOtp] = useState<string>('');
  const [secureOtpSent, setSecureOtpSent] = useState<boolean>(false);
  const [secureError, setSecureError] = useState<string | null>(null);
  const [secureSuccess, setSecureSuccess] = useState<boolean>(false);
  const [isSecuring, setIsSecuring] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setName(userProfile.name || 'Friend');
      setCompanionName(userProfile.companionName || (userProfile.companion === 'boy' ? 'Aarav' : 'Maya'));
      setAge(userProfile.age || 20);
      setLanguage(userProfile.language || 'en');
      const c = userProfile.companion === 'boy' || userProfile.gender === 'boy' ? 'boy' : 'girl';
      setCompanion(c);
      const vg = userProfile.voiceGender || c;
      setVoiceGender(vg);
      setVoiceTone(userProfile.voiceTone || userProfile.voicePref || (vg === 'boy' ? 'aarav' : 'ananya'));
      setSaveSuccess(false);

      // Check if user is anonymous
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.is_anonymous) {
          setIsAnonymous(true);
        } else {
          setIsAnonymous(false);
        }
      });
    }
  }, [isOpen, userProfile]);

  if (!isOpen) return null;

  const currentTones = voiceGender === 'boy' ? BOY_TONES : GIRL_TONES;

  const handleCompanionChange = (newCompanion: 'girl' | 'boy') => {
    // Only updates avatar model; does NOT change voiceGender manually set
    setCompanion(newCompanion);
  };

  const handleVoiceGenderChange = (newVoiceGender: 'girl' | 'boy') => {
    setVoiceGender(newVoiceGender);
    const validTones = newVoiceGender === 'boy' ? BOY_TONES : GIRL_TONES;
    if (!validTones.some((t) => t.id === voiceTone)) {
      setVoiceTone(validTones[0].id);
    }
  };

  const handleSendSecureOtp = async () => {
    const cleanDigits = securePhone.replace(/\D/g, '');
    if (cleanDigits.length < 10) {
      setSecureError('Please enter a valid 10-digit mobile number');
      return;
    }
    setSecureError(null);
    setIsSecuring(true);
    try {
      const formatted = normalizePhone(securePhone);
      const res = await linkPhoneToUser(formatted);
      if (!res.success) throw new Error(res.error || 'Failed to send verification code');
      setSecureOtpSent(true);
    } catch (err: any) {
      setSecureError(err.message || 'Error dispatching SMS code');
    } finally {
      setIsSecuring(false);
    }
  };

  const handleVerifySecureOtp = async () => {
    if (!secureOtp.trim() || secureOtp.trim().length !== 6) {
      setSecureError('Please enter 6-digit verification code');
      return;
    }
    setSecureError(null);
    setIsSecuring(true);
    try {
      const formatted = normalizePhone(securePhone);
      const res = await verifyPhoneLinkOtp(formatted, secureOtp.trim());
      if (!res.success) throw new Error(res.error || 'Verification code invalid');
      setSecureSuccess(true);
      setIsAnonymous(false);
    } catch (err: any) {
      setSecureError(err.message || 'Verification failed');
    } finally {
      setIsSecuring(false);
    }
  };

  const handleTestVoice = () => {
    setIsPlayingTest(true);
    const samples: Record<string, string> = {
      en: `Hello ${name}! I am ${companionName}, your companion with ${voiceTone} voice tone.`,
      hi: `नमस्ते ${name}! मैं ${companionName} हूँ, और मैं हमेशा आपके साथ हूँ।`,
      ta: `வணக்கம் ${name}! நான் ${companionName}, எப்போதும் உங்கள் துணையாக இருப்பேன்.`,
      te: `నమస్కారం ${name}! నేను ${companionName}, ఎల్లప్పుడూ మీ తోడుగా ఉంటాను.`,
      kn: `ನಮಸ್ಕಾರ ${name}! ನಾನು ${companionName}, ಯಾವಾಗಲೂ ನಿಮ್ಮೊಂದಿಗೆ ಇರುತ್ತೇನೆ.`,
      ml: `നമസ്കാരം ${name}! ഞാൻ ${companionName}, എപ്പോഴും കൂടെയുണ്ടാകും.`,
      bn: `নমস্কার ${name}! আমি ${companionName}, সবসময় আপনার পাশে আছি।`,
      mr: `नमस्कार ${name}! मी ${companionName}, नेहमी तुमच्या पाठीशी आहे.`,
    };

    const text = samples[language] || samples.en;

    speechGateway.speak({
      text,
      lang: language,
      gender: voiceGender,
      companion,
      tone: voiceTone,
      purpose: 'preview',
      pitch: voiceGender === 'girl' ? 1.15 : 0.9,
      onEnd: () => setIsPlayingTest(false),
      onError: () => setIsPlayingTest(false),
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const updated: Partial<UserProfile> = {
      name: name.trim() || 'Friend',
      companionName: companionName.trim() || (companion === 'boy' ? 'Aarav' : 'Maya'),
      age: Math.max(13, Math.min(120, age)),
      language,
      companion,
      gender: companion,
      avatarType: companion,
      voiceGender,
      voicePref: voiceTone,
      voiceTone,
      voicePitch: voiceGender === 'girl' ? 1.15 : 0.9,
    };

    onUpdateProfile(updated);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase.from('profiles').upsert({
          user_id: session.user.id,
          name: updated.name,
          age: updated.age,
          language: updated.language,
          companion: updated.companion,
          voice_gender: updated.voiceGender,
          voice_tone: updated.voiceTone,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      }

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
          voice_gender: updated.voiceGender,
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
                <p className="text-[11px] font-mono text-[#0A0A0A]/50">Companion, voice, name, age & language</p>
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
            {/* Secure Account Notice (Only for anonymous sessions) */}
            {isAnonymous && !secureSuccess && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 shadow-xs flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-xs font-mono uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    Secure My Account
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-200/60 text-amber-900 font-semibold">
                    Anonymous Session
                  </span>
                </div>
                <p className="text-xs text-amber-900/80 leading-relaxed font-sans">
                  You are using an anonymous profile. Link a mobile number to back up your chat history and prevent data loss.
                </p>

                {!secureOtpSent ? (
                  <div className="flex gap-2 pt-1">
                    <input
                      type="tel"
                      value={securePhone}
                      onChange={(e) => setSecurePhone(e.target.value)}
                      placeholder="+91 9876543210"
                      className="flex-1 px-3 py-2 rounded-xl bg-white border border-amber-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      disabled={isSecuring}
                      onClick={handleSendSecureOtp}
                      className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-mono font-bold uppercase hover:bg-amber-700 transition-colors disabled:opacity-50"
                    >
                      {isSecuring ? 'Sending...' : 'Send OTP'}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      maxLength={6}
                      value={secureOtp}
                      onChange={(e) => setSecureOtp(e.target.value)}
                      placeholder="6-digit code"
                      className="flex-1 px-3 py-2 rounded-xl bg-white border border-amber-300 text-xs font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      disabled={isSecuring}
                      onClick={handleVerifySecureOtp}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-mono font-bold uppercase hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {isSecuring ? 'Verifying...' : 'Verify & Link'}
                    </button>
                  </div>
                )}
                {secureError && (
                  <span className="text-xs text-rose-600 font-medium">{secureError}</span>
                )}
              </div>
            )}

            {secureSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                Account successfully secured with verified mobile number!
              </div>
            )}

            {/* 1. Name & Companion Name & Age */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
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
                  Companion Name
                </label>
                <input
                  type="text"
                  id="edit-profile-companion-name"
                  value={companionName}
                  onChange={(e) => setCompanionName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#0A0A0A]/15 bg-[#FDFBF7] text-sm focus:outline-none focus:border-[#8B5CF6]"
                  placeholder={companion === 'boy' ? 'Aarav' : 'Maya'}
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

            {/* 3. Companion Avatar Toggle (Girl / Boy) */}
            <div className="space-y-1">
              <label className="text-xs font-mono font-bold text-[#0A0A0A]/70 uppercase tracking-wider block">
                3D Visual Companion Avatar
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
                      <div className="text-xs font-bold font-mono">Girl Avatar</div>
                      <div className="text-[10px] text-[#0A0A0A]/60">Maya / 3D Model</div>
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
                      <div className="text-xs font-bold font-mono">Boy Avatar</div>
                      <div className="text-[10px] text-[#0A0A0A]/60">Aarav / 3D Model</div>
                    </div>
                  </div>
                  {companion === 'boy' && <Check className="w-4 h-4 text-[#8B5CF6]" />}
                </button>
              </div>
            </div>

            {/* 4. Voice Gender Toggle (Separate from Avatar) */}
            <div className="space-y-1">
              <label className="text-xs font-mono font-bold text-[#0A0A0A]/70 uppercase tracking-wider block">
                Companion Voice Gender (Separate Setting)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleVoiceGenderChange('girl')}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                    voiceGender === 'girl'
                      ? 'border-[#8B5CF6] bg-violet-50/80 ring-1 ring-[#8B5CF6]'
                      : 'border-[#0A0A0A]/10 bg-[#FDFBF7] hover:bg-[#F3F0E6]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-[#8B5CF6]" />
                    <div className="text-left">
                      <div className="text-xs font-bold font-mono">Female Speaker</div>
                      <div className="text-[10px] text-[#0A0A0A]/60">Warm & Empathetic</div>
                    </div>
                  </div>
                  {voiceGender === 'girl' && <Check className="w-4 h-4 text-[#8B5CF6]" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleVoiceGenderChange('boy')}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                    voiceGender === 'boy'
                      ? 'border-[#8B5CF6] bg-violet-50/80 ring-1 ring-[#8B5CF6]'
                      : 'border-[#0A0A0A]/10 bg-[#FDFBF7] hover:bg-[#F3F0E6]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-[#8B5CF6]" />
                    <div className="text-left">
                      <div className="text-xs font-bold font-mono">Male Speaker</div>
                      <div className="text-[10px] text-[#0A0A0A]/60">Calm & Grounding</div>
                    </div>
                  </div>
                  {voiceGender === 'boy' && <Check className="w-4 h-4 text-[#8B5CF6]" />}
                </button>
              </div>
            </div>

            {/* 5. Voice Tone (filtered strictly by voiceGender) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-bold text-[#0A0A0A]/70 uppercase tracking-wider">
                  Voice Tone ({voiceGender === 'girl' ? 'Female' : 'Male'})
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
