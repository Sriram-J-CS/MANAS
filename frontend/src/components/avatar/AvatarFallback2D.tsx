import React from 'react';

interface AvatarFallback2DProps {
  gender?: 'boy' | 'girl';
  emotion?: string;
  isSpeaking?: boolean;
  className?: string;
}

export const AvatarFallback2D: React.FC<AvatarFallback2DProps> = ({
  gender = 'boy',
  emotion = 'calm',
  isSpeaking = false,
  className = '',
}) => {
  const imgSrc = gender === 'girl' ? '/avatars/girl.png' : '/avatars/boy.png';

  return (
    <div
      className={`relative w-full h-full flex items-center justify-center select-none overflow-hidden ${className}`}
      aria-label="2D Avatar Fallback"
    >
      <div
        className={`relative max-w-[280px] max-h-[380px] transition-transform duration-700 ease-out ${
          isSpeaking ? 'scale-[1.03]' : 'scale-100'
        }`}
        style={{
          animation: 'avatarFloat 4s ease-in-out infinite',
        }}
      >
        <img
          src={imgSrc}
          alt={`Companion ${gender}`}
          className="w-full h-full object-contain drop-shadow-xl"
          loading="eager"
        />
        {isSpeaking && (
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
