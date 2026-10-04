import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Compass, CheckCircle2, RotateCcw, ArrowRight } from 'lucide-react';

interface PersonalityModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
}

export const PersonalityDiscoveryModal: React.FC<PersonalityModalProps> = ({ isOpen, onClose, token }) => {
  const [profile, setProfile] = useState<any>(null);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isAssessing, setIsAssessing] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);

  const fetchProfileAndQuestions = async () => {
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch('/api/personality/profile', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (data.has_profile) {
          setProfile(data);
          setShowQuiz(false);
        } else {
          setShowQuiz(true);
        }
      }

      const qRes = await fetch('/api/personality/questions');
      if (qRes.ok) {
        const qData = await qRes.json();
        setScenarios(qData.scenarios || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchProfileAndQuestions();
    }
  }, [isOpen, token]);

  const handleSelectOption = async (optionIndex: number) => {
    const currentScenario = scenarios[currentStep];
    const newAnswers = { ...answers, [currentScenario.id]: optionIndex };
    setAnswers(newAnswers);

    if (currentStep < scenarios.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Completed all questions -> submit
      setIsAssessing(true);
      try {
        const authToken = token || localStorage.getItem('manas_access_token');
        const res = await fetch('/api/personality/assess', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify({ answers: newAnswers })
        });
        if (res.ok) {
          const resData = await res.json();
          setProfile(resData);
          setShowQuiz(false);
        }
      } catch (_) {
      } finally {
        setIsAssessing(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0F1117] border border-white/10 text-white shadow-2xl p-6 sm:p-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  OCEAN Personality Discovery
                </h2>
                <p className="text-xs text-white/50">Scenario-based behavioral exploration (Non-clinical self-reflection)</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="my-6">
            {showQuiz && scenarios.length > 0 ? (
              <div>
                {/* Progress Bar */}
                <div className="flex items-center justify-between text-xs text-white/40 font-mono mb-2">
                  <span>SCENARIO {currentStep + 1} OF {scenarios.length}</span>
                  <span>{Math.round(((currentStep + 1) / scenarios.length) * 100)}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-6">
                  <div
                    className="h-full bg-teal-400 transition-all duration-300"
                    style={{ width: `${((currentStep + 1) / scenarios.length) * 100}%` }}
                  />
                </div>

                {/* Scenario Prompt */}
                <h3 className="text-base sm:text-lg font-bold text-white mb-5 leading-snug">
                  "{scenarios[currentStep]?.scenario}"
                </h3>

                {/* Option Choices */}
                <div className="space-y-3">
                  {scenarios[currentStep]?.options.map((opt: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      disabled={isAssessing}
                      className="w-full text-left p-4 rounded-2xl bg-white/[0.03] hover:bg-white/10 border border-white/10 hover:border-teal-400/40 text-xs sm:text-sm text-white/80 hover:text-white transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <span>{opt.text}</span>
                      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-teal-400 shrink-0 ml-2" />
                    </button>
                  ))}
                </div>

                {isAssessing && (
                  <div className="mt-4 text-center text-xs text-teal-300 animate-pulse font-mono">
                    Synthesizing your OCEAN traits...
                  </div>
                )}
              </div>
            ) : profile ? (
              /* Profile Display */
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Personal Communication Profile
                  </span>
                  <button
                    onClick={() => {
                      setAnswers({});
                      setCurrentStep(0);
                      setShowQuiz(true);
                    }}
                    className="text-xs font-mono text-white/40 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Retake Scenarios
                  </button>
                </div>

                {/* OCEAN Trait Bars */}
                <div className="space-y-4">
                  {[
                    { key: 'openness', label: 'Openness to Experience', color: 'bg-indigo-400' },
                    { key: 'conscientiousness', label: 'Conscientiousness', color: 'bg-emerald-400' },
                    { key: 'extraversion', label: 'Extraversion', color: 'bg-amber-400' },
                    { key: 'agreeableness', label: 'Agreeableness', color: 'bg-cyan-400' },
                    { key: 'neuroticism', label: 'Emotional Sensitivity (Neuroticism)', color: 'bg-rose-400' },
                  ].map((t) => {
                    const val = profile.traits?.[t.key] ?? 0.5;
                    const desc = profile.descriptions?.[t.key] || '';
                    return (
                      <div key={t.key} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
                        <div className="flex justify-between items-center text-xs mb-1.5">
                          <span className="font-semibold text-white">{t.label}</span>
                          <span className="font-mono text-white/50">{Math.round(val * 100)}%</span>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full ${t.color} rounded-full transition-all duration-500`}
                            style={{ width: `${val * 100}%` }}
                          />
                        </div>
                        {desc && <p className="text-[11px] text-white/60 leading-relaxed">{desc}</p>}
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-200/90 leading-relaxed">
                  <strong>How MANAS Adapts:</strong> High openness prompts deeper exploratory metaphors; high conscientiousness provides clear structured steps; emotional sensitivity shifts conversation into calm, grounding micro-paces.
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <button
                  onClick={() => setShowQuiz(true)}
                  className="px-6 py-3 rounded-2xl bg-teal-500 hover:bg-teal-400 text-black font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Start 2-Minute Discovery →
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
