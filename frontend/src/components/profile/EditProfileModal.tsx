import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Check, Volume2, ShieldCheck } from 'lucide-react';
import type { UserProfile } from '../OnboardingModal';
import { SUPPORTED_LANGUAGES } from '../../i18n/languages';
import { speechGateway } from '../../lib/voice/speechGateway';
import {
  supabase,
  linkPhoneToUser,
  verifyPhoneLinkOtp,
  normalizePhone,
} from '../../lib/supabase';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
}

const GIRL_VOICES = [
  { id: 'ananya', name: 'Ananya', style: 'Warm & Empathetic' },
  { id: 'diya',   name: 'Diya',   style: 'Gentle & Soft' },
  { id: 'janani', name: 'Janani', style: 'Bright & Encouraging' },
];

const BOY_VOICES = [
  { id: 'aarav', name: 'Aarav', style: 'Calm & Grounding' },
  { id: 'kabir', name: 'Kabir', style: 'Warm & Steady' },
  { id: 'arjun', name: 'Arjun', style: 'Soft & Friendly' },
];

const SPEAKING_TONES = [
  { id: 'warm_caring', label: 'Warm & Caring', pace: 1.0, desc: 'Deep warmth & comforting empathy' },
  { id: 'calm_grounding', label: 'Calm & Grounding', pace: 0.92, desc: 'Steady, centered & reassuring' },
  { id: 'gentle_soft', label: 'Gentle & Soft', pace: 0.92, desc: 'Tender softness, delicate & soothing' },
  { id: 'friendly_casual', label: 'Friendly & Casual', pace: 1.0, desc: 'Easygoing, relatable peer buddy' },
  { id: 'encouraging_motivating', label: 'Encouraging & Motivating', pace: 1.05, desc: 'Uplifting hope & inspiring energy' },
  { id: 'direct_practical', label: 'Direct & Practical', pace: 1.0, desc: 'Clear, honest & action-focused' },
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
  const [voiceFollowsCompanion, setVoiceFollowsCompanion] = useState<boolean>(
    userProfile.voiceFollowsCompanion ?? true
  );
  const [voiceGender, setVoiceGender] = useState<'girl' | 'boy'>(
    userProfile.voiceGender || (userProfile.companion === 'boy' ? 'boy' : 'girl')
  );
  const [voiceTone, setVoiceTone] = useState<string>(
    userProfile.voiceTone || userProfile.voicePref || (voiceGender === 'boy' ? 'aarav' : 'ananya')
  );
  const [speakingStyle, setSpeakingStyle] = useState<string>(
    userProfile.speakingStyle || 'Warm & Caring'
  );
  const [voiceSpeed, setVoiceSpeed] = useState<number>(
    userProfile.voiceSpeed || 1.0
  );
  const [replyLength, setReplyLength] = useState<'Short' | 'Balanced' | 'Detailed'>(
    (userProfile.replyLength as any) || 'Balanced'
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
      const vfc = userProfile.voiceFollowsCompanion ?? true;
      setVoiceFollowsCompanion(vfc);
      const vg = vfc ? c : (userProfile.voiceGender || c);
      setVoiceGender(vg);
      setVoiceTone(userProfile.voiceTone || userProfile.voicePref || (vg === 'boy' ? 'aarav' : 'ananya'));
      setSpeakingStyle(userProfile.speakingStyle || 'Warm & Caring');
      setVoiceSpeed(userProfile.voiceSpeed || 1.0);
      setReplyLength((userProfile.replyLength as any) || 'Balanced');
      setSaveSuccess(false);

      supabase.auth.getUser().then(({ data: { user } }) => {
        setIsAnonymous(!!user?.is_anonymous);
      });
    }
  }, [isOpen, userProfile]);

  if (!isOpen) return null;

  const currentVoices = voiceGender === 'boy' ? BOY_VOICES : GIRL_VOICES;

  const playPreviewLine = (
    vg: 'girl' | 'boy',
    vTone: string,
    vStyle: string,
    vSpeed: number
  ) => {
    speechGateway.stopSpeaking();
    setIsPlayingTest(true);
    const SAMPLES: Record<string, string> = {
      en: `Hello ${name}! I am ${companionName}, speaking in a ${vStyle} tone.`,
      hi: `नमस्ते ${name}! मैं ${companionName} हूँ, हमेशा आपके साथ।`,
      ta: `வணக்கம் ${name}! நான் ${companionName}, எப்போதும் உங்க கூடவே இருப்பேன்.`,
      te: `నమస్కారం ${name}! నేను ${companionName}, ఎల్లప్పుడూ మీ తోడుగా ఉంటాను.`,
      kn: `ನಮಸ್ಕಾರ ${name}! ನಾನು ${companionName}, ಯಾವಾಗಲೂ ನಿಮ್ಮೊಂದಿಗೆ ಇರುತ್ತೇನೆ.`,
      ml: `നമസ്കാരം ${name}! ഞാൻ ${companionName}, എപ്പോഴും നിങ്ങളുടെ കൂടെയുണ്ട്.`,
      bn: `নমস্কার ${name}! আমি ${companionName}, সবসময় আপনার পাশে আছি।`,
      mr: `नमस्कार ${name}! मी ${companionName}, नेहमी तुमच्या सोबत आहे.`,
    };

    const text = SAMPLES[language] || SAMPLES.en;

    speechGateway.speak({
      text,
      lang: language,
      gender: vg,
      companion,
      tone: vTone,
      speaking_style: vStyle,
      speed: vSpeed,
      purpose: 'preview',
      pitch: vg === 'girl' ? 1.15 : 0.9,
      onEnd: () => setIsPlayingTest(false),
      onError: () => setIsPlayingTest(false),
    });
  };

  const persistToStorageAndDb = (patch: Partial<UserProfile>) => {
    onUpdateProfile(patch);
    try {
      const saved1 = localStorage.getItem('manas_user_profile_v2');
      const p1 = saved1 ? JSON.parse(saved1) : {};
      Object.assign(p1, patch);
      localStorage.setItem('manas_user_profile_v2', JSON.stringify(p1));

      const saved2 = localStorage.getItem('manas_twin_profile');
      const p2 = saved2 ? JSON.parse(saved2) : {};
      Object.assign(p2, patch);
      localStorage.setItem('manas_twin_profile', JSON.stringify(p2));

      const token = localStorage.getItem('manas_access_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      fetch('/api/user/profile', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          voice_gender: patch.voiceGender,
          voice_tone: patch.voiceTone,
          speaking_style: patch.speakingStyle,
          voice_speed: patch.voiceSpeed,
          reply_length: patch.replyLength,
          voice_follows_companion: patch.voiceFollowsCompanion,
        }),
      }).catch((e) => console.warn('Background sync failed:', e));
    } catch (_) {}
  };

  const handleCompanionChange = (newCompanion: 'girl' | 'boy') => {
    speechGateway.stopSpeaking();
    setCompanion(newCompanion);
    let nextVoiceGender = voiceGender;
    let nextVoiceTone = voiceTone;
    if (voiceFollowsCompanion) {
      nextVoiceGender = newCompanion;
      nextVoiceTone = newCompanion === 'boy' ? 'aarav' : 'ananya';
      setVoiceGender(nextVoiceGender);
      setVoiceTone(nextVoiceTone);
      playPreviewLine(nextVoiceGender, nextVoiceTone, speakingStyle, voiceSpeed);
    }
    persistToStorageAndDb({
      companion: newCompanion,
      gender: newCompanion,
      avatarType: newCompanion,
      voiceGender: nextVoiceGender,
      voiceTone: nextVoiceTone,
      voicePref: nextVoiceTone,
    });
  };

  const handleVoiceGenderChange = (newVoiceGender: 'girl' | 'boy') => {
    setVoiceGender(newVoiceGender);
    const validVoices = newVoiceGender === 'boy' ? BOY_VOICES : GIRL_VOICES;
    let nextTone = voiceTone;
    if (!validVoices.some((v) => v.id === voiceTone)) {
      nextTone = validVoices[0].id;
      setVoiceTone(nextTone);
    }
    playPreviewLine(newVoiceGender, nextTone, speakingStyle, voiceSpeed);
    persistToStorageAndDb({
      voiceGender: newVoiceGender,
      voiceTone: nextTone,
      voicePref: nextTone,
    });
  };

  const handleVoiceFollowsCompanionChange = (checked: boolean) => {
    setVoiceFollowsCompanion(checked);
    let nextVoiceGender = voiceGender;
    let nextVoiceTone = voiceTone;
    if (checked) {
      nextVoiceGender = companion;
      nextVoiceTone = companion === 'boy' ? 'aarav' : 'ananya';
      setVoiceGender(nextVoiceGender);
      setVoiceTone(nextVoiceTone);
      playPreviewLine(nextVoiceGender, nextVoiceTone, speakingStyle, voiceSpeed);
    }
    persistToStorageAndDb({
      voiceFollowsCompanion: checked,
      voiceGender: nextVoiceGender,
      voiceTone: nextVoiceTone,
      voicePref: nextVoiceTone,
    });
  };

  const handleVoiceSelect = (vId: string) => {
    setVoiceTone(vId);
    playPreviewLine(voiceGender, vId, speakingStyle, voiceSpeed);
    persistToStorageAndDb({
      voiceTone: vId,
      voicePref: vId,
    });
  };

  const handleToneSelect = (toneLabel: string) => {
    setSpeakingStyle(toneLabel);
    playPreviewLine(voiceGender, voiceTone, toneLabel, voiceSpeed);
    persistToStorageAndDb({
      speakingStyle: toneLabel,
    });
  };

  const handleSpeedChange = (speed: number) => {
    setVoiceSpeed(speed);
    persistToStorageAndDb({
      voiceSpeed: speed,
    });
  };

  const handleReplyLengthChange = (len: 'Short' | 'Balanced' | 'Detailed') => {
    setReplyLength(len);
    persistToStorageAndDb({
      replyLength: len,
    });
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
      voiceFollowsCompanion,
      speakingStyle,
      voiceSpeed,
      replyLength,
      voicePitch: voiceGender === 'girl' ? 1.15 : 0.9,
    };

    onUpdateProfile(updated);

    try {
      const saved1 = localStorage.getItem('manas_user_profile_v2');
      const p1 = saved1 ? JSON.parse(saved1) : {};
      Object.assign(p1, updated);
      localStorage.setItem('manas_user_profile_v2', JSON.stringify(p1));

      const saved2 = localStorage.getItem('manas_twin_profile');
      const p2 = saved2 ? JSON.parse(saved2) : {};
      Object.assign(p2, updated);
      localStorage.setItem('manas_twin_profile', JSON.stringify(p2));

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
          speaking_style: updated.speakingStyle,
          voice_speed: updated.voiceSpeed,
          reply_length: updated.replyLength,
          voice_follows_companion: updated.voiceFollowsCompanion,
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
                <p className="text-[11px] font-mono text-[#0A0A0A]/50">Companion, voice & tone, name, age & language</p>
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
          <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
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
                      <div className="text-[10px] text-[#0A0A0A]/60">Ananya / 3D Model</div>
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

            {/* 4. Voice & Tone Section */}
            <div className="pt-2 border-t border-[#0A0A0A]/10 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-[#8B5CF6]" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#0A0A0A]">
                    Voice & Tone
                  </span>
                </div>
                {/* Voice follows companion checkbox */}
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-mono text-[#0A0A0A]/80 select-none">
                  <input
                    type="checkbox"
                    checked={voiceFollowsCompanion}
                    onChange={(e) => handleVoiceFollowsCompanionChange(e.target.checked)}
                    className="rounded border-[#0A0A0A]/20 text-[#8B5CF6] focus:ring-[#8B5CF6] w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Voice follows companion</span>
                </label>
              </div>

              {/* Voice Gender Switch */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold text-[#0A0A0A]/70 uppercase tracking-wider block">
                  Voice Gender
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    id="voice-gender-female"
                    onClick={() => handleVoiceGenderChange('girl')}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-mono transition-all cursor-pointer ${
                      voiceGender === 'girl'
                        ? 'border-[#8B5CF6] bg-violet-50 text-[#8B5CF6] font-bold ring-1 ring-[#8B5CF6]'
                        : 'border-[#0A0A0A]/10 bg-[#FDFBF7] hover:bg-[#F3F0E6] text-[#0A0A0A]/80'
                    }`}
                  >
                    <span>Female Voice</span>
                    {voiceGender === 'girl' && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    id="voice-gender-male"
                    onClick={() => handleVoiceGenderChange('boy')}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-mono transition-all cursor-pointer ${
                      voiceGender === 'boy'
                        ? 'border-[#8B5CF6] bg-violet-50 text-[#8B5CF6] font-bold ring-1 ring-[#8B5CF6]'
                        : 'border-[#0A0A0A]/10 bg-[#FDFBF7] hover:bg-[#F3F0E6] text-[#0A0A0A]/80'
                    }`}
                  >
                    <span>Male Voice</span>
                    {voiceGender === 'boy' && <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Voice Cards (Filtered for Current Gender Only) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono font-bold text-[#0A0A0A]/70 uppercase tracking-wider">
                    Voice ({voiceGender === 'girl' ? 'Female' : 'Male'})
                  </label>
                  <span className="text-[10px] font-mono text-[#0A0A0A]/50">
                    Sample in {SUPPORTED_LANGUAGES.find((l) => l.code === language)?.englishName || language}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {currentVoices.map((voice) => {
                    const isSelected = voiceTone === voice.id;
                    return (
                      <div
                        key={voice.id}
                        id={`voice-card-${voice.id}`}
                        onClick={() => handleVoiceSelect(voice.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative group flex flex-col justify-between ${
                          isSelected
                            ? 'border-[#8B5CF6] bg-violet-50/90 ring-1 ring-[#8B5CF6] shadow-xs'
                            : 'border-[#0A0A0A]/10 bg-[#FDFBF7] hover:bg-[#F3F0E6]'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="font-mono text-xs font-bold text-[#0A0A0A]">{voice.name}</div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#8B5CF6]" />}
                        </div>
                        <div className="text-[10px] text-[#0A0A0A]/60 my-1 line-clamp-1">{voice.style}</div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVoiceSelect(voice.id);
                          }}
                          className={`mt-1 py-1 px-2 rounded-lg text-[10px] font-mono font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#8B5CF6] text-white hover:bg-violet-700'
                              : 'bg-black/5 hover:bg-black/10 text-[#0A0A0A]/80'
                          }`}
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>{isPlayingTest && isSelected ? 'Playing' : 'Play'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* How should they speak? (Tone of speaking) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono font-bold text-[#0A0A0A]/70 uppercase tracking-wider block">
                  How should they speak? (Tone)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SPEAKING_TONES.map((t) => {
                    const isSelected = speakingStyle.toLowerCase() === t.label.toLowerCase();
                    return (
                      <button
                        key={t.id}
                        id={`tone-select-${t.id}`}
                        type="button"
                        onClick={() => handleToneSelect(t.label)}
                        className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#8B5CF6] bg-[#8B5CF6] text-white font-bold shadow-xs'
                            : 'border-[#0A0A0A]/10 bg-[#FDFBF7] hover:bg-[#F3F0E6] text-[#0A0A0A]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span>{t.label}</span>
                          <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${isSelected ? 'bg-white/20 text-white' : 'bg-black/5 text-[#0A0A0A]/60'}`}>
                            {t.pace}x
                          </span>
                        </div>
                        <div className={`text-[9px] mt-0.5 line-clamp-1 ${isSelected ? 'text-white/80' : 'text-[#0A0A0A]/60'}`}>
                          {t.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Voice Speed Slider & Reply Length */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Speed Slider 0.85x - 1.15x */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono font-bold text-[#0A0A0A]/70 uppercase tracking-wider">
                      Voice Speed
                    </label>
                    <span className="text-xs font-mono font-bold text-[#8B5CF6]">
                      {voiceSpeed.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.85"
                    max="1.15"
                    step="0.05"
                    value={voiceSpeed}
                    onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                    className="w-full accent-[#8B5CF6] cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-[#0A0A0A]/50">
                    <span>0.85x (Calm)</span>
                    <span>1.0x</span>
                    <span>1.15x (Fast)</span>
                  </div>
                </div>

                {/* Reply Length (Short / Balanced / Detailed) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-bold text-[#0A0A0A]/70 uppercase tracking-wider block">
                    Reply Length
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['Short', 'Balanced', 'Detailed'] as const).map((len) => (
                      <button
                        key={len}
                        id={`reply-len-${len.toLowerCase()}`}
                        type="button"
                        onClick={() => handleReplyLengthChange(len)}
                        className={`py-1.5 px-1 rounded-xl border text-[11px] font-mono transition-all cursor-pointer text-center ${
                          replyLength.toLowerCase() === len.toLowerCase()
                            ? 'border-[#8B5CF6] bg-[#8B5CF6] text-white font-bold shadow-xs'
                            : 'border-[#0A0A0A]/10 bg-[#FDFBF7] hover:bg-[#F3F0E6] text-[#0A0A0A]/80'
                        }`}
                      >
                        {len}
                      </button>
                    ))}
                  </div>
                </div>
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
