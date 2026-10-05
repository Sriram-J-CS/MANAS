import React from 'react';
import { Loader2 } from 'lucide-react';

export interface AvatarFallback2DProps {
  gender?: 'boy' | 'girl';
  companion?: 'boy' | 'girl';
  emotion?: string;
  isSpeaking?: boolean;
  isLoading?: boolean;
  statusText?: string;
  className?: string;
}

export const AvatarFallback2D: React.FC<AvatarFallback2DProps> = ({
  gender = 'boy',
  companion,
  emotion = 'calm',
  isSpeaking = false,
  isLoading = false,
  statusText,
  className = '',
}) => {
  const chosen = companion || gender;
  const imgSrc = chosen === 'girl' ? '/avatars/girl.png' : '/avatars/boy.png';

  return (
    <div
      className={`relative w-full h-full flex flex-col items-center justify-center select-none overflow-hidden ${className}`}
      aria-label="2D Avatar Fallback"
    >
      <div
        className={`relative max-w-[280px] max-h-[380px] flex flex-col items-center justify-center transition-transform duration-700 ease-out ${
          isSpeaking ? 'scale-[1.03]' : 'scale-100'
        }`}
        style={{
          animation: 'avatarFloat 4s ease-in-out infinite',
        }}
      >
        <img
          src={imgSrc}
          alt={`Companion ${chosen}`}
          className={`w-full h-full object-contain drop-shadow-xl transition-opacity duration-300 ${
            isLoading ? 'opacity-70 blur-[0.5px]' : 'opacity-100'
          }`}
          loading="eager"
        />

        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/25 backdrop-blur-[2px] rounded-3xl p-4 text-center">
            <Loader2 className="w-7 h-7 text-white/90 animate-spin mb-2" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-white/90 font-semibold drop-shadow">
              {statusText || 'Loading 3D Companion...'}
            </span>
          </div>
        )}

        {isSpeaking && !isLoading && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-pink-100 text-pink-700 text-[10px] font-mono font-bold animate-pulse shadow-sm border border-pink-200">
            Speaking
          </div>
        )}
      </div>
      <style>{`
        @keyframes avatarFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
};

export default AvatarFallback2D;
