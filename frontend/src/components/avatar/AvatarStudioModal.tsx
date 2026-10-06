/**
 * AvatarStudioModal.tsx
 *
 * 3D Avatar Studio & Appearance Matching Modal:
 * - Flow: Upload or Camera -> Explicit Consent Text -> On-device MediaPipe processing ->
 *   Live preview on current 3D avatar -> Adjust color pickers/sliders & glasses -> Confirm or Reset.
 * - Provider 1 (MediaPipe Face Landmarker + Hair Segmenter + Gemini 3.8 Flash structured JSON)
 * - Companion gender chosen in onboarding is never altered by the photo.
 * - Saves only attributes in profile; reapplies on load and companion switch.
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Upload,
  Camera,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Sliders,
  ShieldCheck,
  RotateCcw,
  Glasses,
  Video,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { UserProfile } from '../OnboardingModal';
import {
  getPhotoAvatarProvider,
  type AvatarAppearanceAttributes,
} from '../../lib/avatar/providers';
import { VRMAvatarCanvas, PHOTO_AVATAR_ENABLED } from './VRMAvatarCanvas';

interface AvatarStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onApplyAvatar: (updated: {
    avatarUrl?: string;
    isCustomAvatar?: boolean;
    appearanceAttributes?: AvatarAppearanceAttributes | null;
  }) => void;
}

const SKIN_PRESETS = [
  { name: 'Porcelain', hex: '#F8E7D8' },
  { name: 'Warm Fair', hex: '#F0C8A0' },
  { name: 'Wheatish / Tan', hex: '#D4A373' },
  { name: 'Golden Olive', hex: '#BC8A5F' },
  { name: 'Warm Brown', hex: '#8C5835' },
  { name: 'Espresso', hex: '#4E2F1D' },
];

const HAIR_PRESETS = [
  { name: 'Jet Black', hex: '#141416' },
  { name: 'Dark Brown', hex: '#2C1B18' },
  { name: 'Chestnut', hex: '#4E3127' },
  { name: 'Mocha', hex: '#634335' },
  { name: 'Burgundy', hex: '#582129' },
  { name: 'Silver Gray', hex: '#8E9099' },
];

const EYE_PRESETS = [
  { name: 'Dark Brown', hex: '#261713' },
  { name: 'Warm Amber', hex: '#4B3020' },
  { name: 'Hazel', hex: '#635336' },
  { name: 'Emerald', hex: '#2D4E35' },
  { name: 'Deep Sapphire', hex: '#243C5A' },
];

const LIP_PRESETS = [
  { name: 'Natural Peach', hex: '#D99885' },
  { name: 'Soft Rose', hex: '#C87D7D' },
  { name: 'Warm Mauve', hex: '#B36D74' },
  { name: 'Berry', hex: '#8E4453' },
];

const GLASSES_SHAPES: Array<{ id: 'round' | 'rectangle' | 'oval' | 'square'; label: string }> = [
  { id: 'round', label: 'Round' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'oval', label: 'Oval' },
  { id: 'square', label: 'Square' },
];

export const AvatarStudioModal: React.FC<AvatarStudioModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onApplyAvatar,
}) => {
  // Companion gender from user profile (never altered by photo)
  const companionGender = userProfile.companion || (userProfile.gender === 'girl' ? 'girl' : 'boy');

  // Existing or newly adjusted appearance attributes
  const [currentAttrs, setCurrentAttrs] = useState<AvatarAppearanceAttributes>(() => {
    return (
      userProfile.appearanceAttributes || {
        skin_tone_hex: '#F0C8A0',
        hair_color_hex: '#2C1B18',
        eye_color_hex: '#3D2314',
        lip_color_hex: '#C87D7D',
        glasses: false,
        glasses_shape: 'round',
        glasses_color_hex: '#1E1E24',
      }
    );
  });

  const [activeTab, setActiveTab] = useState<'match' | 'adjust'>('match');
  const [consentServerAnalysis, setConsentServerAnalysis] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Camera state
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (userProfile.appearanceAttributes) {
        setCurrentAttrs(userProfile.appearanceAttributes);
      }
      setErrorMessage(null);
      setSuccessMessage(null);
    } else {
      stopCamera();
    }
  }, [isOpen, userProfile.appearanceAttributes]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setErrorMessage(null);
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Camera access unavailable:', err);
      setIsCameraActive(false);
      setErrorMessage('Camera access was not granted. Please upload a photo from your device.');
    }
  };

  const handleCaptureSnapshot = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    stopCamera();
    await runPhotoProcessing(dataUrl);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await runPhotoProcessing(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const runPhotoProcessing = async (source: File | string) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setProcessingStatus('Analyzing portrait on-device via MediaPipe...');

    try {
      const provider = getPhotoAvatarProvider('mediapipe_gemini');
      const result = await provider.processPhoto(source, {
        allowServerAnalysis: consentServerAnalysis,
        userConsentGiven: true,
      });

      setCurrentAttrs((prev) => ({
        ...prev,
        ...result,
        glasses_shape: result.glasses_shape || prev.glasses_shape || 'round',
        glasses_color_hex: result.glasses_color_hex || prev.glasses_color_hex || '#1E1E24',
      }));

      setSuccessMessage('Photo matched successfully! You can fine-tune colors below.');
      setActiveTab('adjust');
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not analyze photo. Please ensure clear lighting and try again.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleConfirmAndSave = async () => {
    try {
      // 1. Update parent state
      onApplyAvatar({
        isCustomAvatar: true,
        appearanceAttributes: currentAttrs,
      });

      // 2. Persist to server database
      const token = localStorage.getItem('manas_access_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch('/api/user/profile', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          appearance_attributes: JSON.stringify(currentAttrs),
        }),
      });

      // 3. Save to local storage cache
      try {
        const saved = localStorage.getItem('manas_twin_profile');
        const parsed = saved ? JSON.parse(saved) : {};
        parsed.appearanceAttributes = currentAttrs;
        localStorage.setItem('manas_twin_profile', JSON.stringify(parsed));
      } catch (_) {}

      onClose();
    } catch (err) {
      console.warn('Failed to save appearance attributes:', err);
      onClose();
    }
  };

  const handleResetToDefault = async () => {
    setCurrentAttrs({
      skin_tone_hex: '#F0C8A0',
      hair_color_hex: '#2C1B18',
      eye_color_hex: '#3D2314',
      lip_color_hex: '#C87D7D',
      glasses: false,
      glasses_shape: 'round',
      glasses_color_hex: '#1E1E24',
    });

    onApplyAvatar({
      isCustomAvatar: false,
      appearanceAttributes: null,
    });

    try {
      const token = localStorage.getItem('manas_access_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch('/api/user/profile', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ appearance_attributes: null }),
      });
      const saved = localStorage.getItem('manas_twin_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        delete parsed.appearanceAttributes;
        localStorage.setItem('manas_twin_profile', JSON.stringify(parsed));
      }
    } catch (_) {}

    setSuccessMessage('Reset to base default appearance.');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5">
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
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="relative w-full max-w-4xl bg-[#0B0E14] border border-white/15 rounded-3xl p-5 sm:p-7 shadow-2xl text-white z-10 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  Avatar Studio
                  <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    {companionGender.toUpperCase()} COMPANION
                  </span>
                </h2>
                <p className="text-xs text-white/50">Personalize your 3D avatar's look from your photo</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Body Split: Left 42% 3D Live Avatar Preview, Right 58% Upload/Camera & Adjust Sliders */}
          <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-5 py-4">
            {/* LEFT: LIVE 3D AVATAR PREVIEW */}
            <div className="md:col-span-5 flex flex-col items-center justify-between bg-black/40 rounded-2xl border border-white/10 p-3 min-h-[300px]">
              <div className="w-full flex items-center justify-between px-2 pt-1">
                <span className="text-[11px] font-mono text-white/60 font-semibold uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live 3D Preview
                </span>
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="text-[10px] font-mono text-white/40 hover:text-white hover:underline flex items-center gap-1 cursor-pointer"
                  title="Reset to default original avatar"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset to default
                </button>
              </div>

              {/* 3D VRM Canvas with dynamic appearanceAttributes applied */}
              <div className="w-full flex-1 min-h-[260px] flex items-center justify-center relative">
                {PHOTO_AVATAR_ENABLED ? (
                  <VRMAvatarCanvas
                    gender={companionGender}
                    appearanceAttributes={currentAttrs}
                    framing="portrait"
                    emotion="calm"
                    gesture="idle"
                    className="w-full h-full"
                  />
                ) : (
                  <div className="text-xs font-mono text-white/40">3D Preview Offline</div>
                )}
              </div>

              <div className="text-[10px] font-mono text-white/40 text-center px-2">
                Companion gender remains {companionGender}. Tinting applied to skin, hair, and eyes.
              </div>
            </div>

            {/* RIGHT: PHOTO MATCH & ADJUST CONTROLS */}
            <div className="md:col-span-7 flex flex-col space-y-4">
              {/* Navigation Tabs */}
              <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTab('match')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                    activeTab === 'match'
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Photo Match
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('adjust')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                    activeTab === 'adjust'
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Adjust &amp; Fine-Tune
                </button>
              </div>

              {/* Status Notifications */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* TAB 1: PHOTO MATCH (UPLOAD OR CAMERA + EXPLICIT CONSENT) */}
              {activeTab === 'match' && (
                <div className="space-y-4">
                  {/* Explicit Privacy Consent Text as required */}
                  <div className="p-3.5 rounded-2xl bg-violet-950/40 border border-violet-800/40 space-y-2">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-violet-200 leading-relaxed font-sans">
                        <strong className="text-white block font-mono text-[11px] uppercase tracking-wider mb-0.5">
                          Privacy Guarantee
                        </strong>
                        Your photo is used once to match your look, then deleted. Only the results are saved.
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer pt-1 border-t border-violet-800/20 font-mono">
                      <input
                        type="checkbox"
                        checked={consentServerAnalysis}
                        onChange={(e) => setConsentServerAnalysis(e.target.checked)}
                        className="rounded accent-violet-500 cursor-pointer"
                      />
                      <span>Allow AI glasses, facial hair, and hair style detection (transient)</span>
                    </label>
                  </div>

                  {/* Camera Live Stream Window */}
                  {isCameraActive && (
                    <div className="relative rounded-2xl overflow-hidden border border-violet-500/50 bg-black aspect-video flex items-center justify-center">
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                      <div className="absolute bottom-3 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleCaptureSnapshot}
                          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-mono text-xs font-bold flex items-center gap-2 shadow-xl cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Capture Snapshot</span>
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="px-3 py-2 rounded-xl bg-black/60 hover:bg-black/80 text-white/80 font-mono text-xs border border-white/20 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Input Buttons: Upload or Camera */}
                  {!isCameraActive && (
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => fileInputRef.current?.click()}
                        className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Upload className="w-5 h-5 text-violet-400" />
                        <span className="text-xs font-bold text-white">Upload Photo</span>
                        <span className="text-[10px] text-white/40">From local storage</span>
                      </button>

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={startCamera}
                        className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Video className="w-5 h-5 text-cyan-400" />
                        <span className="text-xs font-bold text-white">Use Camera</span>
                        <span className="text-[10px] text-white/40">Webcam snapshot</span>
                      </button>
                    </div>
                  )}

                  {/* Processing Indicator */}
                  {isProcessing && (
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center gap-3 text-xs font-mono text-violet-300">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{processingStatus}</span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: ADJUST SLIDERS & COLOR PICKERS */}
              {activeTab === 'adjust' && (
                <div className="space-y-4 max-h-[46vh] overflow-y-auto pr-1">
                  {/* Skin Tone */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-white/80 font-bold">Skin Tone</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={currentAttrs.skin_tone_hex || '#F0C8A0'}
                          onChange={(e) =>
                            setCurrentAttrs((prev) => ({ ...prev, skin_tone_hex: e.target.value }))
                          }
                          className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                        />
                        <span className="text-[11px] text-white/50">{currentAttrs.skin_tone_hex}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {SKIN_PRESETS.map((p) => (
                        <button
                          key={p.hex}
                          type="button"
                          onClick={() => setCurrentAttrs((prev) => ({ ...prev, skin_tone_hex: p.hex }))}
                          style={{ backgroundColor: p.hex }}
                          className={`w-6 h-6 rounded-full border cursor-pointer transition-transform ${
                            currentAttrs.skin_tone_hex === p.hex
                              ? 'ring-2 ring-white scale-110 border-white'
                              : 'border-black/30 hover:scale-105'
                          }`}
                          title={p.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Hair Color */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-white/80 font-bold">Hair Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={currentAttrs.hair_color_hex || '#2C1B18'}
                          onChange={(e) =>
                            setCurrentAttrs((prev) => ({ ...prev, hair_color_hex: e.target.value }))
                          }
                          className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                        />
                        <span className="text-[11px] text-white/50">{currentAttrs.hair_color_hex}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {HAIR_PRESETS.map((p) => (
                        <button
                          key={p.hex}
                          type="button"
                          onClick={() => setCurrentAttrs((prev) => ({ ...prev, hair_color_hex: p.hex }))}
                          style={{ backgroundColor: p.hex }}
                          className={`w-6 h-6 rounded-full border cursor-pointer transition-transform ${
                            currentAttrs.hair_color_hex === p.hex
                              ? 'ring-2 ring-white scale-110 border-white'
                              : 'border-black/30 hover:scale-105'
                          }`}
                          title={p.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Eye Color */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-white/80 font-bold">Eye Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={currentAttrs.eye_color_hex || '#3D2314'}
                          onChange={(e) =>
                            setCurrentAttrs((prev) => ({ ...prev, eye_color_hex: e.target.value }))
                          }
                          className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                        />
                        <span className="text-[11px] text-white/50">{currentAttrs.eye_color_hex}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {EYE_PRESETS.map((p) => (
                        <button
                          key={p.hex}
                          type="button"
                          onClick={() => setCurrentAttrs((prev) => ({ ...prev, eye_color_hex: p.hex }))}
                          style={{ backgroundColor: p.hex }}
                          className={`w-6 h-6 rounded-full border cursor-pointer transition-transform ${
                            currentAttrs.eye_color_hex === p.hex
                              ? 'ring-2 ring-white scale-110 border-white'
                              : 'border-black/30 hover:scale-105'
                          }`}
                          title={p.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Lip Color */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-white/80 font-bold">Lip Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={currentAttrs.lip_color_hex || '#C87D7D'}
                          onChange={(e) =>
                            setCurrentAttrs((prev) => ({ ...prev, lip_color_hex: e.target.value }))
                          }
                          className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                        />
                        <span className="text-[11px] text-white/50">{currentAttrs.lip_color_hex}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {LIP_PRESETS.map((p) => (
                        <button
                          key={p.hex}
                          type="button"
                          onClick={() => setCurrentAttrs((prev) => ({ ...prev, lip_color_hex: p.hex }))}
                          style={{ backgroundColor: p.hex }}
                          className={`w-6 h-6 rounded-full border cursor-pointer transition-transform ${
                            currentAttrs.lip_color_hex === p.hex
                              ? 'ring-2 ring-white scale-110 border-white'
                              : 'border-black/30 hover:scale-105'
                          }`}
                          title={p.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Procedural 3D Glasses */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Glasses className="w-4 h-4 text-violet-400" />
                        <span className="text-xs font-mono font-bold text-white">Procedural 3D Glasses</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentAttrs((prev) => ({ ...prev, glasses: !prev.glasses }))
                        }
                        className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold transition-all cursor-pointer ${
                          currentAttrs.glasses
                            ? 'bg-violet-600 text-white'
                            : 'bg-white/10 text-white/50'
                        }`}
                      >
                        {currentAttrs.glasses ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    {currentAttrs.glasses && (
                      <div className="pt-2 border-t border-white/10 space-y-2 text-xs font-mono">
                        <span className="text-[11px] text-white/60 block">Frame Shape:</span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {GLASSES_SHAPES.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() =>
                                setCurrentAttrs((prev) => ({ ...prev, glasses_shape: s.id }))
                              }
                              className={`py-1 rounded-lg text-[10px] border transition-colors cursor-pointer ${
                                currentAttrs.glasses_shape === s.id
                                  ? 'bg-violet-500/20 border-violet-400 text-violet-300'
                                  : 'border-white/10 text-white/50 hover:bg-white/5'
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons: Confirm & Apply or Cancel */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3 mt-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-mono text-white/70 hover:text-white cursor-pointer transition-colors"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="px-3.5 py-2 rounded-xl border border-white/15 hover:bg-white/5 text-xs font-mono text-white/60 hover:text-white cursor-pointer transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAndSave}
                    className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-mono font-bold text-xs flex items-center gap-2 shadow-lg cursor-pointer transition-all"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm &amp; Apply</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
