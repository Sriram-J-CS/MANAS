import React, { useEffect, useState } from 'react';
import type { MascotExpression } from '../../types';
import type { OutfitType, MascotCustomAttributes } from './ThreeCartoonMascot';

interface Mascot2DFallbackProps {
  gender?: 'boy' | 'girl';
  outfit?: OutfitType;
  expression?: MascotExpression;
  isSpeaking?: boolean;
  isUserTyping?: boolean;
  isGuidedBreathing?: boolean;
  attributes?: MascotCustomAttributes;
  className?: string;
}

/**
 * 2D Animated Portrait Fallback
 * Renders when WebGL is unavailable, device is low-end, or prefers-reduced-motion is active.
 * Features natural SVG-based blinking, mouth movement, and breathing.
 */
export const Mascot2DFallback: React.FC<Mascot2DFallbackProps> = ({
  gender = 'boy',
  outfit = 'hoodie',
  expression = 'neutral',
  isSpeaking = false,
  isUserTyping = false,
  isGuidedBreathing = false,
  attributes = {},
  className = '',
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [mouthStep, setMouthStep] = useState(0);

  // Blinking loop every 3.6s
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 160);
    }, 3600);
    return () => clearInterval(blinkInterval);
  }, []);

  // Speaking mouth movement
  useEffect(() => {
    let interval: number;
    if (isSpeaking) {
      interval = window.setInterval(() => {
        setMouthStep((prev) => (prev + 1) % 3);
      }, 130);
    } else {
      setMouthStep(0);
    }
    return () => clearInterval(interval);
  }, [isSpeaking]);

  const skinColor = attributes.skinTone || '#FCD34D';
  const hairColor = attributes.hairColor || '#27272A';
  const outfitColor =
    attributes.outfitColor ||
    (outfit === 'hoodie'
      ? '#3B82F6'
      : outfit === 'formal'
      ? '#475569'
      : outfit === 'kurta_saree'
      ? '#D97706'
      : outfit === 'sports'
      ? '#10B981'
      : outfit === 'pyjamas'
      ? '#8B5CF6'
      : '#E11D48');

  return (
    <div
      className={`relative flex flex-col items-center justify-center p-6 ${className}`}
      role="img"
      aria-label={`2D Animated Mascot (${gender}, ${outfit})`}
    >
      <div
        className={`relative w-48 h-48 sm:w-56 sm:h-56 transition-transform duration-700 ${
          isGuidedBreathing ? 'scale-105' : 'animate-[float2D_3.5s_ease-in-out_infinite]'
        }`}
      >
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
          <defs>
            <radialGradient id="glow2D" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Ambient Glow */}
          <circle cx="100" cy="100" r="95" fill="url(#glow2D)" />

          {/* Torso / Outfit */}
          <path
            d="M 50 190 Q 100 140 150 190 Z"
            fill={outfitColor}
            stroke="#FFFFFF"
            strokeWidth="2"
          />

          {/* Head */}
          <circle
            cx="100"
            cy="100"
            r="48"
            fill={skinColor}
            stroke="#E2E8F0"
            strokeWidth="1.5"
          />

          {/* Hair */}
          {gender === 'girl' ? (
            <>
              {/* Girl Hair & Buns */}
              <circle cx="62" cy="65" r="14" fill={hairColor} />
              <circle cx="138" cy="65" r="14" fill={hairColor} />
              <path
                d="M 55 95 C 55 50 145 50 145 95 C 135 68 115 65 100 65 C 85 65 65 68 55 95 Z"
                fill={hairColor}
              />
            </>
          ) : (
            /* Boy Hair */
            <path
              d="M 58 85 C 58 55 142 55 142 85 C 130 65 110 60 100 60 C 90 60 70 65 58 85 Z"
              fill={hairColor}
            />
          )}

          {/* Cheeks */}
          <ellipse cx="80" cy="115" rx="7" ry="4" fill="#F43F5E" opacity="0.35" />
          <ellipse cx="120" cy="115" rx="7" ry="4" fill="#F43F5E" opacity="0.35" />

          {/* Eyes & Blinking */}
          {isBlinking ? (
            <>
              <line x1="78" y1="102" x2="88" y2="102" stroke="#18181B" strokeWidth="3" strokeLinecap="round" />
              <line x1="112" y1="102" x2="122" y2="102" stroke="#18181B" strokeWidth="3" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle cx="83" cy="102" r="6" fill="#18181B" />
              <circle cx="85" cy="100" r="2" fill="#FFFFFF" />
              <circle cx="117" cy="102" r="6" fill="#18181B" />
              <circle cx="119" cy="100" r="2" fill="#FFFFFF" />
            </>
          )}

          {/* Glasses */}
          {attributes.glasses && (
            <g stroke="#18181B" strokeWidth="2.5" fill="none">
              <circle cx="83" cy="102" r="11" />
              <circle cx="117" cy="102" r="11" />
              <line x1="94" y1="102" x2="106" y2="102" />
            </g>
          )}

          {/* Mouth / Visemes */}
          {isSpeaking ? (
            mouthStep === 1 ? (
              <ellipse cx="100" cy="128" rx="8" ry="7" fill="#B91C1C" />
            ) : mouthStep === 2 ? (
              <ellipse cx="100" cy="128" rx="5" ry="4" fill="#B91C1C" />
            ) : (
              <path d="M 92 126 Q 100 135 108 126" stroke="#B91C1C" strokeWidth="2.5" fill="none" />
            )
          ) : expression === 'happy' ? (
            <path d="M 90 124 Q 100 136 110 124" stroke="#18181B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          ) : expression === 'concerned' || expression === 'sad' ? (
            <path d="M 92 130 Q 100 122 108 130" stroke="#18181B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          ) : (
            <line x1="94" y1="126" x2="106" y2="126" stroke="#18181B" strokeWidth="2" strokeLinecap="round" />
          )}
        </svg>
      </div>

      {isUserTyping && (
        <span className="mt-2 text-[10px] font-mono uppercase tracking-wider text-cyan-400 animate-pulse">
          Listening carefully...
        </span>
      )}

      <style>{`
        @keyframes float2D {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
};
