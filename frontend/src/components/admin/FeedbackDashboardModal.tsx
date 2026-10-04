import React, { useState, useEffect } from 'react';
import { X, ThumbsDown, MessageSquareHeart, ThumbsUp, ShieldCheck, ShieldAlert, RefreshCw, Filter } from 'lucide-react';

interface FeedbackItem {
  id: string;
  message_id: string;
  user_id: string;
  rating: string;
  user_message: string;
  bot_reply: string;
  strategy: string;
  user_consent: number;
  notes: string;
  created_at: string;
}

interface FeedbackDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackDashboardModal: React.FC<FeedbackDashboardModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filter, setFilter] = useState<'all' | 'negative'>('negative');

  const fetchFeedback = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/feedback');
      if (res.ok) {
        const data = await res.json();
        setFeedbackList(data.feedback || []);
      }
    } catch (err) {
      console.error('Failed to fetch feedback:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFeedback();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const total = feedbackList.length;
  const thumbsUpCount = feedbackList.filter((f) => f.rating === 'thumbs_up').length;
  const thumbsDownCount = feedbackList.filter((f) => f.rating === 'thumbs_down').length;
  const notUnderstoodCount = feedbackList.filter((f) => f.rating === 'not_understood').length;

  const displayedList = feedbackList.filter((item) => {
    if (filter === 'negative') {
      return item.rating === 'thumbs_down' || item.rating === 'not_understood';
    }
    return true;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
    >
      <div className="bg-white border border-[#0A0A0A]/10 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#0A0A0A]/8 flex items-center justify-between bg-[#FDFBF7]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-widest text-[#8B5CF6] font-bold">
                CLINICAL AUDIT & REFINEMENT
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#0A0A0A] font-serif">
              Empathy & Feedback Dashboard
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchFeedback}
              disabled={isLoading}
              className="p-2 rounded-full hover:bg-black/5 transition-colors cursor-pointer text-[#0A0A0A]/60"
              title="Refresh feedback"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-black/5 transition-colors cursor-pointer text-[#0A0A0A]/60"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Aggregate Stats Cards */}
        <div className="p-6 bg-white border-b border-[#0A0A0A]/6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[#FDFBF7] border border-[#0A0A0A]/6">
            <div className="text-xs font-mono text-[#0A0A0A]/50">TOTAL RATINGS</div>
            <div className="text-2xl font-bold text-[#0A0A0A] mt-1">{total}</div>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
            <div className="text-xs font-mono text-emerald-800 flex items-center gap-1">
              <ThumbsUp className="w-3.5 h-3.5" /> FELT HELPFUL
            </div>
            <div className="text-2xl font-bold text-emerald-900 mt-1">{thumbsUpCount}</div>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100">
            <div className="text-xs font-mono text-rose-800 flex items-center gap-1">
              <ThumbsDown className="w-3.5 h-3.5" /> NOT HELPFUL
            </div>
            <div className="text-2xl font-bold text-rose-900 mt-1">{thumbsDownCount}</div>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
            <div className="text-xs font-mono text-amber-800 flex items-center gap-1">
              <MessageSquareHeart className="w-3.5 h-3.5" /> NOT UNDERSTOOD
            </div>
            <div className="text-2xl font-bold text-amber-900 mt-1">{notUnderstoodCount}</div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 bg-[#FDFBF7] border-b border-[#0A0A0A]/6 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#0A0A0A]/40" />
            <span className="font-mono text-[#0A0A0A]/60 font-bold">VIEW:</span>
            <button
              type="button"
              onClick={() => setFilter('negative')}
              className={`px-3 py-1 rounded-full font-mono transition-all cursor-pointer ${
                filter === 'negative'
                  ? 'bg-rose-100 text-rose-900 font-bold'
                  : 'bg-white border border-[#0A0A0A]/10 text-[#0A0A0A]/60'
              }`}
            >
              Worst-Rated Replies ({thumbsDownCount + notUnderstoodCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-full font-mono transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-purple-100 text-purple-900 font-bold'
                  : 'bg-white border border-[#0A0A0A]/10 text-[#0A0A0A]/60'
              }`}
            >
              All Feedback ({total})
            </button>
          </div>
          <div className="text-[11px] font-mono text-[#0A0A0A]/40">
            Privacy: Only consented messages show text content
          </div>
        </div>

        {/* Table / List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {displayedList.length === 0 ? (
            <div className="text-center py-12 text-[#0A0A0A]/40 font-mono text-sm">
              No feedback entries matching filter.
            </div>
          ) : (
            displayedList.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-white border border-[#0A0A0A]/10 shadow-xs space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    {item.rating === 'thumbs_up' && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3" /> Helpful
                      </span>
                    )}
                    {item.rating === 'thumbs_down' && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-mono font-bold flex items-center gap-1">
                        <ThumbsDown className="w-3 h-3" /> Not Helpful
                      </span>
                    )}
                    {item.rating === 'not_understood' && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono font-bold flex items-center gap-1">
                        <MessageSquareHeart className="w-3 h-3" /> Didn't Feel Understood
                      </span>
                    )}
                    {item.strategy && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-mono text-[11px]">
                        Strategy: {item.strategy}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono text-[#0A0A0A]/40">
                    {item.user_consent === 1 ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Consented for Review
                      </span>
                    ) : (
                      <span className="text-amber-700 flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" /> Private (No Text Stored)
                      </span>
                    )}
                    <span>{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {item.user_consent === 1 ? (
                  <div className="space-y-2 text-sm">
                    {item.user_message && (
                      <div className="p-3 rounded-xl bg-[#FDFBF7] border border-[#0A0A0A]/6">
                        <div className="text-[10px] font-mono uppercase text-[#0A0A0A]/40 font-bold mb-1">
                          User Utterance
                        </div>
                        <div className="text-[#0A0A0A] italic">"{item.user_message}"</div>
                      </div>
                    )}
                    {item.bot_reply && (
                      <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100">
                        <div className="text-[10px] font-mono uppercase text-purple-700 font-bold mb-1">
                          Bot Reply Under Review
                        </div>
                        <div className="text-[#0A0A0A]">{item.bot_reply}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500 font-mono">
                    Text withheld per privacy consent settings. Rating counted for statistical tracking.
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
