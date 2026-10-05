import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Bell,
  Check,
  Shield,
  Clock,
  Moon,
  Sparkles,
  Wind,
  BookOpen,
  Target,
  Send,
  AlertCircle,
  Volume2,
} from 'lucide-react';
import {
  getPushSubscriptionStatus,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from '../../lib/push/pushService';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
}

interface PreferencesState {
  enabled: boolean;
  types: string[];
  preferred_time: string;
  frequency: string;
  quiet_hours_start: string;
  quiet_hours_end: string;
  language: string;
}

const TYPE_OPTIONS = [
  { id: 'checkin', label: 'Daily Check-in', desc: 'Gentle morning or midday check-in on how you are feeling', icon: Sparkles },
  { id: 'breathing', label: 'Guided Breathing', desc: 'Reminders for a short 2-minute box breathing reset', icon: Wind },
  { id: 'journal', label: 'Reflective Journal', desc: 'Evening invitation to jot down a quick daily thought', icon: BookOpen },
  { id: 'goals', label: 'Goals & Intentions', desc: 'Encouraging nudges towards your personal wellness targets', icon: Target },
];

const FREQUENCY_OPTIONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'twice_daily', label: 'Twice a Day' },
  { id: 'weekly', label: 'Weekly' },
];

const LANGUAGE_OPTIONS = [
  { id: 'en', label: 'English' },
  { id: 'ta', label: 'தமிழ் (Tamil)' },
  { id: 'hi', label: 'हिन्दी (Hindi)' },
  { id: 'te', label: 'తెలుగు (Telugu)' },
  { id: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { id: 'ml', label: 'മലയാളം (Malayalam)' },
  { id: 'bn', label: 'বাংলা (Bengali)' },
  { id: 'mr', label: 'मराठी (Marathi)' },
];

export const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
  isOpen,
  onClose,
  token,
}) => {
  const [prefs, setPrefs] = useState<PreferencesState>({
    enabled: true,
    types: ['checkin', 'breathing', 'journal', 'goals'],
    preferred_time: '09:00',
    frequency: 'daily',
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    language: 'en',
  });

  const [pushStatus, setPushStatus] = useState<{
    isSupported: boolean;
    permission: NotificationPermission;
    isSubscribed: boolean;
  }>({
    isSupported: false,
    permission: 'default',
    isSubscribed: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [testPushStatus, setTestPushStatus] = useState<string | null>(null);

  // Load preferences and push status on open
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        const authToken = token || localStorage.getItem('manas_access_token');
        const res = await fetch('/api/notifications/preferences', {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setPrefs({
            enabled: data.enabled ?? true,
            types: Array.isArray(data.types) ? data.types : ['checkin', 'breathing', 'journal', 'goals'],
            preferred_time: data.preferred_time || '09:00',
            frequency: data.frequency || 'daily',
            quiet_hours_start: data.quiet_hours_start || '22:00',
            quiet_hours_end: data.quiet_hours_end || '08:00',
            language: data.language || 'en',
          });
        }
      } catch (err) {
        console.warn('Failed to load notification preferences:', err);
      }

      const status = await getPushSubscriptionStatus();
      setPushStatus(status);
    };

    loadData();
  }, [isOpen, token]);

  const handleToggleType = (typeId: string) => {
    setPrefs((prev) => {
      const exists = prev.types.includes(typeId);
      const nextTypes = exists
        ? prev.types.filter((t) => t !== typeId)
        : [...prev.types, typeId];
      return { ...prev, types: nextTypes };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(prefs),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err) {
      console.error('Error saving notification preferences:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePush = async () => {
    setPushLoading(true);
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      if (pushStatus.isSubscribed) {
        await unsubscribeFromPushNotifications(authToken || undefined);
      } else {
        await subscribeToPushNotifications(authToken || undefined);
      }
      const updated = await getPushSubscriptionStatus();
      setPushStatus(updated);
    } catch (err) {
      console.error('Push toggle error:', err);
    } finally {
      setPushLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    setTestPushStatus('sending');
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch('/api/notifications/test-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          title: 'Daily Check-in',
          message: 'Time for your check-in with your companion.',
        }),
      });
      if (res.ok) {
        setTestPushStatus('sent');
      } else {
        setTestPushStatus('failed');
      }
    } catch (_) {
      setTestPushStatus('failed');
    }
    setTimeout(() => setTestPushStatus(null), 3000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="w-full max-w-2xl max-h-[90vh] bg-gradient-to-b from-[#131722] to-[#0b0e14] border border-cyan-500/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-400">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                    Notification Preferences
                  </h2>
                  <p className="text-xs text-slate-400">
                    Control how, when, and where your gentle reminders arrive
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
              {/* Master Toggle */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Enable Notifications</div>
                  <div className="text-xs text-slate-400">
                    Allow gentle wellness nudges, check-ins, and reminders
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, enabled: !p.enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    prefs.enabled ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      prefs.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Web Push Card */}
              <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Volume2 className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="font-semibold text-white">Web Push Notifications</div>
                      <div className="text-xs text-slate-400">
                        Receive lock-screen alerts even when the app is closed
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${
                      pushStatus.isSubscribed
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : pushStatus.permission === 'denied'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    }`}
                  >
                    {pushStatus.isSubscribed
                      ? 'Subscribed'
                      : pushStatus.permission === 'denied'
                      ? 'Blocked by browser'
                      : 'Not enabled'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    onClick={handleTogglePush}
                    disabled={pushLoading || pushStatus.permission === 'denied'}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      pushStatus.isSubscribed
                        ? 'bg-white/10 hover:bg-white/15 text-slate-300'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-black font-semibold'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {pushLoading
                      ? 'Processing...'
                      : pushStatus.isSubscribed
                      ? 'Unsubscribe Push'
                      : 'Enable Browser Push'}
                  </button>

                  {pushStatus.isSubscribed && (
                    <button
                      onClick={handleSendTestPush}
                      disabled={testPushStatus === 'sending'}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-cyan-300 border border-cyan-500/30 cursor-pointer flex items-center gap-1.5 transition-colors"
                    >
                      <Send className="w-3 h-3" />
                      {testPushStatus === 'sending'
                        ? 'Sending...'
                        : testPushStatus === 'sent'
                        ? 'Sent!'
                        : testPushStatus === 'failed'
                        ? 'Failed'
                        : 'Test Push'}
                    </button>
                  )}
                </div>

                {/* Privacy Guarantee Alert */}
                <div className="flex items-start gap-2.5 pt-2 text-xs text-slate-400 bg-black/20 p-2.5 rounded-lg border border-white/5">
                  <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-200">Zero-PII Privacy: </span>
                    Notifications never reveal sensitive feelings, notes, or mental health terms. Lock-screen messages strictly use neutral phrases like &quot;Time for your check-in&quot;.
                  </div>
                </div>
              </div>

              {/* Notification Types */}
              <div className="space-y-3">
                <div className="font-semibold text-white">Notification Types</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {TYPE_OPTIONS.map((item) => {
                    const Icon = item.icon;
                    const isSelected = prefs.types.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleType(item.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                            : 'bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                            <span className="font-medium text-xs text-white">{item.label}</span>
                          </div>
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                              isSelected
                                ? 'bg-cyan-500 border-cyan-400 text-black'
                                : 'border-slate-600 bg-transparent'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Time & Frequency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    Preferred Delivery Time
                  </label>
                  <input
                    type="time"
                    value={prefs.preferred_time}
                    onChange={(e) => setPrefs((p) => ({ ...p, preferred_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Frequency</label>
                  <select
                    value={prefs.frequency}
                    onChange={(e) => setPrefs((p) => ({ ...p, frequency: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#131722] border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                  >
                    {FREQUENCY_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id} className="bg-[#131722] text-white">
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quiet Hours */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Moon className="w-4 h-4 text-indigo-400" />
                  Quiet Hours (Do Not Disturb)
                </div>
                <p className="text-xs text-slate-400">
                  During quiet hours, push notifications will be suppressed completely to protect your rest.
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">Starts At</label>
                    <input
                      type="time"
                      value={prefs.quiet_hours_start}
                      onChange={(e) => setPrefs((p) => ({ ...p, quiet_hours_start: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">Ends At</label>
                    <input
                      type="time"
                      value={prefs.quiet_hours_end}
                      onChange={(e) => setPrefs((p) => ({ ...p, quiet_hours_end: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>
              </div>

              {/* Language Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Notification Language</label>
                <select
                  value={prefs.language}
                  onChange={(e) => setPrefs((p) => ({ ...p, language: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-[#131722] border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                >
                  {LANGUAGE_OPTIONS.map((l) => (
                    <option key={l.id} value={l.id} className="bg-[#131722] text-white">
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
              {saveSuccess ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <Check className="w-4 h-4" />
                  Preferences saved successfully
                </div>
              ) : (
                <div className="text-xs text-slate-500">Changes apply immediately to upcoming reminders</div>
              )}

              <div className="flex items-center gap-2.5">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-black transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
