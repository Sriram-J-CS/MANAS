import React from 'react';
import { Wind, Heart, Hand, Sparkles, Sliders, Shirt } from 'lucide-react';
import type { MascotEmotion } from '../../lib/emotion/emotionEngine';
import type { AvatarGesture } from '../../lib/avatar/speechPerformance';

interface MascotControlsProps {
  onTriggerEmotion: (emotion: MascotEmotion) => void;
  onTriggerGesture?: (gesture: AvatarGesture) => void;
  onOpenBreathing?: () => void;
  onOpenCustomizer?: () => void;
  onOpenOutfits?: () => void;
  className?: string;
}

export const MascotControls: React.FC<MascotControlsProps> = ({
  onTriggerEmotion,
  onTriggerGesture,
  onOpenBreathing,
  onOpenCustomizer,
  onOpenOutfits,
  className = '',
}) => {
  return (
    <div
      className={`inline-flex items-center gap-1.5 bg-[#FFFFFF]/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#0A0A0A]/10 shadow-xs z-20 ${className}`}
    >
      <button
        type="button"
        onClick={() => {
          onTriggerEmotion('supportive' as MascotEmotion);
          onTriggerGesture?.('nod');
        }}
        className="px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider hover:bg-[#F2EFE8] text-[#0A0A0A] flex items-center gap-1 cursor-pointer transition-colors"
        title="Avatar gives a warm nod"
      >
        <Sparkles className="w-2.5 h-2.5 text-[#8B5CF6]" />
        NOD
      </button>

      <span className="opacity-20 text-xs">/</span>

      <button
        type="button"
        onClick={() => {
          onTriggerEmotion('calm');
          onTriggerGesture?.('breathing_guide');
          onOpenBreathing?.();
        }}
        className="px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider hover:bg-[#F2EFE8] text-[#8B5CF6] font-medium flex items-center gap-1 cursor-pointer transition-colors"
        title="Guided calm breathing loop"
      >
        <Wind className="w-2.5 h-2.5" />
        BREATHE
      </button>

      <span className="opacity-20 text-xs">/</span>

      <button
        type="button"
        onClick={() => {
          onTriggerEmotion('encouraging' as MascotEmotion);
          onTriggerGesture?.('thumbs_up');
        }}
        className="px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider hover:bg-[#F2EFE8] text-[#0A0A0A] flex items-center gap-1 cursor-pointer transition-colors"
        title="Avatar sends thumbs up encouragement"
      >
        <Heart className="w-2.5 h-2.5 text-rose-500" />
        ENCOURAGE
      </button>

      <span className="opacity-20 text-xs">/</span>

      <button
        type="button"
        onClick={() => {
          onTriggerEmotion('happy');
          onTriggerGesture?.('wave');
        }}
        className="px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider hover:bg-[#F2EFE8] text-[#0A0A0A] flex items-center gap-1 cursor-pointer transition-colors"
        title="Avatar waves friendly hello"
      >
        <Hand className="w-2.5 h-2.5 text-amber-500" />
        WAVE
      </button>

      {onOpenOutfits && (
        <>
          <span className="opacity-20 text-xs">/</span>
          <button
            type="button"
            onClick={onOpenOutfits}
            className="px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 text-[#8B5CF6] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            title="Wardrobe outfits & AI photo face personalization"
          >
            <Shirt className="w-2.5 h-2.5" />
            OUTFITS
          </button>
        </>
      )}

      {onOpenCustomizer && (
        <>
          <span className="opacity-20 text-xs">/</span>
          <button
            type="button"
            onClick={onOpenCustomizer}
            className="px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider bg-[#0A0A0A]/5 hover:bg-[#0A0A0A]/10 text-[#0A0A0A] font-medium flex items-center gap-1 cursor-pointer transition-colors"
            title="Upload or customize 3D mascot"
          >
            <Sliders className="w-2.5 h-2.5" />
            CUSTOMIZE
          </button>
        </>
      )}
    </div>
  );
};
