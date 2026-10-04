/**
 * MANAS MascotViewer
 * Renders the MANAS companion mascot avatar matching Sriram's exact Snapchat Bitmoji look:
 *   Boy  – dark spiky swept-up hair, soft pink hoodie, grey jeans, white sneakers, hands clasped
 *   Girl – space buns + dark & ombre burgundy hair, black top, white pleated skirt, black Converse
 *
 * Features:
 *   - High-fidelity 3D mascot render with soft ambient studio lighting
 *   - 3D parallax head & gaze tracking towards user's cursor
 *   - Organic idle breathing loop anchored at feet
 *   - Talking lip-sync animation & speech bounce
 *   - Attentive posture tilt when listening or thinking
 *   - Interactive reaction gestures (nod, wave, breathe, encourage)
 *   - Soft emotion glow halo
 *   - Instant Boy / Girl toggle switch
 *   - Graceful fallback to canvas Bitmoji portrait if custom asset is offline
 */

import React, { useRef, useState, useEffect } from 'react';
import { BitmojiPortrait, type BitmojiGender } from '../avatar/BitmojiPortrait';
import { getMascotConfig, type MascotBackground } from '../../lib/mascot/mascotConfig';
import { avatar, type AvatarConfig } from '../../lib/avatar/avatarConfigService';
import { getStoredMascotModel } from '../../lib/mascot/mascotModelStorage';
import type { CameraFraming } from '../avatar/Avatar3DStage';
import type { AvatarGesture } from '../../lib/avatar/speechPerformance';

interface MascotViewerProps {
  emotion?: string;
  isSpeaking?: boolean;
  isListening?: boolean;
  isThinking?: boolean;
  audioEnergy?: number;
  gender?: 'boy' | 'girl';
  framing?: CameraFraming;
  activeGesture?: AvatarGesture;
  className?: string;
  customModelUrl?: string | null;
  customModelType?: 'glb' | 'gltf' | 'fbx' | 'obj' | 'image' | null;
}

// Background palette (Snapchat dark mode default)
const BG_MAP: Record<MascotBackground, string> = {
  warm_cream:       '#121118',
  zen_sand:         '#171413',
  gentle_lavender:  '#15121e',
  soft_sage:        '#111713',
  clean_white:      '#121118',
};

// Emotion → ambient glow halo
function emotionGlow(emotion: string): string {
  switch (emotion) {
    case 'happy':
    case 'encouraging': return 'rgba(245, 195, 65, 0.28)';
    case 'warm_smile':
    case 'warm':        return 'rgba(235, 140, 110, 0.25)';
    case 'empathetic':
    case 'supportive':  return 'rgba(168, 130, 245, 0.26)';
    case 'sad':         return 'rgba(105, 150, 230, 0.22)';
    case 'concerned':
    case 'worried':     return 'rgba(235, 110, 95, 0.24)';
    case 'surprised':   return 'rgba(70, 225, 190, 0.25)';
    case 'thinking':    return 'rgba(190, 180, 240, 0.20)';
    case 'calm':
    default:            return 'rgba(150, 120, 230, 0.18)';
  }
}

export const MascotViewer: React.FC<MascotViewerProps> = ({
  emotion = 'calm',
  isSpeaking = false,
  isListening = false,
  isThinking = false,
  audioEnergy = 0,
  gender: propGender = 'boy',
  framing = 'bust',
  activeGesture,
  className = '',
  customModelUrl: propModelUrl = null,
  customModelType: propModelType = null,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouseGaze, setMouseGaze] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [bgColor, setBgColor] = useState<string>('#121118');
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(() => avatar.getConfig());
  const [selectedGender, setSelectedGender] = useState<'boy' | 'girl'>(propGender);
  const [activeModelUrl, setActiveModelUrl] = useState<string | null>(propModelUrl);
  const [activeModelType, setActiveModelType] = useState<string | null>(propModelType);
  const [imgLoadFailed, setImgLoadFailed] = useState<boolean>(false);

  // Sync prop gender
  useEffect(() => {
    if (propGender) setSelectedGender(propGender);
  }, [propGender]);

  // Sync background from mascot config
  useEffect(() => {
    const cfg = getMascotConfig();
    setBgColor(BG_MAP[cfg.background] || '#121118');

    const onConfigUpdate = (e: any) => {
      if (e.detail?.background) setBgColor(BG_MAP[e.detail.background as MascotBackground] || '#121118');
    };
    const onAvatarUpdate = (e: any) => {
      if (e.detail) {
        setAvatarConfig(e.detail);
        if (e.detail.gender) setSelectedGender(e.detail.gender);
      }
    };

    window.addEventListener('manas:mascot_config_updated', onConfigUpdate);
    window.addEventListener('manas:avatar_config_updated', onAvatarUpdate);
    return () => {
      window.removeEventListener('manas:mascot_config_updated', onConfigUpdate);
      window.removeEventListener('manas:avatar_config_updated', onAvatarUpdate);
    };
  }, []);

  // Check for user-uploaded model in storage
  useEffect(() => {
    if (propModelUrl) {
      setActiveModelUrl(propModelUrl);
      setActiveModelType(propModelType || 'image');
      return;
    }
    let isMounted = true;
    getStoredMascotModel().then((stored) => {
      if (!isMounted) return;
      if (stored && stored.fileType === 'image') {
        setActiveModelUrl(stored.objectUrl);
        setActiveModelType('image');
      } else {
        setActiveModelUrl(null);
        setActiveModelType(null);
      }
    });
    return () => { isMounted = false; };
  }, [propModelUrl, propModelType]);

  // Smooth mouse move -> parallax gaze
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setMouseGaze({
      x: Math.max(-1, Math.min(1, nx)),
      y: Math.max(-1, Math.min(1, ny)),
    });
  };
  const handleMouseLeave = () => setMouseGaze({ x: 0, y: 0 });

  const resolvedGender: BitmojiGender = selectedGender || (avatarConfig.gender as BitmojiGender) || 'boy';
  const glow = emotionGlow(emotion);

  // Parallax angles & translations
  const rotY = mouseGaze.x * 7;   // deg
  const rotX = -mouseGaze.y * 5;  // deg
  const transX = mouseGaze.x * 8; // px
  const transY = mouseGaze.y * 5; // px

  // Lip-sync talking scale
  const talkScale = isSpeaking ? 1.0 + Math.min(0.04, audioEnergy * 0.08) : 1.0;

  // Active gesture class
  let gestureClass = 'animate-mascot-idle';
  if (activeGesture === 'nod' || activeGesture === 'listening') {
    gestureClass = 'animate-mascot-nod';
  } else if (activeGesture === 'wave') {
    gestureClass = 'animate-mascot-wave';
  } else if (activeGesture === 'breathing_guide') {
    gestureClass = 'animate-mascot-deep-breathe';
  } else if ((activeGesture as string) === 'encourage') {
    gestureClass = 'animate-mascot-encourage';
  } else if (isThinking || activeGesture === 'thinking') {
    gestureClass = 'animate-mascot-thinking';
  } else if (isSpeaking) {
    gestureClass = 'animate-mascot-speaking';
  }

  const avatarSrc = resolvedGender === 'girl' ? '/avatars/girl.png' : '/avatars/boy.png';

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none ${className}`}
      style={{ backgroundColor: bgColor }}
    >
      {/* Dynamic Keyframe Animations */}
      <style>{`
        @keyframes mascot-idle-breathe {
          0%, 100% { transform: scale(1.0) translateY(0); }
          50%      { transform: scale(1.025, 1.028) translateY(-4px); }
        }
        @keyframes mascot-nod-anim {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50%      { transform: translateY(-9px) rotate(-1.5deg); }
        }
        @keyframes mascot-wave-anim {
          0%, 100% { transform: rotate(-2.5deg) translateX(-4px); }
          50%      { transform: rotate(3deg) translateX(4px); }
        }
        @keyframes mascot-deep-breathe-anim {
          0%, 100% { transform: scale(1.0) translateY(0); }
          30%      { transform: scale(1.06, 1.07) translateY(-8px); }
          60%      { transform: scale(1.06, 1.07) translateY(-8px); }
        }
        @keyframes mascot-encourage-anim {
          0%, 100% { transform: translateY(0) scale(1.0); }
          30%      { transform: translateY(-12px) scale(1.04); }
          60%      { transform: translateY(-4px) scale(1.02); }
        }
        @keyframes mascot-speaking-anim {
          0%, 100% { transform: scale(1.0) translateY(0); }
          50%      { transform: scale(1.018, 1.03) translateY(-2px); }
        }
        @keyframes mascot-thinking-tilt {
          0%, 100% { transform: rotate(-3.5deg) translateX(5px); }
        }
        @keyframes aura-pulse {
          0%, 100% { opacity: 0.35; transform: scale(1.0); }
          50%      { opacity: 0.65; transform: scale(1.08); }
        }
        .animate-mascot-idle {
          animation: mascot-idle-breathe 4.2s ease-in-out infinite;
        }
        .animate-mascot-nod {
          animation: mascot-nod-anim 0.9s ease-in-out infinite alternate;
        }
        .animate-mascot-wave {
          animation: mascot-wave-anim 0.75s ease-in-out infinite alternate;
        }
        .animate-mascot-deep-breathe {
          animation: mascot-deep-breathe-anim 5s ease-in-out infinite;
        }
        .animate-mascot-encourage {
          animation: mascot-encourage-anim 1.2s ease-in-out infinite;
        }
        .animate-mascot-speaking {
          animation: mascot-speaking-anim 0.22s ease-in-out infinite alternate;
        }
        .animate-mascot-thinking {
          animation: mascot-thinking-tilt 2s ease-in-out infinite alternate;
        }
      `}</style>

      {/* Ambient Radial Emotion Glow Halo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 65% 60% at 50% 50%, ${glow}, transparent 72%)`,
          transition: 'background 0.8s ease',
        }}
      />

      {/* Soft Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <span className="text-[clamp(60px,11vw,140px)] font-black uppercase tracking-[-0.04em] text-white opacity-[0.025] leading-none select-none">
          MANAS
        </span>
      </div>

      {/* Listening / Speaking Halo Pulse Ring */}
      {(isListening || isSpeaking) && (
        <div
          className="absolute rounded-full pointer-events-none z-5"
          style={{
            width: 290,
            height: 290,
            border: `2px solid ${glow}`,
            animation: 'aura-pulse 1.8s ease-in-out infinite',
          }}
        />
      )}

      {/* Main Avatar Character Container with 3D Perspective Tilt */}
      <div
        className="relative z-10 flex flex-col items-center justify-center w-full h-full max-h-[88%] p-2"
        style={{
          perspective: '750px',
        }}
      >
        <div
          className={`relative flex flex-col items-center justify-center transition-transform duration-150 ease-out ${gestureClass}`}
          style={{
            transform: `perspective(750px) rotateY(${rotY}deg) rotateX(${rotX}deg) translate3d(${transX}px, ${transY}px, 0) scale(${talkScale})`,
          }}
        >
          {/* User-uploaded custom image OR 3D Mascot Render */}
          {activeModelType === 'image' && activeModelUrl ? (
            <img
              src={activeModelUrl}
              alt="Custom 2D Mascot"
              className="max-h-[380px] w-auto object-contain drop-shadow-2xl"
            />
          ) : !imgLoadFailed ? (
            <img
              src={avatarSrc}
              alt={resolvedGender === 'girl' ? 'MANAS Companion (Girl)' : 'MANAS Companion (Boy)'}
              onError={() => setImgLoadFailed(true)}
              className="max-h-[360px] md:max-h-[420px] w-auto object-contain drop-shadow-[0_16px_32px_rgba(0,0,0,0.55)] transition-all duration-300"
            />
          ) : (
            /* Canvas 2D Bitmoji Fallback */
            <BitmojiPortrait
              gender={resolvedGender}
              size={framing === 'bust' ? 280 : 340}
              animate
            />
          )}

          {/* Interactive State Badge (Speaking / Listening / Thinking) */}
          {(isSpeaking || isListening || isThinking) && (
            <div className="absolute -bottom-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 shadow-lg">
              {isSpeaking && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
                  <span className="text-[10px] font-mono text-pink-200 uppercase tracking-wider font-semibold">
                    Speaking
                  </span>
                </>
              )}
              {isListening && !isSpeaking && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-mono text-emerald-200 uppercase tracking-wider font-semibold">
                    Attentive
                  </span>
                </>
              )}
              {isThinking && !isSpeaking && !isListening && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[10px] font-mono text-amber-200 uppercase tracking-wider font-semibold">
                    Thinking
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Boy / Girl Switcher in top corner */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-full p-0.5">
        <button
          onClick={() => {
            setSelectedGender('boy');
            avatar.setGender('boy');
          }}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-all cursor-pointer ${
            resolvedGender === 'boy'
              ? 'bg-pink-500/25 text-pink-200 border border-pink-400/40 shadow-xs'
              : 'text-white/50 hover:text-white/80'
          }`}
          title="Switch to Sriram's Boy Mascot (Pink Hoodie, Spiky Hair)"
        >
          Boy 🧍
        </button>
        <button
          onClick={() => {
            setSelectedGender('girl');
            avatar.setGender('girl');
          }}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-all cursor-pointer ${
            resolvedGender === 'girl'
              ? 'bg-purple-500/25 text-purple-200 border border-purple-400/40 shadow-xs'
              : 'text-white/50 hover:text-white/80'
          }`}
          title="Switch to Girl Mascot (Space Buns, White Skirt)"
        >
          Girl 👧
        </button>
      </div>

      {/* Ground Contact Shadow */}
      <div
        className="absolute bottom-5 pointer-events-none z-5"
        style={{
          width: 220,
          height: 16,
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, transparent 75%)',
        }}
      />
    </div>
  );
};

export default MascotViewer;
