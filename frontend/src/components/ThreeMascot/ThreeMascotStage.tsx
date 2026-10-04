import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Wind, Hand, Shirt } from 'lucide-react';
import { ThreeCartoonMascot, type OutfitType, type MascotCustomAttributes } from './ThreeCartoonMascot';
import { Mascot2DFallback } from './Mascot2DFallback';
import { WardrobeDrawer } from './WardrobeDrawer';
import { useMascotAudioLipSync } from './useMascotAudioLipSync';
import type { MascotExpression } from '../../types';

interface ThreeMascotStageProps {
  gender?: 'boy' | 'girl';
  outfit?: OutfitType;
  expression?: MascotExpression;
  isSpeaking?: boolean;
  isUserTyping?: boolean;
  attributes?: MascotCustomAttributes;
  onOutfitChange?: (newOutfit: OutfitType) => void;
  className?: string;
}

export const ThreeMascotStage: React.FC<ThreeMascotStageProps> = ({
  gender = 'boy',
  outfit: initialOutfit = 'hoodie',
  expression = 'neutral',
  isSpeaking = false,
  isUserTyping = false,
  attributes = {},
  onOutfitChange,
  className = '',
}) => {
  const [currentOutfit, setCurrentOutfit] = useState<OutfitType>(initialOutfit);
  const [isWardrobeOpen, setIsWardrobeOpen] = useState<boolean>(false);
  const [cameraView, setCameraView] = useState<'bust' | 'full_body'>('bust');
  const [activeReaction, setActiveReaction] = useState<'idle' | 'nod' | 'breathe' | 'encourage' | 'wave'>('idle');
  const [hasWebGL, setHasWebGL] = useState<boolean>(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  // Lip-sync driver
  const { isMuted, audioEnergy, toggleMute } = useMascotAudioLipSync();

  // Detect WebGL capability and reduced motion preferences
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setHasWebGL(Boolean(gl));
    } catch {
      setHasWebGL(false);
    }

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(motionQuery.matches);

    const handleMotionChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    motionQuery.addEventListener('change', handleMotionChange);
    return () => motionQuery.removeEventListener('change', handleMotionChange);
  }, []);

  const handleSelectOutfit = (newOutfit: OutfitType) => {
    setCurrentOutfit(newOutfit);
    onOutfitChange?.(newOutfit);
    // Call server API route to persist wardrobe in DB
    fetch('/api/avatar/wardrobe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        avatar_type: gender,
        outfit: newOutfit,
        attributes,
      }),
    }).catch((err) => console.warn('Wardrobe sync failed:', err));
  };

  const triggerReaction = (reaction: 'nod' | 'breathe' | 'encourage' | 'wave') => {
    setActiveReaction(reaction);
    if (reaction !== 'breathe') {
      setTimeout(() => setActiveReaction('idle'), 2400);
    }
  };

  return (
    <div className={`relative w-full flex flex-col items-center justify-between rounded-3xl bg-radial from-neutral-900 via-black to-black border border-white/15 overflow-hidden shadow-2xl ${className}`}>
      {/* Top Header Status & Audio Controls */}
      <div className="w-full flex items-center justify-between px-4 py-3 z-10 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-[11px] font-mono uppercase tracking-widest text-white/80 font-bold">
            3D Companion
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            {gender === 'girl' ? 'Girl' : 'Boy'} · {currentOutfit}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Camera View Toggle: Bust vs Full Body */}
          <button
            onClick={() => setCameraView((prev) => (prev === 'bust' ? 'full_body' : 'bust'))}
            className="px-2.5 py-1 rounded-full border border-white/20 bg-white/5 text-white/80 hover:bg-white/15 text-[10px] font-mono transition-all cursor-pointer"
            title="Toggle between bust portrait and full body view"
          >
            {cameraView === 'bust' ? 'Full Body ↕' : 'Bust View 🔍'}
          </button>

          {/* Mute / Unmute Toggle */}
          <button
            onClick={toggleMute}
            className="p-1.5 rounded-full border border-white/20 bg-white/5 text-white/80 hover:bg-white/15 transition-all cursor-pointer"
            title={isMuted ? 'Unmute Mascot Voice' : 'Mute Mascot Voice'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Avatar Canvas / Fallback Area */}
      <div className="relative w-full flex-1 flex items-center justify-center min-h-[320px] sm:min-h-[360px]">
        {hasWebGL && !prefersReducedMotion ? (
          <ThreeCartoonMascot
            gender={gender}
            outfit={currentOutfit}
            expression={expression}
            isSpeaking={isSpeaking}
            isUserTyping={isUserTyping}
            isGuidedBreathing={activeReaction === 'breathe'}
            activeReaction={activeReaction}
            cameraView={cameraView}
            audioEnergy={audioEnergy}
            attributes={attributes}
            onWaveComplete={() => setActiveReaction('idle')}
            className="w-full h-full"
          />
        ) : (
          <Mascot2DFallback
            gender={gender}
            outfit={currentOutfit}
            expression={expression}
            isSpeaking={isSpeaking}
            isUserTyping={isUserTyping}
            isGuidedBreathing={activeReaction === 'breathe'}
            attributes={attributes}
            className="w-full h-full"
          />
        )}
      </div>

      {/* Interactive Bottom Control Toolbar: Reactions & Wardrobe */}
      <div className="w-full flex items-center justify-center flex-wrap gap-1.5 px-3 py-2.5 z-10 border-t border-white/10 bg-black/60 backdrop-blur-md">
        <button
          onClick={() => triggerReaction('nod')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-xs font-mono transition-all cursor-pointer ${
            activeReaction === 'nod'
              ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 font-bold'
              : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/15'
          }`}
          title="Reassuring nod"
        >
          <span>Nod</span>
        </button>

        <button
          onClick={() => {
            if (activeReaction === 'breathe') {
              setActiveReaction('idle');
            } else {
              triggerReaction('breathe');
            }
          }}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-xs font-mono transition-all cursor-pointer ${
            activeReaction === 'breathe'
              ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 font-bold'
              : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/15'
          }`}
          title="Guided breathing"
        >
          <Wind className="w-3.5 h-3.5 text-emerald-400" />
          <span>Breathe</span>
        </button>

        <button
          onClick={() => triggerReaction('encourage')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-xs font-mono transition-all cursor-pointer ${
            activeReaction === 'encourage'
              ? 'border-amber-400 bg-amber-500/20 text-amber-300 font-bold'
              : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/15'
          }`}
          title="Encourage / Thumbs up"
        >
          <span>Encourage</span>
        </button>

        <button
          onClick={() => triggerReaction('wave')}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-white/15 bg-white/5 text-white/80 hover:bg-white/15 text-xs font-mono transition-all cursor-pointer"
          title="Wave hello"
        >
          <Hand className="w-3.5 h-3.5 text-amber-400" />
          <span>Wave</span>
        </button>

        <button
          onClick={() => setIsWardrobeOpen((prev) => !prev)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-cyan-400/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 text-xs font-mono transition-all cursor-pointer"
          title="Change Outfit"
        >
          <Shirt className="w-3.5 h-3.5 text-cyan-400" />
          <span>Outfits</span>
        </button>
      </div>

      {/* Wardrobe Drawer Modal */}
      <WardrobeDrawer
        isOpen={isWardrobeOpen}
        currentOutfit={currentOutfit}
        onSelectOutfit={handleSelectOutfit}
        onClose={() => setIsWardrobeOpen(false)}
      />
    </div>
  );
};
