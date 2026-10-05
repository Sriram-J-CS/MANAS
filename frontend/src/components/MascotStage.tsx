import React, { Suspense, useState, useEffect } from 'react';
import { AvatarFallback2D } from './avatar/AvatarFallback2D';

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
  className?: string;
  prefer3D?: boolean;
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
  className = '',
  prefer3D = true,
}) => {
  const [activeOutfit, setActiveOutfit] = useState<OutfitType>(initialOutfit);
  const [showWardrobe, setShowWardrobe] = useState<boolean>(false);
  const [activeGesture, setActiveGesture] = useState<string>('idle');
  const [webGLAvailable, setWebGLAvailable] = useState<boolean>(true);

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

  // Wave button: triggers procedural arm rig wave animation
  const handleTriggerWave = () => {
    setActiveGesture('wave');
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
      <div className="relative z-20 w-full pt-3 px-4 flex justify-between items-center text-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-wider text-[#0A0A0A]/60 uppercase font-semibold">
            Digital Twin: {gender === 'girl' ? 'Ananya' : 'Aarav'}
          </span>
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
          <span>Rigged 3D VRM</span>
        </div>
      </div>

      {/* MAIN 3D AVATAR STAGE CONTAINER */}
      <div className="relative z-10 w-full flex-1 flex items-center justify-center min-h-[340px]">
        {prefer3D && webGLAvailable ? (
          <WebGLErrorBoundary fallback={fallbackView}>
            <Suspense fallback={fallbackView}>
              <VRMAvatarCanvas
                gender={gender}
                outfit={activeOutfit}
                emotion={emotion}
                gesture={activeGesture}
                isSpeaking={isSpeaking}
                isUserTyping={isUserTyping}
                isThinking={isThinking}
                audioEnergy={audioEnergy}
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
        {/* Wardrobe Quick Selector Popup */}
        {showWardrobe && (
          <div className="w-full max-w-[340px] bg-[#FFFFFF] border border-[#0A0A0A]/15 shadow-xl rounded-2xl p-2.5 grid grid-cols-2 sm:grid-cols-3 gap-1.5 animate-in fade-in zoom-in-95 duration-150">
            {outfits.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => handleSelectOutfit(o.id)}
                className={`py-1.5 px-2 rounded-xl text-[10px] font-mono tracking-wider transition-all cursor-pointer ${
                  activeOutfit === o.id
                    ? 'bg-[#0A0A0A] text-[#FFFFFF] font-bold'
                    : 'bg-[#F4F2EB] text-[#0A0A0A] hover:bg-[#EBE7DC]'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        {/* Compact Mono Toolbar (Base / Wave / Outfits) */}
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

          {/* Wardrobe Outfits Selector */}
          <button
            type="button"
            onClick={() => setShowWardrobe(!showWardrobe)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider border border-[#0A0A0A]/20 transition-colors cursor-pointer ${
              showWardrobe
                ? 'bg-[#0A0A0A] text-[#FFFFFF] font-bold'
                : 'hover:bg-[#F2EFE8] text-[#0A0A0A]'
            }`}
            title="Swap clothing materials and colors"
          >
            OUTFITS
          </button>
        </div>
      </div>
    </div>
  );
};

export default MascotStage;
