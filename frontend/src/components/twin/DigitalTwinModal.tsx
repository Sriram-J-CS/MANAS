import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, TrendingUp, AlertTriangle, ShieldCheck, Heart, Moon, Zap, Target, Briefcase, Sparkles, RefreshCw, Trash2, Edit3, Check } from 'lucide-react';

interface DigitalTwinModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
}

export const DigitalTwinModal: React.FC<DigitalTwinModalProps> = ({ isOpen, onClose, token }) => {
  const [twinData, setTwinData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'checkin'>('overview');
  const [selectedMetric, setSelectedMetric] = useState('stress');
  const [metricScore, setMetricScore] = useState(5);
  const [metricNote, setMetricNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [autoFilled, setAutoFilled] = useState(false);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<number>(5);
  const [editNote, setEditNote] = useState<string>('');

  const fetchTwinData = async () => {
    setIsLoading(true);
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch('/api/twin/overview', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setTwinData(data);
      }
    } catch (_) {
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLatestCheckin = async () => {
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch('/api/wellness/latest', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.latest) {
          setSelectedMetric(data.latest.metric_type || 'stress');
          setMetricScore(data.latest.score || 5);
          setMetricNote(data.latest.note || '');
          setAutoFilled(true);
        }
      }
      const histRes = await fetch('/api/wellness/history?limit=10', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (histRes.ok) {
        const histData = await histRes.json();
        setRecentLogs(histData.entries || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchTwinData();
      fetchLatestCheckin();
    }
  }, [isOpen, token]);

  const handleDeleteLog = async (id: string) => {
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      await fetch(`/api/wellness/${id}`, {
        method: 'DELETE',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      fetchLatestCheckin();
      fetchTwinData();
    } catch (_) {}
  };

  const handleUpdateLog = async (id: string) => {
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      await fetch(`/api/wellness/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          score: editScore,
          note: editNote,
        }),
      });
      setEditingLogId(null);
      fetchLatestCheckin();
      fetchTwinData();
    } catch (_) {}
  };

  const handleLogWellness = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage('');
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch('/api/wellness', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          metric_type: selectedMetric,
          score: metricScore,
          note: metricNote
        })
      });
      if (res.ok) {
        setSubmitMessage('Logged successfully!');
        setMetricNote('');
        fetchTwinData();
        setTimeout(() => setActiveTab('overview'), 900);
      } else {
        setSubmitMessage('Sign in to record personal wellness metrics.');
      }
    } catch (_) {
      setSubmitMessage('Connection error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0F1117] border border-white/10 text-white shadow-2xl p-6 sm:p-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Digital Mental Twin <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">MANAS Engine</span>
                </h2>
                <p className="text-xs text-white/50">Longitudinal emotional baseline & personal strain signals (Non-clinical)</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex gap-2 my-5">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'overview'
                  ? 'bg-white text-black shadow-lg'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              Twin Baseline & Strain
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-mono font-medium">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span>Auto-updated from your chats</span>
            </div>
            <button
              onClick={fetchTwinData}
              className="ml-auto p-2 rounded-xl bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {isLoading ? (
                <div className="py-16 text-center text-white/40 text-sm">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                  Synthesizing your personal Digital Twin baseline...
                </div>
              ) : !twinData?.baseline_established ? (
                /* Honest Empty State */
                <div className="py-12 px-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center">
                  <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">No Mood Baseline Established Yet</h3>
                  <p className="text-xs text-white/60 max-w-md mx-auto mb-3 leading-relaxed">
                    MANAS continuously infers and updates your mental twin directly from your natural chats. Chat with your companion to automatically establish your personal baseline.
                  </p>
                </div>
              ) : (
                /* Real Twin Overview */
                <div className="space-y-5">
                  {/* Current State Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                      <span className="text-[11px] font-mono text-white/40 uppercase">Current Mood</span>
                      <div className="text-2xl font-black text-white mt-1">
                        {twinData.current_state.mood} <span className="text-sm font-normal text-white/40">/ 5</span>
                      </div>
                      <span className="text-[10px] text-white/50 block mt-1">
                        Trend: <strong className="capitalize text-indigo-300">{twinData.current_state.trend}</strong>
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                      <span className="text-[11px] font-mono text-white/40 uppercase">Personal Baseline</span>
                      <div className="text-2xl font-black text-indigo-400 mt-1">
                        {twinData.personal_baseline.mean_mood} <span className="text-sm font-normal text-white/40">avg</span>
                      </div>
                      <span className="text-[10px] text-white/50 block mt-1">
                        Across {twinData.personal_baseline.sample_size} verified logs
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                      <span className="text-[11px] font-mono text-white/40 uppercase">Change from Baseline</span>
                      <div className={`text-2xl font-black mt-1 ${
                        twinData.current_state.deviation_from_baseline >= 0 ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {twinData.current_state.deviation_from_baseline > 0 ? '+' : ''}
                        {twinData.current_state.deviation_from_baseline}
                      </div>
                      <span className="text-[10px] text-white/50 block mt-1">
                        Variance: ±{twinData.personal_baseline.stddev}
                      </span>
                    </div>
                  </div>

                  {/* Burnout & Workload Strain Signal */}
                  <div className="p-5 rounded-2xl bg-indigo-950/20 border border-indigo-500/20">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">Workload & Strain Signal</h4>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            twinData.burnout_risk_signal.level === 'elevated'
                              ? 'bg-rose-500/20 text-rose-300'
                              : twinData.burnout_risk_signal.level === 'moderate'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {twinData.burnout_risk_signal.level}
                          </span>
                        </div>
                        <p className="text-xs text-white/80 mt-1 leading-relaxed">
                          {twinData.burnout_risk_signal.label}
                        </p>
                        {twinData.burnout_risk_signal.evidence?.length > 0 && (
                          <div className="mt-3 space-y-1">
                            <span className="text-[10px] font-mono text-white/40 uppercase">Traceable Evidence:</span>
                            {twinData.burnout_risk_signal.evidence.map((item: string, idx: number) => (
                              <div key={idx} className="text-xs text-white/60 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                {item}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Typing Behavioral Telemetry */}
                  {twinData.typing_baseline && (
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
                      <span className="text-[11px] font-mono text-white/40 uppercase block mb-2">Typing Cadence Baseline</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-white/[0.02]">
                          <span className="text-white/40 block text-[10px]">Avg Speed</span>
                          <span className="font-mono text-white font-bold">{twinData.typing_baseline.average_wpm} WPM</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white/[0.02]">
                          <span className="text-white/40 block text-[10px]">Avg Pause</span>
                          <span className="font-mono text-white font-bold">{twinData.typing_baseline.average_pause_sec}s</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white/[0.02]">
                          <span className="text-white/40 block text-[10px]">Sessions Analyzed</span>
                          <span className="font-mono text-indigo-300 font-bold">{twinData.typing_baseline.sessions_analyzed}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Check-in */}
          {activeTab === 'checkin' && (
            <div className="space-y-6">
              {autoFilled && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-300">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>Auto-filled from your recent conversation. You can tweak or save as-is.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAutoFilled(false);
                      setMetricNote('');
                    }}
                    className="text-[11px] text-cyan-400/80 hover:text-cyan-200 underline cursor-pointer"
                  >
                    Clear Auto-Fill
                  </button>
                </div>
              )}

              <form onSubmit={handleLogWellness} className="space-y-5">
                <div>
                  <label className="text-xs font-mono text-white/60 block mb-2 uppercase">Select Dimension</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {[
                      { id: 'stress', label: 'Stress', icon: AlertTriangle },
                      { id: 'sleep', label: 'Sleep', icon: Moon },
                      { id: 'energy', label: 'Energy', icon: Zap },
                      { id: 'focus', label: 'Focus', icon: Target },
                      { id: 'workload', label: 'Workload', icon: Briefcase },
                      { id: 'activity', label: 'Activity', icon: Heart }
                    ].map((m) => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedMetric(m.id)}
                          className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                            selectedMetric === m.id
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                              : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-xs font-medium">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-mono text-white/60 uppercase">Intensity / Quality (1 to 10)</label>
                    <span className="text-sm font-black text-indigo-400 font-mono">{metricScore} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={metricScore}
                    onChange={(e) => setMetricScore(Number(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-white/60 block mb-2 uppercase">Optional Private Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Backlog study session went until 2am, mind feeling foggy"
                    value={metricNote}
                    onChange={(e) => setMetricNote(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-indigo-400"
                  />
                </div>

                {submitMessage && (
                  <div className="text-xs text-indigo-300 font-medium">{submitMessage}</div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-lg cursor-pointer"
                >
                  {isSubmitting ? 'Recording Check-in...' : 'Save Wellness Observation'}
                </button>
              </form>

              {/* Recent Wellness Logs (Editable & Deletable) */}
              {recentLogs.length > 0 && (
                <div className="pt-4 border-t border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-white/60 uppercase">
                    <span>Recent Wellness Records</span>
                    <span className="text-[10px] text-white/40">{recentLogs.length} saved</span>
                  </div>

                  <div className="space-y-2">
                    {recentLogs.map((log) => {
                      const isEditing = editingLogId === log.id;
                      return (
                        <div
                          key={log.id}
                          className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col gap-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white uppercase text-[11px] font-mono bg-white/5 px-2 py-0.5 rounded-md">
                                {log.metric_type}
                              </span>
                              {!isEditing ? (
                                <span className="font-mono text-indigo-300 font-bold">{log.score}/10</span>
                              ) : (
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={editScore}
                                  onChange={(e) => setEditScore(Number(e.target.value))}
                                  className="w-14 px-2 py-0.5 rounded bg-black/60 border border-indigo-400 text-white font-mono text-xs"
                                />
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-white/40 mr-1">
                                {log.created_at?.slice(0, 10)}
                              </span>
                              {isEditing ? (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateLog(log.id)}
                                  className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                                  title="Save edit"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingLogId(log.id);
                                    setEditScore(log.score || 5);
                                    setEditNote(log.note || '');
                                  }}
                                  className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10 cursor-pointer"
                                  title="Edit entry"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteLog(log.id)}
                                className="p-1 rounded text-white/40 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                title="Delete entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {!isEditing ? (
                            log.note && <p className="text-white/70 text-[11px] leading-relaxed">{log.note}</p>
                          ) : (
                            <input
                              type="text"
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              className="w-full px-2.5 py-1 rounded bg-black/60 border border-indigo-400 text-white text-xs"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
