import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Download, Trash2, Lock, EyeOff, AlertTriangle, Check, PauseCircle } from 'lucide-react';

interface PrivacyCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
  onAccountDeleted?: () => void;
}

const CONSENT_LABELS: Record<string, { label: string; desc: string }> = {
  ai_personalization: {
    label: 'AI Personalization & Digital Twin',
    desc: 'Allows MANAS to adapt conversational style and tone to your baseline.'
  },
  memory: {
    label: 'Long-Term Memory Center',
    desc: 'Retains important facts, preferred coping strategies, and milestones you choose to remember.'
  },
  photo_processing: {
    label: 'Photo Avatar Parameterization',
    desc: 'Analyzes skin tone and colors from a photo to style your 3D mascot. Photo is deleted immediately after processing (Zero Retention).'
  },
  voice_processing: {
    label: 'Voice Synthesis & Speech Processing',
    desc: 'Synthesizes speech using native Indian language voices. Voice samples are never stored without explicit approval.'
  },
  typing_analysis: {
    label: 'Typing Cadence Baseline',
    desc: 'Measures typing speed and pause duration to adapt conversational rhythm without storing raw keystrokes.'
  },
  voice_behavior_analysis: {
    label: 'Voice Speaking Pace Intelligence',
    desc: 'Observes speaking pace and pauses to sense fatigue relative to your personal baseline.'
  },
  proactive_checkins: {
    label: 'Evidence-Based Proactive Check-ins',
    desc: 'Allows gentle reminders if recent check-ins show sustained elevated strain.'
  },
  recommendations: {
    label: 'Intervention Recommendations',
    desc: 'Tailors breathing, grounding, and journaling suggestions based on what has proven helpful for you.'
  },
  trusted_contact_alert: {
    label: 'Trusted Contact Coordination',
    desc: 'Allows emergency contact notifications solely through your explicit initiation.'
  },
  data_retention: {
    label: 'Continuous Data Retention',
    desc: 'Enables saving your reflections across sessions. Revoking pauses history retention.'
  }
};

export const PrivacyCenterModal: React.FC<PrivacyCenterModalProps> = ({
  isOpen,
  onClose,
  token,
  onAccountDeleted
}) => {
  const [consents, setConsents] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [appPin, setAppPin] = useState(() => localStorage.getItem('manas_app_pin') || '');
  const [pinInput, setPinInput] = useState('');
  const [pinSavedMessage, setPinSavedMessage] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchConsents = async () => {
    setIsLoading(true);
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch('/api/privacy/consents', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setConsents(data.consents || {});
      }
    } catch (_) {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConsents();
    }
  }, [isOpen, token]);

  const handleToggleConsent = async (consentType: string) => {
    const currentVal = consents[consentType] ?? 1;
    const newVal = currentVal === 1 ? 0 : 1;
    setConsents((prev) => ({ ...prev, [consentType]: newVal }));

    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      await fetch('/api/privacy/consents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          consent_type: consentType,
          granted: newVal === 1
        })
      });
    } catch (_) {}
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch('/api/privacy/export', {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `emoticare_manas_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (_) {
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch('/api/privacy/delete-account', {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      if (res.ok) {
        localStorage.clear();
        if (onAccountDeleted) onAccountDeleted();
        window.location.reload();
      }
    } catch (_) {
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.length === 4) {
      localStorage.setItem('manas_app_pin', pinInput);
      setAppPin(pinInput);
      setPinInput('');
      setPinSavedMessage('4-digit PIN configured successfully!');
      setTimeout(() => setPinSavedMessage(''), 3000);
    }
  };

  const handleRemovePin = () => {
    localStorage.removeItem('manas_app_pin');
    setAppPin('');
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
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Privacy Center & Data Controls
                </h2>
                <p className="text-xs text-white/50">Granular consent, zero-PII storage & irreversible erasure (DPDP Act)</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="my-6 space-y-6">
            {/* App Lock / Local PIN Protection */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-white">
                <Lock className="w-4 h-4 text-cyan-400" />
                <span>Client-Side App Lock PIN</span>
              </div>
              <p className="text-[11px] text-white/60 mb-3">
                Require a 4-digit PIN before viewing private journals and emotional history on this device.
              </p>
              {appPin ? (
                <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl">
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> PIN Protection Active (••••)
                  </span>
                  <button
                    onClick={handleRemovePin}
                    className="text-xs text-rose-400 hover:underline cursor-pointer"
                  >
                    Remove PIN
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSavePin} className="flex gap-2">
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="Enter 4 digits"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    className="w-32 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono text-center tracking-widest focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="submit"
                    disabled={pinInput.length !== 4}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-black font-bold text-xs cursor-pointer transition-colors"
                  >
                    Set PIN
                  </button>
                </form>
              )}
              {pinSavedMessage && (
                <span className="text-[11px] text-cyan-300 font-medium block mt-2">{pinSavedMessage}</span>
              )}
            </div>

            {/* Granular Consents */}
            <div className="space-y-3">
              <h3 className="text-xs font-mono text-white/50 uppercase tracking-wider">Granular Opt-In Consents</h3>
              {Object.entries(CONSENT_LABELS).map(([key, info]) => {
                const isGranted = (consents[key] ?? 1) === 1;
                return (
                  <div
                    key={key}
                    className="flex items-start justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all"
                  >
                    <div className="max-w-[80%]">
                      <span className="text-xs font-semibold text-white block">{info.label}</span>
                      <span className="text-[11px] text-white/50 leading-relaxed block mt-0.5">{info.desc}</span>
                    </div>
                    <button
                      onClick={() => handleToggleConsent(key)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out mt-1 ${
                        isGranted ? 'bg-cyan-500' : 'bg-white/20'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-200 ease-in-out mt-[3px] ml-[3px] ${
                          isGranted ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Data Portability & Account Erasure */}
            <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                onClick={handleExportData}
                disabled={isExporting}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                {isExporting ? 'Generating Archive...' : 'Export My Data (JSON)'}
              </button>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-semibold text-rose-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete My Entire Account
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    {isDeleting ? 'Erasing...' : 'Confirm Permanent Deletion'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
