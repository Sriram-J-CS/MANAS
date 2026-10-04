import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Target, Calendar, Sparkles, Plus, Trash2, CheckCircle2, Lock, ArrowUpRight } from 'lucide-react';

interface JournalAndGoalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
  initialTab?: 'journal' | 'goals' | 'future' | 'reflection';
}

export const JournalAndGoalsModal: React.FC<JournalAndGoalsModalProps> = ({
  isOpen,
  onClose,
  token,
  initialTab = 'journal'
}) => {
  const [activeTab, setActiveTab] = useState<'journal' | 'goals' | 'future' | 'reflection'>(initialTab);

  // Journal state
  const [journals, setJournals] = useState<any[]>([]);
  const [jTitle, setJTitle] = useState('');
  const [jContent, setJContent] = useState('');
  const [jPrivate, setJPrivate] = useState(false);
  const [jMood, setJMood] = useState(3);
  const [isSavingJournal, setIsSavingJournal] = useState(false);

  // Goals state
  const [goals, setGoals] = useState<any[]>([]);
  const [gTitle, setGTitle] = useState('');
  const [gCategory, setGCategory] = useState('mindfulness');
  const [isSavingGoal, setIsSavingGoal] = useState(false);

  // Future Self state
  const [futureEntries, setFutureEntries] = useState<any[]>([]);
  const [fAspirations, setFAspirations] = useState('');
  const [fHabits, setFHabits] = useState('');
  const [fHorizon, setFHorizon] = useState('6_months');
  const [isSavingFuture, setIsSavingFuture] = useState(false);

  // Weekly reflection state
  const [reflection, setReflection] = useState<any>(null);

  const fetchAllData = async () => {
    const authToken = token || localStorage.getItem('manas_access_token');
    const headers: HeadersInit = authToken ? { Authorization: `Bearer ${authToken}` } : {};

    try {
      // 1. Journal
      const jRes = await fetch('/api/journal', { headers });
      if (jRes.ok) {
        const jData = await jRes.json();
        setJournals(jData.entries || []);
      }

      // 2. Goals
      const gRes = await fetch('/api/goals', { headers });
      if (gRes.ok) {
        const gData = await gRes.json();
        setGoals(gData.goals || []);
      }

      // 3. Future Self
      const fRes = await fetch('/api/future-self', { headers });
      if (fRes.ok) {
        const fData = await fRes.json();
        setFutureEntries(fData.entries || []);
      }

      // 4. Weekly Reflection
      const rRes = await fetch('/api/reflections/weekly', { headers });
      if (rRes.ok) {
        const rData = await rRes.json();
        setReflection(rData);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchAllData();
    }
  }, [isOpen, token]);

  const handleSaveJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jContent.trim()) return;
    setIsSavingJournal(true);
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          title: jTitle || 'Daily Reflection',
          content: jContent.trim(),
          is_private: jPrivate,
          mood_score: jMood
        })
      });
      if (res.ok) {
        setJTitle('');
        setJContent('');
        fetchAllData();
      }
    } catch (_) {
    } finally {
      setIsSavingJournal(false);
    }
  };

  const handleDeleteJournal = async (id: string) => {
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      await fetch(`/api/journal/${id}`, {
        method: 'DELETE',
        headers: (authToken ? { Authorization: `Bearer ${authToken}` } : {}) as HeadersInit
      });
      fetchAllData();
    } catch (_) {}
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gTitle.trim()) return;
    setIsSavingGoal(true);
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ title: gTitle.trim(), category: gCategory })
      });
      if (res.ok) {
        setGTitle('');
        fetchAllData();
      }
    } catch (_) {
    } finally {
      setIsSavingGoal(false);
    }
  };

  const handleUpdateGoalProgress = async (id: string, progress: number, status?: string) => {
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      await fetch(`/api/goals/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ progress_pct: progress, status })
      });
      fetchAllData();
    } catch (_) {}
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      await fetch(`/api/goals/${id}`, {
        method: 'DELETE',
        headers: (authToken ? { Authorization: `Bearer ${authToken}` } : {}) as HeadersInit
      });
      fetchAllData();
    } catch (_) {}
  };

  const handleSaveFutureSelf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fAspirations.trim()) return;
    setIsSavingFuture(true);
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch('/api/future-self', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          horizon: fHorizon,
          aspirations: fAspirations.trim(),
          habits_commitment: fHabits.trim()
        })
      });
      if (res.ok) {
        setFAspirations('');
        setFHabits('');
        fetchAllData();
      }
    } catch (_) {
    } finally {
      setIsSavingFuture(false);
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
          className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0F1117] border border-white/10 text-white shadow-2xl p-6 sm:p-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">Journal, Goals & Growth</h2>
                <p className="text-xs text-white/50">Self-reflection, habit milestones & future aspirations</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-2 my-5">
            {[
              { id: 'journal', label: 'Mindful Journal', icon: BookOpen },
              { id: 'goals', label: 'Goals & Habits', icon: Target },
              { id: 'future', label: 'Future Self', icon: Sparkles },
              { id: 'reflection', label: 'Weekly Synthesis', icon: Calendar },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-white text-black shadow-lg'
                      : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab 1: Journal */}
          {activeTab === 'journal' && (
            <div className="space-y-6">
              <form onSubmit={handleSaveJournal} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <span className="text-[11px] font-mono text-white/40 uppercase block">New Reflection Entry</span>
                <input
                  type="text"
                  placeholder="Title (optional)"
                  value={jTitle}
                  onChange={(e) => setJTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-violet-400"
                />
                <textarea
                  rows={3}
                  placeholder="Put your thoughts here freely without editing..."
                  value={jContent}
                  onChange={(e) => setJContent(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-violet-400"
                />
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-4 text-xs text-white/60">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={jPrivate}
                        onChange={(e) => setJPrivate(e.target.checked)}
                        className="rounded border-white/20 accent-violet-500"
                      />
                      <Lock className="w-3 h-3 text-violet-400" /> Private (Exclude from AI prompts)
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={isSavingJournal || !jContent.trim()}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    {isSavingJournal ? 'Saving...' : 'Save Entry'}
                  </button>
                </div>
              </form>

              {journals.length === 0 ? (
                <div className="text-center py-10 text-xs text-white/40 font-mono">
                  No journal entries logged yet. Write your first reflection above.
                </div>
              ) : (
                <div className="space-y-3">
                  {journals.map((j) => (
                    <div key={j.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">{j.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-white/40">{j.created_at?.slice(0, 10)}</span>
                          <button
                            onClick={() => handleDeleteJournal(j.id)}
                            className="p-1 rounded text-white/30 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-white/80 leading-relaxed whitespace-pre-wrap">{j.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Goals */}
          {activeTab === 'goals' && (
            <div className="space-y-6">
              <form onSubmit={handleSaveGoal} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="e.g. 10 minutes of morning meditation"
                  value={gTitle}
                  onChange={(e) => setGTitle(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-violet-400"
                />
                <select
                  value={gCategory}
                  onChange={(e) => setGCategory(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white/80 focus:outline-none focus:border-violet-400"
                >
                  <option value="mindfulness">Mindfulness</option>
                  <option value="academics">Academics / Career</option>
                  <option value="sleep">Sleep & Recovery</option>
                  <option value="physical">Physical Wellbeing</option>
                </select>
                <button
                  type="submit"
                  disabled={isSavingGoal || !gTitle.trim()}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Goal
                </button>
              </form>

              {goals.length === 0 ? (
                <div className="text-center py-10 text-xs text-white/40 font-mono">
                  No active goals set. Add a small, supportive milestone above.
                </div>
              ) : (
                <div className="space-y-3">
                  {goals.map((g) => (
                    <div key={g.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">{g.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 capitalize">
                            {g.category}
                          </span>
                          <button
                            onClick={() => handleDeleteGoal(g.id)}
                            className="p-1 rounded text-white/30 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={g.progress_pct || 0}
                          onChange={(e) => handleUpdateGoalProgress(g.id, Number(e.target.value))}
                          className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-500"
                        />
                        <span className="text-[11px] font-mono text-white/60 w-10 text-right">{g.progress_pct || 0}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Future Self */}
          {activeTab === 'future' && (
            <div className="space-y-6">
              <form onSubmit={handleSaveFutureSelf} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <span className="text-[11px] font-mono text-white/40 uppercase block">Project Your Future Equilibrium</span>
                <div className="flex gap-2">
                  <select
                    value={fHorizon}
                    onChange={(e) => setFHorizon(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white/80 focus:outline-none focus:border-violet-400"
                  >
                    <option value="3_months">3 Months Ahead</option>
                    <option value="6_months">6 Months Ahead</option>
                    <option value="1_year">1 Year Ahead</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  placeholder="What feelings and calm habits do you envision having established?"
                  value={fAspirations}
                  onChange={(e) => setFAspirations(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-violet-400"
                />
                <input
                  type="text"
                  placeholder="Key habit commitment (e.g. protect my sleep window no matter what)"
                  value={fHabits}
                  onChange={(e) => setFHabits(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-violet-400"
                />
                <button
                  type="submit"
                  disabled={isSavingFuture || !fAspirations.trim()}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  {isSavingFuture ? 'Anchoring...' : 'Anchor Future Vision'}
                </button>
              </form>

              {futureEntries.length > 0 && (
                <div className="space-y-3">
                  {futureEntries.map((fe) => (
                    <div key={fe.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-violet-400 uppercase tracking-widest">{fe.horizon?.replace('_', ' ')}</span>
                        <span className="text-[10px] font-mono text-white/40">{fe.created_at?.slice(0, 10)}</span>
                      </div>
                      <p className="text-white font-semibold">{fe.aspirations}</p>
                      {fe.habits_commitment && (
                        <p className="text-white/60 text-[11px]">Commitment: {fe.habits_commitment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Weekly Reflection */}
          {activeTab === 'reflection' && (
            <div className="space-y-4">
              {!reflection?.has_reflection ? (
                <div className="text-center py-12 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 p-6">
                  <Calendar className="w-8 h-8 text-violet-400 mx-auto mb-2 opacity-60" />
                  <h4 className="text-sm font-semibold text-white mb-1">No Weekly Synthesis Available Yet</h4>
                  <p className="text-xs text-white/50 max-w-sm mx-auto">
                    {reflection?.message || 'Check in with your mood or journal over the week to generate an evidence-based longitudinal summary.'}
                  </p>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4 text-xs">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="font-mono text-violet-400 uppercase tracking-wider text-[11px]">
                      Week Starting {reflection.week_start}
                    </span>
                    {reflection.average_mood_7d !== null && (
                      <span className="text-white/70">
                        7-Day Mood Average: <strong className="text-white font-mono">{reflection.average_mood_7d} / 5</strong>
                      </span>
                    )}
                  </div>

                  <p className="text-white/90 leading-relaxed text-sm">{reflection.summary_text}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <span className="font-bold text-emerald-400 block mb-1">Wins & Micro-Accomplishments</span>
                      <ul className="list-disc list-inside text-white/70 space-y-1">
                        {reflection.wins?.map((w: string, i: number) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>

                    <div className="p-3.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
                      <span className="font-bold text-violet-300 block mb-1">Next Week's Intentions</span>
                      <ul className="list-disc list-inside text-white/70 space-y-1">
                        {reflection.next_intentions?.map((n: string, i: number) => <li key={i}>{n}</li>)}
                      </ul>
                    </div>
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
