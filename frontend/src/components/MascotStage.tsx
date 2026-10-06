import React, { Suspense, useState, useEffect, useRef } from 'react';
import { AvatarFallback2D } from './avatar/AvatarFallback2D';
import { detectFaceAndAttributes } from '../lib/avatar/faceLandmarkService';
import { avatar } from '../lib/avatar/avatarConfigService';
import { speechEngine } from '../lib/voice/speechEngine';
import { speechGateway } from '../lib/voice/speechGateway';
import { Camera, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { AvatarAppearanceAttributes } from '../lib/avatar/providers';

const VRMAvatarCanvas = React.lazy(() => import('./avatar/VRMAvatarCanvas'));

export type MascotGender = 'boy' | 'girl';
export type OutfitType =
  | 'yellow_tshirt'
  | 'hoodie'
  | 'formal'
  | 'kurta_saree'
  | 'sports'
  | 'pyjamas'
  | 'festive'
  | string;

export interface MascotStageProps {
  gender?: MascotGender;
  outfit?: OutfitType;
  emotion?: string;
  isSpeaking?: boolean;
  isUserTyping?: boolean;
  isThinking?: boolean;
  audioEnergy?: number;
  onOutfitChange?: (outfit: OutfitType) => void;
  onGenderChange?: (gender: MascotGender) => void;
  className?: string;
  prefer3D?: boolean;
  appearanceAttributes?: AvatarAppearanceAttributes | null;
  onOpenPhotoAvatar?: () => void;
}

// WebGL support detector
function isWebGLSupported(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

// React ErrorBoundary for WebGL failure recovery
class WebGLErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn('WebGL initialization/rendering failed, reverting to 2D avatar:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export const MascotStage: React.FC<MascotStageProps> = ({
  gender = 'boy',
  outfit: initialOutfit = 'yellow_tshirt',
  emotion = 'calm',
  isSpeaking = false,
  isUserTyping = false,
  isThinking = false,
  audioEnergy = 0,
  onOutfitChange,
  onGenderChange,
  className = '',
  prefer3D = true,
  appearanceAttributes,
  onOpenPhotoAvatar,
}) => {
  const [currentGender, setCurrentGender] = useState<MascotGender>(gender);
  const [activeOutfit, setActiveOutfit] = useState<OutfitType>(initialOutfit);
  const [showWardrobe, setShowWardrobe] = useState<boolean>(false);
  const [activeGesture, setActiveGesture] = useState<string>('idle');
  const [webGLAvailable, setWebGLAvailable] = useState<boolean>(true);

  // Sync prop gender
  useEffect(() => {
    setCurrentGender(gender);
  }, [gender]);

  const handleToggleGender = (newGender: MascotGender) => {
    speechEngine.stopSpeaking();
    speechGateway.stopSpeaking();
    setCurrentGender(newGender);
    onGenderChange?.(newGender);
  };

  // Photo personalization state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoSuccess, setPhotoSuccess] = useState<string | null>(null);

  useEffect(() => {
    setWebGLAvailable(isWebGLSupported());
  }, []);

  useEffect(() => {
    setActiveOutfit(initialOutfit);
  }, [initialOutfit]);

  // Wardrobe options for VRM clothing material swapper
  const outfits: Array<{ id: OutfitType; label: string }> = [
    { id: 'yellow_tshirt', label: 'BASE T-SHIRT' },
    { id: 'hoodie', label: 'PURPLE HOODIE' },
    { id: 'formal', label: 'NAVY FORMAL' },
    { id: 'kurta_saree', label: 'TEAL KURTA' },
    { id: 'sports', label: 'CRIMSON SPORTS' },
    { id: 'festive', label: 'GOLDEN FESTIVE' },
  ];

  // Base button: resets procedural arm rig, active gesture, and restores base clothing
  const handleResetBase = () => {
    setActiveGesture('base');
    setActiveOutfit('yellow_tshirt');
    onOutfitChange?.('yellow_tshirt');
    setShowWardrobe(false);
    setTimeout(() => {
      setActiveGesture('idle');
    }, 100);
  };

  // Wave button: triggers procedural arm rig wave animation with warm speech greeting
  const handleTriggerWave = () => {
    setActiveGesture('wave');
    try {
      let activeLang = 'en';
      try {
        const saved = localStorage.getItem('manas_twin_profile');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.language) activeLang = parsed.language;
        }
      } catch (_) {}

      const GREETINGS: Record<string, string> = {
        en: 'Hey there! I am right here with you.',
        hi: 'नमस्ते! मैं हमेशा आपके साथ हूँ।',
        ta: 'வணக்கம்! நான் உங்க கூடவே இருக்கேன்.',
        te: 'నమస్కారం! నేను మీతోనే ఉన్నాను.',
        kn: 'ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಜೊತೆಯಲ್ಲೇ ಇದ್ದೇನೆ.',
        ml: 'നമസ്കാരം! ഞാൻ നിങ്ങളുടെ കൂടെയുണ്ട്.',
        bn: 'নমস্কার! আমি সবসময় আপনার সাথে আছি।',
        mr: 'नमस्कार! मी नेहमी तुमच्या सोबत आहे.',
      };

      const text = GREETINGS[activeLang] || GREETINGS.en;
      speechGateway.speak({
        text,
        lang: activeLang,
        gender: gender === 'girl' ? 'girl' : 'boy',
        purpose: 'mascot_greeting',
      });
    } catch (_) {}
  };

  // Photo personalization handler with clarity validation
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError(null);
    setPhotoSuccess(null);
    setIsAnalyzingPhoto(true);

    try {
      const result = await detectFaceAndAttributes(file);
      avatar.applyConfig({
        colors: {
          skin: result.detectedSkin,
          hair: result.detectedHair,
        },
      });
      setPhotoSuccess('Personalized twin avatar updated from your photo! ✨');
      setTimeout(() => setPhotoSuccess(null), 5000);
    } catch (err: any) {
      setPhotoError(
        err.message || 'The photo is not clear or blurry. Please upload a clear, front-facing portrait.'
      );
      setTimeout(() => setPhotoError(null), 7000);
    } finally {
      setIsAnalyzingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectOutfit = (newOutfit: OutfitType) => {
    setActiveOutfit(newOutfit);
    onOutfitChange?.(newOutfit);
    setShowWardrobe(false);
  };

  const fallbackView = (
    <AvatarFallback2D
      gender={gender}
      emotion={emotion}
      isSpeaking={isSpeaking}
    />
  );

  return (
    <div
      className={`relative w-full h-full flex flex-col justify-between items-center bg-[#FDFBF7] text-[#0A0A0A] overflow-hidden select-none ${className}`}
    >
      {/* Huge Faint Editorial Wordmark Behind Mascot */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <span className="text-[clamp(48px,9vw,110px)] font-black uppercase tracking-[-0.04em] text-[#0A0A0A] opacity-[0.04] leading-none whitespace-nowrap">
          MANAS
        </span>
      </div>

      {/* TOP STATUS BAR: Digital Twin & Status Badges */}
      <div className="relative z-20 w-full pt-3 px-4 flex justify-between items-center text-xs shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Interactive Mascot Boy / Girl Switcher */}
          <div className="inline-flex items-center p-0.5 rounded-full bg-[#0A0A0A]/5 border border-[#0A0A0A]/10 shadow-xs">
            <button
              type="button"
              onClick={() => handleToggleGender('boy')}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold transition-all cursor-pointer ${
                currentGender === 'boy'
                  ? 'bg-[#0A0A0A] text-white shadow-xs'
                  : 'text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
              }`}
              title="Switch to Boy Mascot (Aarav)"
            >
              Boy (Aarav)
            </button>
            <button
              type="button"
              onClick={() => handleToggleGender('girl')}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold transition-all cursor-pointer ${
                currentGender === 'girl'
                  ? 'bg-[#0A0A0A] text-white shadow-xs'
                  : 'text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
              }`}
              title="Switch to Girl Mascot (Ananya)"
            >
              Girl (Ananya)
            </button>
          </div>

          {isThinking && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-mono font-medium animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              Thinking
            </span>
          )}
          {isSpeaking && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 text-[10px] font-mono font-medium animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
              Speaking
            </span>
          )}
          {isUserTyping && !isSpeaking && !isThinking && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 text-[10px] font-mono font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              Listening
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#0A0A0A]/40 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          <span>Adaptive 3D Character</span>
        </div>
      </div>

      {/* MAIN 3D AVATAR STAGE CONTAINER */}
      <div className="relative z-10 w-full flex-1 flex items-center justify-center min-h-[340px]">
        {prefer3D && webGLAvailable ? (
          <WebGLErrorBoundary fallback={fallbackView}>
            <Suspense fallback={fallbackView}>
              <VRMAvatarCanvas
                gender={currentGender}
                outfit={activeOutfit}
                emotion={emotion}
                gesture={activeGesture}
                isSpeaking={isSpeaking}
                isUserTyping={isUserTyping}
                isThinking={isThinking}
                audioEnergy={audioEnergy}
                appearanceAttributes={appearanceAttributes}
                onWaveEnd={() => setActiveGesture('idle')}
                onError={() => setWebGLAvailable(false)}
              />
            </Suspense>
          </WebGLErrorBoundary>
        ) : (
          fallbackView
        )}
      </div>

      {/* BOTTOM CONTROLS TOOLBAR: BASE / WAVE / OUTFITS */}
      <div className="relative z-20 w-full px-4 pb-5 pt-2 flex flex-col items-center gap-2.5 shrink-0">
        {/* Compact Mono Toolbar (Base / Wave / Photo) */}
        <div className="inline-flex items-center gap-1.5 bg-[#FFFFFF]/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#0A0A0A]/10 shadow-sm">
          {/* Base Reset Button */}
          <button
            type="button"
            onClick={handleResetBase}
            className="px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider hover:bg-[#F2EFE8] text-[#0A0A0A] transition-colors cursor-pointer"
            title="Reset avatar to base pose and natural clothing"
          >
            BASE
          </button>
          <span className="opacity-20 text-xs">/</span>

          {/* Wave Animation Button */}
          <button
            type="button"
            onClick={handleTriggerWave}
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider transition-colors cursor-pointer ${
              activeGesture === 'wave'
                ? 'bg-[#0A0A0A] text-[#FFFFFF] font-bold'
                : 'hover:bg-[#F2EFE8] text-[#0A0A0A]'
            }`}
            title="Play wave greeting animation"
          >
            WAVE
          </button>
          <span className="opacity-20 text-xs">/</span>

          {/* Photo Personalization Button */}
          <button
            type="button"
            disabled={isAnalyzingPhoto}
            onClick={() => {
              if (onOpenPhotoAvatar) {
                onOpenPhotoAvatar();
              } else {
                fileInputRef.current?.click();
              }
            }}
            className="px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors cursor-pointer flex items-center gap-1 font-semibold"
            title="Open Avatar Studio to personalize your twin avatar from photo or camera"
          >
            {isAnalyzingPhoto ? (
              <Loader2 className="w-3 h-3 animate-spin text-violet-600" />
            ) : (
              <Camera className="w-3 h-3 text-violet-600" />
            )}
            <span>PHOTO</span>
          </button>
        </div>

        {/* Hidden File Input for Photo Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoSelect}
        />

        {/* Photo Clarity Error Alert */}
        {photoError && (
          <div className="w-full max-w-[360px] p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-sans flex items-start gap-2 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-tight">{photoError}</span>
          </div>
        )}

        {/* Photo Personalization Success Alert */}
        {photoSuccess && (
          <div className="w-full max-w-[360px] p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono flex items-center gap-2 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="leading-tight">{photoSuccess}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MascotStage;
