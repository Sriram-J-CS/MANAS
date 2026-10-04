import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, Activity, ShieldCheck, Heart, Sparkles, Calendar } from 'lucide-react';

interface MoodLogItem {
  score: number;
  tags?: string;
  created_at: string;
}

interface MoodJourneyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  moodHistory: MoodLogItem[];
  currentMood: number | null;
  onSelectMood: (score: number) => void;
}

export const MoodJourneyDrawer: React.FC<MoodJourneyDrawerProps> = ({
  isOpen,
  onClose,
  moodHistory,
  currentMood,
  onSelectMood,
}) => {
  const triggerHaptic = (ms = 15) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch (_) {}
    }
  };

  if (!isOpen) return null;

  // Prepare real values from actual moodHistory
  const realEntries = [...moodHistory];
  if (currentMood !== null && (realEntries.length === 0 || realEntries[realEntries.length - 1].score !== currentMood)) {
    realEntries.push({
      score: currentMood,
      tags: 'Current Check-in',
      created_at: 'Just now',
    });
  }

  const hasData = realEntries.length > 0;
  const recentEntries = realEntries.slice(-7);
  const avgScore = hasData
    ? realEntries.reduce((acc, curr) => acc + curr.score, 0) / realEntries.length
    : null;

  // Real Burnout Risk & Recommendations based on actual check-ins
  let burnoutRisk = 'Awaiting data';
  let burnoutDetail = 'Log check-ins to compute risk';
  let burnoutBadge = 'text-white/50 bg-white/10 border-white/20';
  let recommendationTitle = 'Mindful Presence';
  let recommendationDetail = 'Take a moment to check in with how you feel';

  if (avgScore !== null) {
    if (avgScore <= 2.2) {
      burnoutRisk = 'Elevated';
      burnoutDetail = 'Recent logs show persistent emotional strain';
      burnoutBadge = 'text-rose-400 bg-rose-500/20 border-rose-500/30';
      recommendationTitle = 'Gentle Rest & Support';
      recommendationDetail = 'Pause work, try 4-7-8 breathing, or speak with someone';
    } else if (avgScore <= 3.3) {
      burnoutRisk = 'Moderate';
      burnoutDetail = 'Noticing mild fatigue across recent logs';
      burnoutBadge = 'text-amber-400 bg-amber-500/20 border-amber-500/30';
      recommendationTitle = 'Compassionate Pacing';
      recommendationDetail = 'Insert short 5-minute pauses between study blocks';
    } else {
      burnoutRisk = 'Low';
      burnoutDetail = 'Emotional rhythm is balanced and steady';
      burnoutBadge = 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
      recommendationTitle = 'Sustain Your Rhythm';
      recommendationDetail = 'Protect your sleep window and celebrate your daily progress';
    }
  }

  // Build SVG points for chart from real entries
  const chartPoints = recentEntries.map((entry, i) => {
    const total = recentEntries.length;
    const x = total === 1 ? 150 : 25 + i * (250 / (total - 1));
    const y = 105 - ((entry.score - 1) / 4) * 85;
    const dayLabel = entry.created_at || `Log ${i + 1}`;
    return { x, y, score: entry.score, day: dayLabel.length > 8 ? dayLabel.slice(0, 8) : dayLabel };
  });

  // Build smooth SVG path if 2 or more points
  let pathD = '';
  let areaPathD = '';
  if (chartPoints.length > 1) {
    pathD = `M ${chartPoints[0].x} ${chartPoints[0].y}`;
    for (let i = 1; i < chartPoints.length; i++) {
      const prev = chartPoints[i - 1];
      const curr = chartPoints[i];
      const cpX = (prev.x + curr.x) / 2;
      pathD += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    areaPathD = `${pathD} L ${chartPoints[chartPoints.length - 1].x} 115 L ${chartPoints[0].x} 115 Z`;
  }

  const moodLevels = [
    { num: 1, label: 'Very Low', emoji: '😞' },
    { num: 2, label: 'Low', emoji: '😟' },
    { num: 3, label: 'Neutral', emoji: '😐' },
    { num: 4, label: 'Calm', emoji: '🙂' },
    { num: 5, label: 'Joyful', emoji: '😊' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Slide-in Drawer */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="relative z-10 w-full max-w-md h-full bg-[#07090e]/95 border-l border-white/15 backdrop-blur-2xl flex flex-col shadow-2xl text-white overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-black/40">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30">
                <TrendingUp className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-tight text-white flex items-center gap-1.5 font-mono">
                  <span>Mood Journey</span>
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                </h3>
                <p className="text-[10px] text-white/50 font-mono">Real Emotional Baseline & Rhythm</p>
              </div>
            </div>

            <button
              onClick={() => {
                triggerHaptic(10);
                onClose();
              }}
              aria-label="Close Mood Journey Drawer"
              className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            {/* Quick Check-in Banner */}
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/50 block mb-2">
                Quick Log · How are you feeling right now?
              </span>
              <div className="flex items-center justify-between gap-1">
                {moodLevels.map((lvl) => (
                  <button
                    key={lvl.num}
                    onClick={() => {
                      triggerHaptic(20);
                      onSelectMood(lvl.num);
                    }}
                    className={`flex-1 py-2 px-1 rounded-xl flex flex-col items-center gap-1 border transition-all ${
                      currentMood === lvl.num
                        ? 'bg-cyan-500/20 border-cyan-400 text-white scale-105 shadow-md shadow-cyan-500/20'
                        : 'bg-black/40 border-white/10 hover:border-white/30 text-white/70 hover:scale-105'
                    }`}
                  >
                    <span className="text-lg">{lvl.emoji}</span>
                    <span className="text-[9px] font-mono leading-none text-white/60">{lvl.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 7-Day Interactive SVG Mini Chart */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-950/20 via-black/40 to-cyan-950/20 border border-white/10 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  Emotional Trend Curve
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${burnoutBadge}`}>
                  {burnoutRisk} Risk
                </span>
              </div>

              {/* Chart SVG or Honest Empty State */}
              <div className="w-full flex justify-center py-2 min-h-[120px] items-center">
                {!hasData ? (
                  <div className="text-center p-4 text-white/40 text-xs font-mono">
                    <p className="font-semibold text-white/60">No check-ins logged yet</p>
                    <p className="text-[10px] text-white/40 mt-1">Select an emoji above to record your first mood score.</p>
                  </div>
                ) : chartPoints.length === 1 ? (
                  <div className="text-center p-4 text-white/60 text-xs font-mono">
                    <p className="text-cyan-300 font-bold text-sm">First Check-in Logged: {chartPoints[0].score} / 5</p>
                    <p className="text-[10px] text-white/40 mt-1">Log another mood check-in to reveal your multi-point curve.</p>
                  </div>
                ) : (
                  <svg viewBox="0 0 300 130" className="w-full h-32 overflow-visible">
                    <defs>
                      <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                      </linearGradient>
                      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* Horizontal grid guide lines */}
                    {[25, 60, 95].map((gy, idx) => (
                      <line
                        key={idx}
                        x1="15"
                        y1={gy}
                        x2="285"
                        y2={gy}
                        stroke="rgba(255,255,255,0.06)"
                        strokeDasharray="3 3"
                      />
                    ))}

                    {/* Gradient Area Fill */}
                    {areaPathD && <path d={areaPathD} fill="url(#moodGradient)" />}

                    {/* Bezier Stroke Curve */}
                    {pathD && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#a78bfa"
                        strokeWidth="2.5"
                        filter="url(#glow)"
                      />
                    )}

                    {/* Day Score Dots */}
                    {chartPoints.map((pt, i) => (
                      <g key={i} className="cursor-pointer group">
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="4"
                          fill="#06b6d4"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                          className="transition-transform group-hover:scale-150"
                        />
                        <text
                          x={pt.x}
                          y={125}
                          textAnchor="middle"
                          fill="rgba(255,255,255,0.5)"
                          fontSize="9"
                          fontFamily="monospace"
                        >
                          {pt.day}
                        </text>
                      </g>
                    ))}
                  </svg>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-white/50 pt-2 border-t border-white/10">
                <span>Baseline: {avgScore !== null ? `${avgScore.toFixed(1)} / 5` : 'Awaiting data'}</span>
                <span>{hasData ? `${realEntries.length} total log(s)` : 'No entries'}</span>
              </div>
            </div>

            {/* Baseline Telemetry Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-black/50 border border-white/10">
                <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-mono font-bold uppercase">Burnout Risk</span>
                </div>
                <span className="text-base font-bold font-mono text-white">{burnoutRisk}</span>
                <p className="text-[10px] text-white/50 font-mono mt-0.5">{burnoutDetail}</p>
              </div>

              <div className="p-3 rounded-xl bg-black/50 border border-white/10">
                <div className="flex items-center gap-1.5 text-cyan-400 mb-1">
                  <Heart className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-mono font-bold uppercase">Self Recommendation</span>
                </div>
                <span className="text-xs font-bold text-white">{recommendationTitle}</span>
                <p className="text-[10px] text-white/50 font-mono mt-0.5">{recommendationDetail}</p>
              </div>
            </div>

            {/* Recent Check-in Logs */}
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/50 block mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-violet-400" />
                Recent Check-in Logs
              </span>
              <div className="space-y-1.5">
                {moodHistory.length === 0 ? (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-center">
                    <p className="text-xs text-white/50 font-mono">No check-ins logged yet.</p>
                    <p className="text-[10px] text-white/30 font-mono mt-1">Select an emoji above to record your first mood entry.</p>
                  </div>
                ) : (
                  moodHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        <span className="text-white/80 font-bold">
                          Score: {item.score} / 5
                        </span>
                        <span className="text-white/40">· {item.tags || 'General'}</span>
                      </div>
                      <span className="text-[10px] text-white/40">{item.created_at}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

