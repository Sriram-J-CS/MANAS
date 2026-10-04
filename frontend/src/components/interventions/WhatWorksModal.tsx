import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ThumbsUp, Wind, Eye, BookOpen, Music, Footprints, Flame } from 'lucide-react';

interface WhatWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
}

const STRATEGY_ICONS: Record<string, any> = {
  breathing_4_7_8: Wind,
  grounding_5_4_3_2_1: Eye,
  cognitive_reframing: Flame,
  reflective_journaling: BookOpen,
  calming_music: Music,
  walking_break: Footprints
};

export const WhatWorksModal: React.FC<WhatWorksModalProps> = ({ isOpen, onClose, token }) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWhatWorks = async () => {
    setIsLoading(true);
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch('/api/interventions/what-works', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (_) {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWhatWorks();
    }
  }, [isOpen, token]);

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
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ThumbsUp className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  What Works For Me
                </h2>
                <p className="text-xs text-white/50">Empirical effectiveness tracking across coping strategies (Zero fabricated stats)</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="my-6">
            {isLoading ? (
              <div className="py-12 text-center text-xs font-mono text-white/40">Analyzing your intervention history...</div>
            ) : !data?.has_data ? (
              /* Honest Empty State */
              <div className="space-y-6">
                <div className="py-8 px-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center">
                  <Sparkles className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
                  <h4 className="text-sm font-semibold text-white mb-1">No Intervention History Established Yet</h4>
                  <p className="text-xs text-white/60 max-w-md mx-auto leading-relaxed">
                    MANAS never invents effectiveness percentages. When you try grounding exercises, breathing cadences, or mindful journaling in chat, your feedback will calculate your personal effectiveness profile here.
                  </p>
                </div>

                <div className="space-y-3">
                  <span className="text-[11px] font-mono text-white/40 uppercase block pl-1">Available Strategies in MANAS</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data?.available_catalog?.map((cat: any) => {
                      const Icon = STRATEGY_ICONS[cat.id] || Sparkles;
                      return (
                        <div key={cat.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 text-xs">
                          <div className="flex items-center gap-2 mb-1.5 text-emerald-400 font-bold">
                            <Icon className="w-4 h-4" />
                            <span>{cat.title}</span>
                          </div>
                          <p className="text-white/60 text-[11px] leading-relaxed mb-2">{cat.description}</p>
                          <span className="text-[10px] font-mono text-white/40 block">Best for: {cat.best_for}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Verified User Strategies */
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-300">
                  Total self-regulation sessions evaluated: <strong className="font-mono text-white">{data.total_interventions_tested}</strong>. Top supportive strategy: <strong className="text-white">{data.most_effective_strategy}</strong>.
                </div>

                <div className="space-y-3">
                  {data.strategies.map((strat: any) => {
                    const Icon = STRATEGY_ICONS[strat.strategy_id] || Sparkles;
                    return (
                      <div key={strat.strategy_id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-emerald-500/30 transition-all text-xs">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 font-bold text-white">
                            <Icon className="w-4 h-4 text-emerald-400" />
                            <span>{strat.title}</span>
                          </div>
                          <span className="font-mono text-emerald-400 font-black text-sm">
                            {strat.success_rate_pct}% helpful
                          </span>
                        </div>
                        <p className="text-white/60 text-[11px] leading-relaxed mb-2">{strat.evidence_statement}</p>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: `${strat.success_rate_pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
