import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Hand, Ear, Wind, Coffee, Check, X, RotateCcw } from 'lucide-react';

interface GroundingWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

interface Step {
  count: number;
  sense: string;
  icon: React.ReactNode;
  prompt: string;
  examples: string;
}

const STEPS: Step[] = [
  {
    count: 5,
    sense: 'SEE',
    icon: <Eye className="w-5 h-5 text-cyan-500" />,
    prompt: 'Acknowledge 5 things you can see around you.',
    examples: 'A light pattern, a book cover, a leaf outside the window, a pen, or your hands.',
  },
  {
    count: 4,
    sense: 'FEEL',
    icon: <Hand className="w-5 h-5 text-emerald-500" />,
    prompt: 'Acknowledge 4 things you can physically feel.',
    examples: 'The texture of your clothes, the solid ground beneath your feet, cool air on skin.',
  },
  {
    count: 3,
    sense: 'HEAR',
    icon: <Ear className="w-5 h-5 text-amber-500" />,
    prompt: 'Acknowledge 3 distinct sounds around you.',
    examples: 'Distant traffic, hum of a fan or computer, the gentle sound of your own breath.',
  },
  {
    count: 2,
    sense: 'SMELL',
    icon: <Wind className="w-5 h-5 text-purple-500" />,
    prompt: 'Acknowledge 2 things you can smell right now.',
    examples: 'Fresh rain, paper, your soap, a warm drink, or breathe in room air gently.',
  },
  {
    count: 1,
    sense: 'TASTE',
    icon: <Coffee className="w-5 h-5 text-rose-500" />,
    prompt: 'Acknowledge 1 thing you can taste or notice.',
    examples: 'A sip of cool water, lingering mint, or notice the clean resting state of your mouth.',
  },
];

export const GroundingWidget: React.FC<GroundingWidgetProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean[]>>({
    0: [false, false, false, false, false],
    1: [false, false, false, false],
    2: [false, false, false],
    3: [false, false],
    4: [false],
  });

  if (!isOpen) return null;

  const currentStep = STEPS[currentStepIdx];
  const items = checkedItems[currentStepIdx] || [];
  const allCurrentChecked = items.every(Boolean);
  const isFinalStep = currentStepIdx === STEPS.length - 1;

  const handleToggleItem = (itemIdx: number) => {
    setCheckedItems((prev) => {
      const copy = { ...prev };
      const currentList = [...copy[currentStepIdx]];
      currentList[itemIdx] = !currentList[itemIdx];
      copy[currentStepIdx] = currentList;
      return copy;
    });
  };

  const handleNextStep = () => {
    if (isFinalStep) {
      onComplete?.();
      onClose();
    } else {
      setCurrentStepIdx((prev) => prev + 1);
    }
  };

  const handleReset = () => {
    setCurrentStepIdx(0);
    setCheckedItems({
      0: [false, false, false, false, false],
      1: [false, false, false, false],
      2: [false, false, false],
      3: [false, false],
      4: [false],
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          className="w-full max-w-md bg-[#FFFFFF] border border-[#0A0A0A]/15 shadow-2xl rounded-3xl p-6 md:p-8 relative flex flex-col overflow-hidden text-[#0A0A0A]"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-[#0A0A0A]/10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-xs font-bold tracking-wider text-[#0A0A0A]/70 uppercase">
                5-4-3-2-1 Sensory Grounding
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-[#F2EFE8] text-[#0A0A0A]/60 hover:text-[#0A0A0A] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress Indicators */}
          <div className="grid grid-cols-5 gap-2 my-5">
            {STEPS.map((s, idx) => {
              const isPast = idx < currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              return (
                <div
                  key={s.count}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    isPast
                      ? 'bg-emerald-500'
                      : isCurrent
                      ? 'bg-[#8B5CF6] scale-y-125'
                      : 'bg-[#0A0A0A]/10'
                  }`}
                />
              );
            })}
          </div>

          {/* Active Step Content */}
          <div className="flex-1 py-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FDFBF7] border border-[#0A0A0A]/10 flex items-center justify-center shadow-inner">
                {currentStep.icon}
              </div>
              <div>
                <span className="text-[10px] font-mono tracking-widest text-[#8B5CF6] font-bold uppercase">
                  Step {currentStepIdx + 1} of 5 · {currentStep.sense}
                </span>
                <h3 className="text-xl font-bold tracking-tight text-[#0A0A0A]">
                  {currentStep.count} Things You {currentStep.sense}
                </h3>
              </div>
            </div>

            <p className="text-sm text-[#0A0A0A]/80 leading-relaxed font-sans">
              {currentStep.prompt}
            </p>

            {/* Tap checklist */}
            <div className="space-y-2 pt-1">
              {items.map((isChecked, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleToggleItem(i)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs font-mono transition-all flex items-center justify-between cursor-pointer ${
                    isChecked
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                      : 'bg-[#FDFBF7] border-[#0A0A0A]/15 text-[#0A0A0A]/70 hover:border-[#0A0A0A]/30'
                  }`}
                >
                  <span>Item #{i + 1} noticed</span>
                  <div
                    className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                      isChecked
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-[#0A0A0A]/30 bg-white'
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </button>
              ))}
            </div>

            <div className="p-3 rounded-2xl bg-[#FDFBF7] border border-[#0A0A0A]/10 text-xs text-[#0A0A0A]/60 leading-normal font-sans">
              <strong className="text-[#0A0A0A] font-semibold">Examples:</strong>{' '}
              {currentStep.examples}
            </div>
          </div>

          {/* Actions Bottom Bar */}
          <div className="pt-4 border-t border-[#0A0A0A]/10 flex items-center justify-between">
            <button
              onClick={handleReset}
              className="text-xs font-mono text-[#0A0A0A]/50 hover:text-[#0A0A0A] flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Restart
            </button>

            <button
              onClick={handleNextStep}
              className={`px-5 py-2 rounded-full font-mono text-xs font-bold tracking-wider transition-all flex items-center gap-1.5 shadow-md ${
                allCurrentChecked
                  ? 'bg-[#0A0A0A] text-white hover:bg-[#222222] cursor-pointer'
                  : 'bg-[#0A0A0A]/20 text-[#0A0A0A]/50 cursor-pointer hover:bg-[#0A0A0A]/30'
              }`}
            >
              <span>{isFinalStep ? 'Finish & Feel Present' : 'Next Sense →'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
