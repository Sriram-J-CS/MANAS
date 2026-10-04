import React, { useState } from 'react';
import { Activity, Heart, Wind, Hand } from 'lucide-react';
import type { MascotExpression } from '../types';
import { RealMascot, type MascotTheme } from './RealMascot';
import { ThreeMascotStage } from './ThreeMascot/ThreeMascotStage';
import type { OutfitType, MascotCustomAttributes } from './ThreeMascot/ThreeCartoonMascot';

interface InteractiveAvatarProps {
  avatarUrl?: string;
  isSpeaking: boolean;
  expression: MascotExpression;
  avatarType?: MascotTheme | string;
  userName?: string;
  isCustomAvatar?: boolean;
  onGestureTrigger?: (gesture: string) => void;
  compact?: boolean;
  isUserTyping?: boolean;
  outfit?: OutfitType;
  onOutfitChange?: (newOutfit: OutfitType) => void;
  attributes?: MascotCustomAttributes;
}

export const InteractiveAvatar: React.FC<InteractiveAvatarProps> = ({
  isSpeaking,
  expression,
  avatarType = 'cyber_manas',
  userName = 'Friend',
  onGestureTrigger,
  compact = false,
  isUserTyping = false,
  outfit = 'hoodie',
  onOutfitChange,
  attributes = {},
}) => {
  const [activeGesture, setActiveGesture] = useState<string>('idle');

  const handleGesture = (gesture: string) => {
    setActiveGesture(gesture);
    onGestureTrigger?.(gesture);
    setTimeout(() => setActiveGesture('idle'), 2400);
  };

  // Expression styling
  const moodHalo =
    expression === 'concerned'
      ? 'from-amber-500/25 via-rose-500/15 to-transparent border-amber-500/40'
      : expression === 'happy'
      ? 'from-emerald-400/30 via-teal-500/15 to-transparent border-emerald-400/40'
      : 'from-cyan-500/25 via-blue-500/15 to-transparent border-cyan-400/40';

  const expressionLabel =
    expression === 'concerned'
      ? 'Empathetic & Attentive'
      : expression === 'happy'
      ? 'Encouraging & Proud'
      : 'Calm & Grounding';

  const themeName =
    avatarType === 'zen_sage'
      ? 'Zen Sage Mascot'
      : avatarType === 'aura_cloud'
      ? 'Aura Cloud Mascot'
      : avatarType === 'solar_nova'
      ? 'Solar Nova Mascot'
      : 'Cyber MANAS Mascot';

  const [stageViewMode, setStageViewMode] = useState<'3d_rig' | 'visor_spirit'>('3d_rig');

  if (compact) {
    return (
      <div className="relative flex items-center gap-3 select-none">
        <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
          <RealMascot
            size="sm"
            avatarType={avatarType}
            expression={expression}
            isSpeaking={isSpeaking}
            interactive={false}
          />
        </div>
        <div className="text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white font-mono uppercase">
              {userName}'s Mascot Twin
            </span>
            {isSpeaking && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>
          <span className="text-[10px] font-mono text-white/50 block">
            {expressionLabel}
          </span>
        </div>
      </div>
    );
  }

  // Map avatarType to 3D gender
  const mascotGender: 'boy' | 'girl' =
    avatarType === 'girl' || avatarType === 'zen_sage' || avatarType === 'aura_cloud' ? 'girl' : 'boy';

  return (
    <div className="flex flex-col items-center justify-between h-full w-full p-3 sm:p-4 bg-gradient-to-b from-[#0a0f18] via-[#05070c] to-[#000000] text-white select-none relative overflow-hidden rounded-3xl">
      {/* Top Header Mode Toggle */}
      <div className="w-full flex items-center justify-between z-10 shrink-0 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-white/80">
            {stageViewMode === '3d_rig' ? '3D Cartoon Mascot' : themeName}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setStageViewMode('3d_rig')}
            className={`text-[10px] font-mono px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
              stageViewMode === '3d_rig'
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 font-bold'
                : 'border-white/10 text-white/60 hover:text-white'
            }`}
          >
            3D Rig
          </button>
          <button
            onClick={() => setStageViewMode('visor_spirit')}
            className={`text-[10px] font-mono px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
              stageViewMode === 'visor_spirit'
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 font-bold'
                : 'border-white/10 text-white/60 hover:text-white'
            }`}
          >
            Spirit
          </button>
        </div>
      </div>

      {/* Render 3D Mascot Stage or Visor Spirit */}
      {stageViewMode === '3d_rig' ? (
        <ThreeMascotStage
          gender={mascotGender}
          outfit={outfit || 'hoodie'}
          expression={expression}
          isSpeaking={isSpeaking}
          isUserTyping={isUserTyping}
          attributes={attributes}
          onOutfitChange={onOutfitChange}
          className="w-full h-full flex-1"
        />
      ) : (
        <div className="relative w-full flex-1 flex flex-col items-center justify-center">
          {/* Dynamic Ambient Glow Behind Mascot */}
          <div
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-gradient-to-tr ${moodHalo} blur-3xl pointer-events-none transition-all duration-700 opacity-60`}
          />

          <div
            className={`transition-transform duration-500 z-10 ${
              activeGesture === 'nod'
                ? 'animate-[mascotNod_1.2s_ease-in-out]'
                : activeGesture === 'breathe'
                ? 'animate-[mascotDeepBreathe_3.2s_ease-in-out]'
                : ''
            }`}
          >
            <RealMascot
              size="lg"
              avatarType={avatarType}
              expression={expression}
              isSpeaking={isSpeaking}
              interactive={true}
            />
          </div>

          {/* Status Indicator */}
          <div className="mt-3 text-center z-10">
            <h4 className="text-base font-bold text-white tracking-tight flex items-center justify-center gap-2">
              <span>{userName}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 font-mono text-cyan-300 font-normal">
                Digital Twin
              </span>
            </h4>
            <p className="text-xs font-mono text-white/60 mt-1 flex items-center justify-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>State: {expressionLabel}</span>
            </p>
          </div>

          {/* Gestures */}
          <div className="w-full flex items-center justify-center gap-2 pt-3 border-t border-white/10 z-10 mt-3">
            <button
              onClick={() => handleGesture('wave')}
              className="px-3 py-1.5 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 text-[11px] font-mono text-white/80 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Hand className="w-3 h-3 text-cyan-300" />
              <span>Wave</span>
            </button>
            <button
              onClick={() => handleGesture('breathe')}
              className="px-3 py-1.5 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 text-[11px] font-mono text-white/80 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Wind className="w-3 h-3 text-emerald-300" />
              <span>Breathe</span>
            </button>
            <button
              onClick={() => handleGesture('nod')}
              className="px-3 py-1.5 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 text-[11px] font-mono text-white/80 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Heart className="w-3 h-3 text-pink-300" />
              <span>Reflect</span>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes mascotNod {
          0%, 100% { transform: translateY(0); }
          30% { transform: translateY(8px); }
          60% { transform: translateY(0); }
          80% { transform: translateY(4px); }
        }
        @keyframes mascotDeepBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08) translateY(-6px); }
        }
      `}</style>
    </div>
  );
};
