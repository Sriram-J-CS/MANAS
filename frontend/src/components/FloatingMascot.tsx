import React, { useState, useEffect } from 'react';
import { MessageSquare, ArrowLeftRight, Settings, X, Sparkles } from 'lucide-react';
import type { UserProfile } from './OnboardingModal';
import { RealMascot } from './RealMascot';

interface FloatingMascotProps {
  userProfile: UserProfile;
  onOpenChat: () => void;
  onOpenSettings: () => void;
  position?: 'left' | 'right';
  onTogglePosition?: () => void;
  onCloseMascot?: () => void;
  enabled?: boolean;
}

export const FloatingMascot: React.FC<FloatingMascotProps> = ({
  userProfile,
  onOpenChat,
  onOpenSettings,
  position = 'right',
  onTogglePosition,
  onCloseMascot,
  enabled = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [bubbleText, setBubbleText] = useState<string>('');
  const [showBubble, setShowBubble] = useState(true);

  // Real mascot theme persona
  const mascotTheme = userProfile.avatarType || 'cyber_manas';

  // Periodic supportive thoughts from the Digital Twin mascot
  useEffect(() => {
    const messages = [
      `Hey ${userProfile.name}, remember to unclench your jaw.`,
      "Take one deep breath with me.",
      "How is your heart feeling right now?",
      "I'm right here whenever you need to talk.",
      "You don't have to carry it all today.",
    ];

    setBubbleText(messages[0]);
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % messages.length;
      setBubbleText(messages[index]);
      setShowBubble(true);
    }, 12000);

    return () => clearInterval(interval);
  }, [userProfile.name]);

  if (!enabled) return null;

  return (
    <aside
      aria-label="Interactive AI Digital Twin Companion"
      className={`fixed bottom-6 z-40 flex items-end gap-3 transition-all duration-500 select-none ${
        position === 'left' ? 'left-6 flex-row' : 'right-6 flex-row-reverse'
      }`}
    >
      {/* Interactive Speech Bubble */}
      {showBubble && (
        <div
          onClick={onOpenChat}
          className={`max-w-[210px] p-3 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/20 text-white shadow-2xl cursor-pointer hover:border-cyan-400 transition-all duration-300 animate-in fade-in zoom-in-95 group ${
            position === 'left' ? 'text-left' : 'text-right'
          }`}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-300 uppercase font-bold mb-1">
            <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>{userProfile.name}'s Twin</span>
          </div>
          <p className="text-xs text-white/90 leading-snug group-hover:text-cyan-200">
            {bubbleText}
          </p>
          <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-white/50 pt-1 border-t border-white/10">
            <span className="group-hover:text-white flex items-center gap-1">
              <MessageSquare className="w-2.5 h-2.5" /> Tap to talk
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowBubble(false);
              }}
              className="hover:text-white"
              title="Dismiss thought"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Floating Real Animated Mascot Character */}
      <div
        className="relative group cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div onClick={onOpenChat}>
          <RealMascot
            size="sm"
            avatarType={mascotTheme}
            interactive={true}
          />
        </div>

        {/* Quick Action Floating Ribbon on Hover */}
        <div
          className={`absolute -top-10 ${
            position === 'left' ? 'left-0' : 'right-0'
          } flex items-center gap-1.5 bg-black/90 backdrop-blur-md px-2 py-1 rounded-full border border-white/20 shadow-lg transition-all duration-200 ${
            isHovered ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-1 pointer-events-none'
          }`}
        >
          {/* Switch Dock Side (Left / Right) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePosition?.();
            }}
            className="p-1 rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-colors"
            title={`Move mascot to ${position === 'left' ? 'Right' : 'Left'} side`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>

          {/* Quick Settings */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
            className="p-1 rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-colors"
            title="Mascot & Avatar Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Hide Mascot */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCloseMascot?.();
            }}
            className="p-1 rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-colors"
            title="Turn off floating mascot"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating Keyframe Animation */}
      <style>{`
        @keyframes mascotFloat {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-8px) rotate(2deg);
          }
        }
      `}</style>
    </aside>
  );
};
