import React from 'react';
import { motion } from 'framer-motion';
import type { MascotExpression } from '../../types';

interface AuroraBackgroundProps {
  expression: MascotExpression;
}

interface EmotionTheme {
  primary: string;
  secondary: string;
  glow: string;
  borderColor: string;
}

const EMOTION_THEMES: Record<string, EmotionTheme> = {
  calm: {
    primary: 'rgba(13, 148, 136, 0.28)', // teal-600
    secondary: 'rgba(16, 185, 129, 0.20)', // emerald-500
    glow: 'rgba(20, 184, 166, 0.35)',
    borderColor: 'rgba(45, 212, 191, 0.3)',
  },
  happy: {
    primary: 'rgba(139, 92, 246, 0.30)', // violet-500
    secondary: 'rgba(236, 72, 153, 0.20)', // pink-500
    glow: 'rgba(168, 85, 247, 0.35)',
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  concerned: {
    primary: 'rgba(217, 119, 6, 0.28)', // amber-600
    secondary: 'rgba(234, 88, 12, 0.20)', // orange-600
    glow: 'rgba(245, 158, 11, 0.35)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  sad: {
    primary: 'rgba(2, 132, 199, 0.26)', // sky-600
    secondary: 'rgba(99, 102, 241, 0.18)', // indigo-500
    glow: 'rgba(56, 189, 248, 0.30)',
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  neutral: {
    primary: 'rgba(6, 182, 212, 0.22)', // cyan-500
    secondary: 'rgba(100, 116, 139, 0.18)', // slate-500
    glow: 'rgba(6, 182, 212, 0.25)',
    borderColor: 'rgba(34, 211, 238, 0.25)',
  },
  surprised: {
    primary: 'rgba(234, 179, 8, 0.28)', // yellow-500
    secondary: 'rgba(245, 158, 11, 0.20)', // amber-500
    glow: 'rgba(252, 211, 77, 0.35)',
    borderColor: 'rgba(252, 211, 77, 0.3)',
  },
};

export const AuroraBackground: React.FC<AuroraBackgroundProps> = ({ expression }) => {
  const theme = EMOTION_THEMES[expression] || EMOTION_THEMES.neutral;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {/* Base deep dark background */}
      <div className="absolute inset-0 bg-[#05070c]" />

      {/* Primary Floating Aurora Orb */}
      <motion.div
        animate={{
          x: ['-10%', '15%', '-5%'],
          y: ['-15%', '10%', '-10%'],
          scale: [1, 1.15, 0.95],
          backgroundColor: theme.primary,
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
        }}
        className="absolute -top-32 -left-20 w-[480px] sm:w-[680px] h-[480px] sm:h-[680px] rounded-full blur-[110px] opacity-70"
      />

      {/* Secondary Floating Aurora Orb */}
      <motion.div
        animate={{
          x: ['10%', '-15%', '8%'],
          y: ['15%', '-10%', '12%'],
          scale: [1.1, 0.95, 1.05],
          backgroundColor: theme.secondary,
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
        }}
        className="absolute -bottom-32 -right-20 w-[420px] sm:w-[620px] h-[420px] sm:h-[620px] rounded-full blur-[120px] opacity-60"
      />

      {/* Center Subtle Mood Tint */}
      <motion.div
        animate={{
          backgroundColor: theme.glow,
        }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-[140px] opacity-35"
      />

      {/* Subtle Noise / Radial overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/60" />
    </div>
  );
};
