import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UI_EFFECTS } from '../../config/uiEffects';

export const PageIntroCurtain: React.FC = () => {
  const [visible, setVisible] = useState(() => {
    if (!UI_EFFECTS.enabled || !UI_EFFECTS.pageIntro) return false;
    if (typeof window !== 'undefined') {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) return false;
      // Do not repeat in same tab session
      const shown = sessionStorage.getItem('manas_intro_seen');
      if (shown) return false;
    }
    return true;
  });

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setVisible(false);
      try {
        sessionStorage.setItem('manas_intro_seen', '1');
      } catch (_) {}
    }, 1150);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="page-intro"
        initial={{ y: 0 }}
        exit={{ y: '-100%' }}
        transition={{
          duration: 0.85,
          ease: [0.76, 0, 0.24, 1],
        }}
        className="fixed inset-0 z-[99999] bg-[#0A0A0A] flex flex-col items-center justify-center pointer-events-none select-none overflow-hidden"
      >
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col items-center gap-3 text-center"
        >
          <span className="font-sans font-black text-3xl sm:text-4xl tracking-[-0.04em] text-white">
            MANAS
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/50">
            A Safe Space To Untangle Your Thoughts
          </span>
          <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-purple-400 to-transparent mt-2" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
