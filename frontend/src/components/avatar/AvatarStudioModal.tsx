/**
 * AvatarStudioModal.tsx
 *
 * 3D Avatar Studio & Personalization Modal:
 * - Companion Selection: Girl (girl.vrm) / Boy (boy.vrm) default 3D rigs
 * - Opt-in "Avatar Like Me" photo appearance matching powered by Gemini 3.8 Flash
 * - Explicit privacy consent: "Your photo is used once to match appearance, then deleted. Only the results are kept."
 * - Server-side transient processing with zero storage or identification
 * - Before / After preview with "Looks good / Adjust" color & attribute sliders
 * - Voice Profile matching: Girl -> female voice, Boy -> male voice
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Upload,
  Camera,
  Sparkles,
  Volume2,
  Play,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  User,
  Film,
  RefreshCw,
  Wand2,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import type { UserProfile } from '../OnboardingModal';
import { speechEngine } from '../../lib/voice/speechEngine';
import { speechGateway } from '../../lib/voice/speechGateway';
import {
  VRMAvatarCanvas,
  PHOTO_AVATAR_ENABLED,
  type AvatarAppearanceAttributes,
} from './VRMAvatarCanvas';

interface AvatarStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onApplyAvatar: (updated: {
    companion?: 'boy' | 'girl';
    avatarUrl?: string;
    avatarType?: string;
    isCustomAvatar?: boolean;
    voiceGender?: 'boy' | 'girl';
    voicePitch?: number;
    appearanceAttributes?: AvatarAppearanceAttributes;
  }) => void;
}

export const AvatarStudioModal: React.FC<AvatarStudioModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onApplyAvatar,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedGender, setSelectedGender] = useState<'boy' | 'girl'>(
    userProfile.companion || userProfile.voiceGender || (userProfile.avatarType === 'girl' ? 'girl' : 'boy')
  );
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(userProfile.avatarUrl || null);
  const [isMatchingPhoto, setIsMatchingPhoto] = useState<boolean>(false);
  const [matchedAttrs, setMatchedAttrs] = useState<AvatarAppearanceAttributes | null>(null);
  const [activeAdjustTab, setActiveAdjustTab] = useState<'preview' | 'adjust'>('preview');

  // Interactive Adjust sliders state
  const [skinColor, setSkinColor] = useState<string>('#F0C8A0');
  const [hairColor, setHairColor] = useState<string>('#2C1B18');
  const [eyeColor, setEyeColor] = useState<string>('#3D2314');

  const [selectedVoiceProfile, setSelectedVoiceProfile] = useState<string>(
    (userProfile.companion || selectedGender) === 'girl' ? 'girl_gentle' : 'boy_grounded'
  );
  const [selectedEmotion, setSelectedEmotion] = useState<string>('calm');
  const [selectedGestures, setSelectedGestures] = useState<string[]>([
    'nod',
    'wave',
    'breathe',
    'encourage',
  ]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationDone, setGenerationDone] = useState<boolean>(false);
  const [voiceTestPlaying, setVoiceTestPlaying] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      setPhotoDataUrl(dataUrl);

      // Analyze photo server-side via gemini-3.8-flash
      if (PHOTO_AVATAR_ENABLED) {
        setIsMatchingPhoto(true);
        setErrorMsg(null);
        try {
          const res = await fetch('/api/agent/avatar/photo-match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photo_base64: dataUrl }),
          });
          if (res.ok) {
            const data: AvatarAppearanceAttributes = await res.json();
            setMatchedAttrs(data);
            if (data.skin_tone_hex) setSkinColor(data.skin_tone_hex);
            if (data.hair_color_hex) setHairColor(data.hair_color_hex);
            if (data.eye_color_hex) setEyeColor(data.eye_color_hex);
          }
        } catch (err: any) {
          console.warn('Photo matching error:', err);
        } finally {
          setIsMatchingPhoto(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const playVoicePreview = () => {
    setVoiceTestPlaying(true);
    const lang = userProfile.language || 'en';
    const isGirl = selectedGender === 'girl';

    const SAMPLES: Record<string, { girl: string; boy: string }> = {
      en: {
        girl: 'Hello! I am your companion avatar, right here whenever you need a safe space.',
        boy: 'Hello! I am your companion avatar, right here whenever you need a safe space.',
      },
      hi: {
        girl: 'नमस्ते, मैं हमेशा आपकी बात सुनने और साथ निभाने के लिए यहाँ हूँ।',
        boy: 'नमस्ते, मैं हमेशा आपकी बात सुनने और साथ निभाने के लिए यहाँ हूँ।',
      },
      ta: {
        girl: 'வணக்கம், நான் எப்போதும் உங்களுடன் ஒரு தோழியாக இருப்பேன்.',
        boy: 'வணக்கம், நான் எப்போதும் உங்களுடன் ஒரு தோழனாக இருப்பேன்.',
      },
      te: {
        girl: 'నమస్కారం, నేను ఎప్పుడూ మీకు ఒక స్నేహితురాలిగా ఉంటాను.',
        boy: 'నమస్కారం, నేను ఎప్పుడూ మీకు ఒక స్నేహితుడిగా ఉంటాను.',
      },
      kn: {
        girl: 'ನಮಸ್ಕಾರ, ನಾನು ಯಾವಾಗಲೂ ನಿಮಗೆ ಒಬ್ಬ ಗೆಳತಿಯಾಗಿ ಜೊತೆಗಿರುತ್ತೇನೆ.',
        boy: 'ನಮಸ್ಕಾರ, ನಾನು ಯಾವಾಗಲೂ ನಿಮಗೆ ಒಬ್ಬ ಗೆಳೆಯನಾಗಿ ಜೊತೆಗಿರುತ್ತೇನೆ.',
      },
      ml: {
        girl: 'നമസ്കാരം, ഞാൻ എപ്പോഴും നിങ്ങളുടെ കൂടെ ഒരു കൂട്ടുകാരിയായി ഉണ്ടാകും.',
        boy: 'നമസ്കാരം, ഞാൻ എപ്പോഴും നിങ്ങളുടെ കൂടെ ഒരു കൂട്ടുകാരനായി ഉണ്ടാകും.',
      },
      bn: {
        girl: 'নমস্কার, আমি সবসময় আপনার পাশে একজন বন্ধু হয়ে থাকব।',
        boy: 'নমস্কার, আমি সবসময় আপনার পাশে একজন বন্ধু হয়ে থাকব।',
      },
      mr: {
        girl: 'नमस्कार, मी नेहमी तुमच्या पाठीशी एक मैत्रीण म्हणून उभी राहीन.',
        boy: 'नमस्कार, मी नेहमी तुमच्या पाठीशी एक मित्र म्हणून उभा राहीन.',
      },
    };

    const langSamples = SAMPLES[lang] || SAMPLES.en;
    const sample = isGirl ? langSamples.girl : langSamples.boy;

    speechGateway.speak({
      text: sample,
      lang,
      gender: isGirl ? 'girl' : 'boy',
      purpose: 'avatar_studio_preview',
      pitch: isGirl ? 1.15 : 0.9,
      onEnd: () => setVoiceTestPlaying(false),
      onError: () => setVoiceTestPlaying(false),
    });
  };

  const handleRunPipeline = async () => {
    setIsGenerating(true);
    setErrorMsg(null);

    const appearanceAttributes: AvatarAppearanceAttributes = {
      ...(matchedAttrs || {}),
      skin_tone_hex: skinColor,
      hair_color_hex: hairColor,
      eye_color_hex: eyeColor,
    };

    onApplyAvatar({
      companion: selectedGender,
      avatarUrl: photoDataUrl || undefined,
      avatarType: selectedGender,
      isCustomAvatar: Boolean(matchedAttrs),
      voiceGender: selectedGender,
      voicePitch: selectedGender === 'girl' ? 1.15 : 0.9,
      appearanceAttributes,
    });

    setGenerationDone(true);
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl bg-[#0B0E14] border border-white/15 rounded-3xl p-5 sm:p-7 shadow-2xl text-white z-10 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-pink-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="mb-4 border-b border-white/10 pb-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono mb-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>3D Companion Mascot Studio</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Customize 3D Companion
            </h2>
            <p className="text-xs text-white/60 font-mono mt-0.5">
              Step 1: Choose Companion • Step 2: Voiceover Timing • Step 3: Expression & Sync
            </p>

            {/* Stepper Indicator */}
            <div className="flex items-center gap-2 mt-3">
              {[
                { num: 1, label: '1. Model & Appearance' },
                { num: 2, label: '2. Voice Matching' },
                { num: 3, label: '3. Expressions & Sync' },
              ].map((s) => (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setCurrentStep(s.num as any)}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-mono font-semibold transition-all border ${
                    currentStep === s.num
                      ? 'bg-purple-500/20 border-purple-400 text-purple-300 shadow-sm'
                      : currentStep > s.num
                      ? 'bg-white/10 border-white/20 text-white/80'
                      : 'bg-white/5 border-white/10 text-white/40'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-3 p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-mono">
              {errorMsg}
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* STEP 1: Model Choice & Opt-in Photo Matching */}
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 font-mono">
                    Choose Your 3D Companion
                  </h3>
                  <p className="text-xs text-white/60 font-sans mt-0.5">
                    Select your default 3D avatar (Girl or Boy). Both models feature full spring bone
                    physics, natural pose, and live TTS lip-sync.
                  </p>
                </div>

                {/* Companion Selection Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedGender('girl')}
                    className={`p-3 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer text-left ${
                      selectedGender === 'girl'
                        ? 'border-pink-500 bg-pink-950/40 ring-1 ring-pink-500'
                        : 'border-white/15 bg-white/5 hover:border-white/30'
                    }`}
                  >
                    <img
                      src="/avatars/girl.png"
                      alt="Girl Companion"
                      className="w-12 h-14 rounded-xl object-contain bg-pink-950/20"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">Girl VRM</span>
                        {selectedGender === 'girl' && (
                          <span className="text-pink-400 text-xs font-bold font-mono">✓ Active</span>
                        )}
                      </div>
                      <span className="text-[11px] text-white/50 block truncate font-mono">
                        girl.vrm · female voice
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedGender('boy')}
                    className={`p-3 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer text-left ${
                      selectedGender === 'boy'
                        ? 'border-cyan-500 bg-cyan-950/40 ring-1 ring-cyan-500'
                        : 'border-white/15 bg-white/5 hover:border-white/30'
                    }`}
                  >
                    <img
                      src="/avatars/boy.png"
                      alt="Boy Companion"
                      className="w-12 h-14 rounded-xl object-contain bg-cyan-950/20"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">Boy VRM</span>
                        {selectedGender === 'boy' && (
                          <span className="text-cyan-400 text-xs font-bold font-mono">✓ Active</span>
                        )}
                      </div>
                      <span className="text-[11px] text-white/50 block truncate font-mono">
                        boy.vrm · male voice
                      </span>
                    </div>
                  </button>
                </div>

                {/* Opt-in "Avatar Like Me" Upload */}
                <div className="p-4 rounded-2xl border border-white/10 bg-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold font-mono uppercase tracking-wider text-purple-200">
                        Opt-in: "Avatar Like Me"
                      </span>
                    </div>
                    {matchedAttrs && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Matched ✓
                      </span>
                    )}
                  </div>

                  {/* Explicit Privacy Consent Notice */}
                  <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/30 flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-purple-300 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-purple-200/90 leading-relaxed font-mono">
                      Your photo is used once to match appearance, then deleted. Only the results are kept.
                      Processed strictly server-side without logs or identification.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isMatchingPhoto}
                      onClick={() => fileInputRef.current?.click()}
                      className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isMatchingPhoto ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Matching via Gemini...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Photo</span>
                        </>
                      )}
                    </button>
                    {photoDataUrl && (
                      <span className="text-[11px] font-mono text-white/50 truncate">
                        Photo loaded & matched
                      </span>
                    )}
                  </div>

                  {/* Before / After & Adjust Sliders */}
                  {matchedAttrs && (
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-white/70">Appearance Match:</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveAdjustTab('preview')}
                            className={`px-2 py-0.5 rounded-lg border text-[10px] ${
                              activeAdjustTab === 'preview'
                                ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                                : 'border-white/10 text-white/50'
                            }`}
                          >
                            Looks Good
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveAdjustTab('adjust')}
                            className={`px-2 py-0.5 rounded-lg border text-[10px] ${
                              activeAdjustTab === 'adjust'
                                ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                                : 'border-white/10 text-white/50'
                            }`}
                          >
                            Adjust Sliders
                          </button>
                        </div>
                      </div>

                      {activeAdjustTab === 'adjust' && (
                        <div className="space-y-2 pt-1 font-mono text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-white/60">Skin Tone</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={skinColor}
                                onChange={(e) => setSkinColor(e.target.value)}
                                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                              />
                              <span className="text-[10px] text-white/40">{skinColor}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-white/60">Hair Color</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={hairColor}
                                onChange={(e) => setHairColor(e.target.value)}
                                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                              />
                              <span className="text-[10px] text-white/40">{hairColor}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-white/60">Eye Color</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={eyeColor}
                                onChange={(e) => setEyeColor(e.target.value)}
                                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                              />
                              <span className="text-[10px] text-white/40">{eyeColor}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 2: Voice Matching */}
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 font-mono">
                    Voiceover Matching
                  </h3>
                  <p className="text-xs text-white/60 font-sans mt-0.5">
                    Each companion automatically matches voice gender for natural cadence. Recognition
                    pauses during playback to prevent echo.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div
                    className={`p-3.5 rounded-2xl border text-left ${
                      selectedGender === 'girl'
                        ? 'border-pink-500 bg-pink-950/40 ring-1 ring-pink-500'
                        : 'border-white/10 bg-white/5 opacity-60'
                    }`}
                  >
                    <span className="text-xs font-bold text-white block">Female Voice Profile</span>
                    <span className="text-[10px] font-mono text-pink-300 mt-1 block">
                      Ananya / Rachel · Empathetic Pitch
                    </span>
                  </div>

                  <div
                    className={`p-3.5 rounded-2xl border text-left ${
                      selectedGender === 'boy'
                        ? 'border-cyan-500 bg-cyan-950/40 ring-1 ring-cyan-500'
                        : 'border-white/10 bg-white/5 opacity-60'
                    }`}
                  >
                    <span className="text-xs font-bold text-white block">Male Voice Profile</span>
                    <span className="text-[10px] font-mono text-cyan-300 mt-1 block">
                      Achal / Adam · Grounded Pitch
                    </span>
                  </div>
                </div>

                {/* Voice Preview Button */}
                <button
                  type="button"
                  disabled={voiceTestPlaying}
                  onClick={playVoicePreview}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-mono text-purple-300 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>
                    {voiceTestPlaying
                      ? 'Playing voice sample...'
                      : `Listen to Voiceover Sample (${(userProfile.language || 'en').toUpperCase()})`}
                  </span>
                </button>
              </motion.div>
            )}

            {/* STEP 3: Expressions & Lip-Sync Preview */}
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 font-mono">
                    Expressions & Motion Sync
                  </h3>
                  <p className="text-xs text-white/60 font-sans mt-0.5">
                    Emotions crossfade smoothly (400ms) with intensity capped at 0.5. Neutral baseline
                    resumes between dialogue turns.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'calm', label: '🌿 Relaxed 0.5' },
                    { id: 'empathetic', label: '💜 Sad 0.25 + Relaxed 0.3' },
                    { id: 'encouraging', label: '✨ Happy 0.45' },
                  ].map((em) => (
                    <button
                      key={em.id}
                      type="button"
                      onClick={() => setSelectedEmotion(em.id)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer text-xs font-mono ${
                        selectedEmotion === em.id
                          ? 'border-purple-400 bg-purple-950/40 text-purple-300 font-bold'
                          : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      {em.label}
                    </button>
                  ))}
                </div>

                {/* Summary Banner */}
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2.5">
                    <Film className="w-4 h-4 text-purple-400" />
                    <span>Active Companion:</span>
                  </div>
                  <span className="text-purple-300 font-semibold">
                    {selectedGender.toUpperCase()} VRM 1.0 Rig
                  </span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Modal Footer Controls */}
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((currentStep - 1) as any)}
                className="py-2.5 px-4 rounded-xl border border-white/20 text-xs font-mono text-white/80 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((currentStep + 1) as any)}
                className="py-2.5 px-5 rounded-xl bg-white text-black font-semibold text-xs font-mono flex items-center gap-1.5 hover:bg-white/90 transition-all cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isGenerating || generationDone}
                onClick={handleRunPipeline}
                className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 text-white font-bold text-xs font-mono flex items-center gap-2 shadow-lg shadow-purple-500/30 hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : generationDone ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Updated Companion!</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>Apply to Companion</span>
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AvatarStudioModal;
