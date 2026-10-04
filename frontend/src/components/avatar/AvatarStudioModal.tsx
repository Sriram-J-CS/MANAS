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
} from 'lucide-react';
import type { UserProfile } from '../OnboardingModal';
import { speechEngine } from '../../lib/voice/speechEngine';

interface AvatarStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onApplyAvatar: (updated: {
    avatarUrl?: string;
    avatarType?: string;
    isCustomAvatar?: boolean;
    voiceGender?: 'boy' | 'girl';
    voicePitch?: number;
  }) => void;
}

export const AvatarStudioModal: React.FC<AvatarStudioModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onApplyAvatar,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(userProfile.avatarUrl || null);
  const [selectedGender, setSelectedGender] = useState<'boy' | 'girl'>(
    userProfile.voiceGender || (userProfile.avatarType === 'girl' ? 'girl' : 'boy')
  );
  const [selectedVoiceProfile, setSelectedVoiceProfile] = useState<string>(
    userProfile.voiceGender === 'girl' ? 'girl_gentle' : 'boy_grounded'
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setPhotoDataUrl(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const playVoicePreview = () => {
    setVoiceTestPlaying(true);
    const lang = userProfile.language || 'en';
    const sample =
      lang === 'ta'
        ? 'வணக்கம், நான் உங்கள் எண்ணங்களுக்கு உறுதுணையாக இருப்பேன்.'
        : lang === 'hi'
        ? 'नमस्ते, मैं हमेशा आपकी बात सुनने और साथ निभाने के लिए यहाँ हूँ।'
        : 'Hello, I am your digital twin avatar. Ready to listen whenever you want to talk.';

    const isGirl = selectedGender === 'girl';
    speechEngine.speak(sample, lang, {
      gender: isGirl ? 'girl' : 'boy',
      pitch: isGirl ? 1.18 : 0.88,
      onEnd: () => setVoiceTestPlaying(false),
      onError: () => setVoiceTestPlaying(false),
    });
  };

  const handleRunPipeline = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/agent/avatar/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_base64: photoDataUrl || undefined,
          gender: selectedGender,
          voice_profile: selectedVoiceProfile,
          preferred_language: userProfile.language || 'en',
          emotion: selectedEmotion,
          gestures: selectedGestures,
          user_name: userProfile.name || 'Friend',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to complete avatar pipeline.');
      }

      setGenerationDone(true);

      // Apply to active companion stage
      onApplyAvatar({
        avatarUrl: data.active_avatar_url,
        avatarType: data.avatar_mode === 'custom_face' ? 'custom' : selectedGender,
        isCustomAvatar: data.avatar_mode === 'custom_face',
        voiceGender: data.voice_gender,
        voicePitch: data.voice_pitch,
      });

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error executing pipeline.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
          className="relative w-full max-w-xl bg-[#0B0E14] border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl text-white z-10 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-pink-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="mb-5 border-b border-white/10 pb-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono mb-2">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>3-Step Speaking Avatar Pipeline</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Speaking Avatar Studio
            </h2>
            <p className="text-xs text-white/60 font-mono mt-0.5">
              Step 1: Face Synthesis • Step 2: Voiceover Profile • Step 3: Hedra.ai Animation
            </p>

            {/* Stepper Indicator */}
            <div className="flex items-center gap-2 mt-4">
              {[
                { num: 1, label: '1. Face Prompt' },
                { num: 2, label: '2. ElevenLabs Voice' },
                { num: 3, label: '3. Hedra.ai Sync' },
              ].map((s) => (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setCurrentStep(s.num as any)}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-mono font-semibold transition-all border ${
                    currentStep === s.num
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
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
            <div className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-mono">
              {errorMsg}
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* STEP 1: Custom Face Prompt or Default Avatar */}
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300 font-mono">
                    Step 1: Custom Avatar Face
                  </h3>
                  <p className="text-xs text-white/60 font-sans mt-0.5">
                    Upload one of your photos to generate a face that actually feels like yours, or keep
                    the high-fidelity default 3D mascot.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Photo Upload Card */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                      photoDataUrl
                        ? 'border-cyan-400 bg-cyan-950/20'
                        : 'border-white/20 bg-white/5 hover:border-cyan-400/60'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    {photoDataUrl ? (
                      <div className="flex flex-col items-center gap-2">
                        <img
                          src={photoDataUrl}
                          alt="Custom Face"
                          className="w-20 h-20 rounded-full object-cover border-2 border-cyan-400 shadow-md"
                        />
                        <span className="text-xs text-cyan-300 font-mono font-semibold">
                          Custom Photo Loaded ✓
                        </span>
                        <span className="text-[10px] text-white/50 font-mono">Click to change</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-3">
                        <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-300">
                          <Upload className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-semibold text-white">Upload Your Photo</span>
                        <span className="text-[10px] text-white/50 font-mono max-w-[160px]">
                          ChatGPT custom prompt synthesizes your digital twin face
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Default 3D Avatar Option */}
                  <div
                    onClick={() => setPhotoDataUrl(null)}
                    className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                      !photoDataUrl
                        ? 'border-cyan-400 bg-cyan-950/20 ring-1 ring-cyan-400'
                        : 'border-white/15 bg-white/5 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <img
                        src="/avatars/boy.png"
                        alt="Default Boy"
                        className={`w-12 h-12 rounded-xl object-contain border ${
                          selectedGender === 'boy' ? 'border-cyan-400' : 'border-transparent'
                        }`}
                      />
                      <img
                        src="/avatars/girl.png"
                        alt="Default Girl"
                        className={`w-12 h-12 rounded-xl object-contain border ${
                          selectedGender === 'girl' ? 'border-pink-400' : 'border-transparent'
                        }`}
                      />
                    </div>
                    <span className="text-xs font-semibold text-white">Keep Default 3D Mascot</span>
                    <span className="text-[10px] text-white/50 font-mono mt-0.5">
                      Procedural 3D cartoon rig with gaze tracking & lip-sync
                    </span>
                  </div>
                </div>

                {/* Gender Base Toggle */}
                <div className="pt-2">
                  <label className="block text-xs font-mono uppercase tracking-wider text-white/70 mb-2">
                    Character Silhouette & Style
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedGender('boy')}
                      className={`py-2.5 px-3 rounded-xl border text-center transition-all cursor-pointer font-mono text-xs ${
                        selectedGender === 'boy'
                          ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300 font-bold'
                          : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      👦 Boy Base
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedGender('girl')}
                      className={`py-2.5 px-3 rounded-xl border text-center transition-all cursor-pointer font-mono text-xs ${
                        selectedGender === 'girl'
                          ? 'border-pink-400 bg-pink-950/40 text-pink-300 font-bold'
                          : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      👧 Girl Base
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: ElevenLabs Voice Profile & Voice Cloning */}
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300 font-mono">
                    Step 2: ElevenLabs Voice Profile
                  </h3>
                  <p className="text-xs text-white/60 font-sans mt-0.5">
                    Choose an existing profile or match your gender identity. Your companion speaks with
                    authentic native cadence.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVoiceProfile('boy_grounded');
                      setSelectedGender('boy');
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      selectedVoiceProfile === 'boy_grounded' || selectedGender === 'boy'
                        ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400'
                        : 'border-white/15 bg-white/5 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-white">👦 Boy Voice Profile</span>
                      <span className="text-[10px] font-mono text-cyan-300">Adam / Arjun</span>
                    </div>
                    <p className="text-xs text-white/60">
                      Deeper resonance, grounded composure, calm therapeutic cadence.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVoiceProfile('girl_gentle');
                      setSelectedGender('girl');
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      selectedVoiceProfile === 'girl_gentle' || selectedGender === 'girl'
                        ? 'border-pink-400 bg-pink-950/40 ring-1 ring-pink-400'
                        : 'border-white/15 bg-white/5 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-white">👧 Girl Voice Profile</span>
                      <span className="text-[10px] font-mono text-pink-300">Rachel / Ananya</span>
                    </div>
                    <p className="text-xs text-white/60">
                      Bright, gentle timbre, empathetic warmth, soft therapeutic tone.
                    </p>
                  </button>
                </div>

                {/* Voice Preview Button */}
                <button
                  type="button"
                  disabled={voiceTestPlaying}
                  onClick={playVoicePreview}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-mono text-cyan-300 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>
                    {voiceTestPlaying
                      ? 'Synthesizing voice...'
                      : `Listen to Voiceover Sample (${userProfile.language ? userProfile.language.toUpperCase() : 'EN'})`}
                  </span>
                </button>
              </motion.div>
            )}

            {/* STEP 3: Hedra.ai Animation Stage */}
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300 font-mono">
                    Step 3: Hedra.ai Talking Head Synthesis
                  </h3>
                  <p className="text-xs text-white/60 font-sans mt-0.5">
                    Combine the avatar face with voiceover, hand gestures, and emotion to connect
                    seamlessly to your live chat.
                  </p>
                </div>

                {/* Emotion Selector */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-white/70 mb-2">
                    Sprinkle in Emotion
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'calm', label: '🌿 Calm & Grounded' },
                      { id: 'empathetic', label: '💜 Empathetic' },
                      { id: 'happy', label: '✨ Warm & Uplifting' },
                    ].map((em) => (
                      <button
                        key={em.id}
                        type="button"
                        onClick={() => setSelectedEmotion(em.id)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer text-xs font-mono ${
                          selectedEmotion === em.id
                            ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300 font-bold'
                            : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
                        }`}
                      >
                        {em.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gestures Selector */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-white/70 mb-2">
                    Hand & Bodily Gestures
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    {[
                      { id: 'nod', label: 'Attentive Nodding' },
                      { id: 'wave', label: 'Gentle Welcoming Wave' },
                      { id: 'breathe', label: 'Deep Breathing Sync' },
                      { id: 'encourage', label: 'Encouraging Posture' },
                    ].map((g) => {
                      const isChecked = selectedGestures.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setSelectedGestures(selectedGestures.filter((x) => x !== g.id));
                            } else {
                              setSelectedGestures([...selectedGestures, g.id]);
                            }
                          }}
                          className={`p-2 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                            isChecked
                              ? 'border-cyan-400 bg-cyan-950/20 text-white'
                              : 'border-white/10 bg-white/5 text-white/50'
                          }`}
                        >
                          <span>{g.label}</span>
                          <span className="text-cyan-400">{isChecked ? '✓' : ''}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Summary Banner */}
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2.5">
                    <Film className="w-4 h-4 text-cyan-400" />
                    <span>Avatar Output:</span>
                  </div>
                  <span className="text-cyan-300 font-semibold">
                    {photoDataUrl ? 'Custom Face + Voice Sync' : `Default 3D ${selectedGender.toUpperCase()} Mascot`}
                  </span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Modal Footer Controls */}
          <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
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
                className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-pink-500 text-white font-bold text-xs font-mono flex items-center gap-2 shadow-lg shadow-cyan-500/30 hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Hedra Synthesizing...</span>
                  </>
                ) : generationDone ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Connected to Chat!</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>Generate & Connect to Chat</span>
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
