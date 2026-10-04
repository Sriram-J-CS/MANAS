import React, { useEffect, useRef, useState } from 'react';
import { Model3DRenderer } from '../lib/avatar/Model3DRenderer';
import { SpriteRigRenderer } from '../lib/avatar/SpriteRigRenderer';
import type {
  AvatarRenderer,
  MascotEmotion,
  MascotGesture,
  OutfitType,
  MascotGender,
} from '../lib/avatar/AvatarRenderer';

interface MascotStageProps {
  gender?: MascotGender;
  outfit?: OutfitType;
  emotion?: MascotEmotion;
  isSpeaking?: boolean;
  isUserTyping?: boolean;
  audioEnergy?: number;
  onOutfitChange?: (outfit: OutfitType) => void;
  className?: string;
  prefer3D?: boolean;
}

export const MascotStage: React.FC<MascotStageProps> = ({
  gender = 'boy',
  outfit: initialOutfit = 'yellow_tshirt',
  emotion = 'neutral',
  isSpeaking = false,
  isUserTyping = false,
  audioEnergy = 0,
  onOutfitChange,
  className = '',
  prefer3D = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<AvatarRenderer | null>(null);

  const [activeOutfit, setActiveOutfit] = useState<OutfitType>(initialOutfit);
  const [showWardrobe, setShowWardrobe] = useState<boolean>(false);
  const [activeGesture, setActiveGesture] = useState<MascotGesture>('idle');
  const [use3DMode, setUse3DMode] = useState<boolean>(prefer3D);

  // Available wardrobe outfits
  const outfits: Array<{ id: OutfitType; label: string }> = [
    { id: 'yellow_tshirt', label: 'T-SHIRT' },
    { id: 'hoodie', label: 'HOODIE' },
    { id: 'formal', label: 'FORMAL' },
    { id: 'kurta_saree', label: 'KURTA' },
    { id: 'sports', label: 'SPORTS' },
    { id: 'pyjamas', label: 'PYJAMAS' },
    { id: 'festive', label: 'FESTIVE' },
  ];

  // Initialize AvatarRenderer (Model3DRenderer if prefer3D is true, else SpriteRigRenderer)
  useEffect(() => {
    if (!containerRef.current) return;

    const renderer: AvatarRenderer = use3DMode
      ? new Model3DRenderer()
      : new SpriteRigRenderer();
      
    rendererRef.current = renderer;

    renderer.init(containerRef.current, {
      gender,
      outfit: activeOutfit,
      enableTilt: true,
    });

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [gender, use3DMode]);

  // Synchronize emotion
  useEffect(() => {
    rendererRef.current?.setEmotion(emotion, 150);
  }, [emotion]);

  // Synchronize speaking state and energy
  useEffect(() => {
    rendererRef.current?.setIsSpeaking(isSpeaking);
    if (isSpeaking && audioEnergy > 0) {
      // Synthetic spectral centroid for natural phonetic variation
      const spectral = 0.3 + (audioEnergy * 0.7);
      rendererRef.current?.onAudioFrame(audioEnergy, spectral);
    }
  }, [isSpeaking, audioEnergy]);

  // Synchronize listening pose when user types
  useEffect(() => {
    rendererRef.current?.setIsListening(isUserTyping);
  }, [isUserTyping]);

  // Synchronize outfit change
  useEffect(() => {
    rendererRef.current?.setOutfit(activeOutfit);
  }, [activeOutfit]);

  // Mouse move handler for 3D perspective tilt
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    rendererRef.current?.onUserGaze(nx, ny);
  };

  const handleMouseLeave = () => {
    rendererRef.current?.onUserGaze(0, 0);
  };

  const triggerGesture = (gesture: MascotGesture) => {
    setActiveGesture(gesture);
    rendererRef.current?.setGesture(gesture);
    setTimeout(() => {
      setActiveGesture('idle');
    }, 2800);
  };

  const selectOutfit = (newOutfit: OutfitType) => {
    setActiveOutfit(newOutfit);
    rendererRef.current?.setOutfit(newOutfit);
    onOutfitChange?.(newOutfit);
    setShowWardrobe(false);
  };

  return (
    <div
      className={`relative w-full h-full flex flex-col justify-between items-center bg-[#FDFBF7] text-[#0A0A0A] overflow-hidden select-none ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Huge Faint Editorial Wordmark Behind Mascot */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <span className="text-[clamp(48px,9vw,110px)] font-black uppercase tracking-[-0.04em] text-[#0A0A0A] opacity-[0.04] leading-none whitespace-nowrap">
          MANAS
        </span>
      </div>

      {/* Renderer Mode Badge & Switch */}
      <div className="relative z-20 w-full pt-3 px-4 flex justify-between items-center text-xs">
        <span className="font-mono text-[10px] tracking-wider text-[#0A0A0A]/50 uppercase">
          Stage: {gender === 'girl' ? 'Ananya' : 'Aarav'}
        </span>
        <button
          type="button"
          onClick={() => setUse3DMode(!use3DMode)}
          className="px-2.5 py-1 rounded-full border border-[#0A0A0A]/15 bg-[#FFFFFF]/80 hover:bg-[#0A0A0A] hover:text-white transition-all text-[10px] font-mono tracking-wider shadow-xs cursor-pointer"
          title="Toggle between 3D ARKit Rig and 2D Expression Pack"
        >
          {use3DMode ? '● 3D GLB (ARKit)' : '○ 2D Rig'}
        </button>
      </div>

      {/* Main Avatar Stage Container */}
      <div
        ref={containerRef}
        className="relative z-10 w-full flex-1 flex items-center justify-center min-h-[340px]"
      />

      {/* Compact Mono Toolbar Under Mascot (Nod / Breathe / Encourage / Wave / Outfits) */}
      <div className="relative z-20 w-full px-4 pb-5 pt-2 flex flex-col items-center gap-2.5">
        {/* Wardrobe Quick Selector Popup */}
        {showWardrobe && (
          <div className="w-full max-w-[340px] bg-[#FFFFFF] border border-[#0A0A0A]/15 shadow-xl rounded-2xl p-2.5 grid grid-cols-3 gap-1.5 animate-in fade-in zoom-in-95 duration-150">
            {outfits.map((o) => (
              <button
                key={o.id}
                onClick={() => selectOutfit(o.id)}
                className={`py-1.5 px-2 rounded-xl text-[10px] font-mono tracking-wider transition-all ${
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

        <div className="inline-flex items-center gap-1.5 bg-[#FFFFFF]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#0A0A0A]/10 shadow-sm">
          <button
            onClick={() => triggerGesture('nod')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider transition-colors ${
              activeGesture === 'nod' ? 'bg-[#0A0A0A] text-[#FFFFFF]' : 'hover:bg-[#F2EFE8]'
            }`}
          >
            NOD
          </button>
          <span className="opacity-20 text-xs">/</span>
          <button
            onClick={() => triggerGesture('breathe')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider transition-colors ${
              activeGesture === 'breathe' ? 'bg-[#8B5CF6] text-[#FFFFFF]' : 'hover:bg-[#F2EFE8]'
            }`}
          >
            BREATHE
          </button>
          <span className="opacity-20 text-xs">/</span>
          <button
            onClick={() => triggerGesture('thumbs_up')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider transition-colors ${
              activeGesture === 'thumbs_up' ? 'bg-[#0A0A0A] text-[#FFFFFF]' : 'hover:bg-[#F2EFE8]'
            }`}
          >
            ENCOURAGE
          </button>
          <span className="opacity-20 text-xs">/</span>
          <button
            onClick={() => triggerGesture('wave')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider transition-colors ${
              activeGesture === 'wave' ? 'bg-[#0A0A0A] text-[#FFFFFF]' : 'hover:bg-[#F2EFE8]'
            }`}
          >
            WAVE
          </button>
          <span className="opacity-20 text-xs">/</span>
          <button
            onClick={() => setShowWardrobe(!showWardrobe)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider border border-[#0A0A0A]/20 transition-colors ${
              showWardrobe ? 'bg-[#0A0A0A] text-[#FFFFFF]' : 'hover:bg-[#F2EFE8]'
            }`}
          >
            OUTFITS
          </button>
        </div>
      </div>
    </div>
  );
};
