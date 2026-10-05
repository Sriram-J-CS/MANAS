import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Bell,
  CheckCircle2,
  Trash2,
  Sliders,
  Sparkles,
  Wind,
  BookOpen,
  Target,
  Calendar,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface InAppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  action_url?: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPreferences: () => void;
  onNavigateAction?: (url: string) => void;
  token?: string;
}

const TYPE_ICONS: Record<string, any> = {
  checkin: Sparkles,
  breathing: Wind,
  journal: BookOpen,
  goals: Target,
  reminder: Clock,
};

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  onOpenPreferences,
  onNavigateAction,
  token,
}) => {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch('/api/notifications', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (_) {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, token]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      await fetch(`/api/notifications/read/${id}`, {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (_) {}
  };

  const handleMarkAllRead = async () => {
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (_) {}
  };

  const handleDeleteNotif = async (id: string) => {
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (_) {}
  };

  const handleActionClick = (notif: InAppNotification) => {
    if (!notif.is_read) {
      handleMarkAsRead(notif.id);
    }
    if (notif.action_url && onNavigateAction) {
      onNavigateAction(notif.action_url);
      onClose();
    }
  };

  if (!isOpen) return null;

  const filteredNotifs =
    filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative w-full max-w-xl max-h-[85vh] overflow-hidden rounded-3xl bg-[#0F1117] border border-white/10 text-white shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[11px] font-mono font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </h2>
                <p className="text-xs text-white/50">Neutral, privacy-preserving alerts & reminders</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenPreferences}
                className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                title="Notification Preferences"
              >
                <Sliders className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Subheader controls */}
          <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.02] text-xs">
            <div className="flex gap-1.5">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                  filter === 'all'
                    ? 'bg-white text-black font-bold shadow'
                    : 'bg-white/5 text-white/60 hover:text-white'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                  filter === 'unread'
                    ? 'bg-white text-black font-bold shadow'
                    : 'bg-white/5 text-white/60 hover:text-white'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-cyan-400 hover:text-cyan-300 text-xs font-mono font-semibold flex items-center gap-1 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
            {isLoading ? (
              <div className="py-16 text-center text-xs font-mono text-white/40">
                Checking notifications...
              </div>
            ) : filteredNotifs.length === 0 ? (
              <div className="py-16 text-center text-white/50 text-xs space-y-2">
                <Bell className="w-8 h-8 text-white/20 mx-auto mb-2" />
                <p className="font-semibold text-white/70">No notifications right now</p>
                <p className="text-[11px] text-white/40 max-w-xs mx-auto">
                  You're all caught up. Check-in reminders and scheduled pauses will appear here.
                </p>
              </div>
            ) : (
              filteredNotifs.map((n) => {
                const Icon = TYPE_ICONS[n.type] || Sparkles;
                return (
                  <div
                    key={n.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 text-xs ${
                      n.is_read
                        ? 'bg-white/[0.02] border-white/5 opacity-75'
                        : 'bg-cyan-950/20 border-cyan-500/30'
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold text-white tracking-tight truncate">{n.title}</h4>
                          <span className="text-[10px] text-white/40 font-mono shrink-0 ml-2">
                            {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                          </span>
                        </div>
                        <p className="text-white/70 text-[11px] leading-relaxed mb-2.5 font-sans">
                          {n.message}
                        </p>
                        {n.action_url && (
                          <button
                            onClick={() => handleActionClick(n)}
                            className="inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:text-white font-mono font-bold tracking-wide transition-colors cursor-pointer"
                          >
                            <span>Open</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteNotif(n.id)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                      title="Delete notification"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
