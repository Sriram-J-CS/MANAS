import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, Phone, UserCheck, Plus, Trash2, HeartHandshake, CheckCircle2, AlertTriangle } from 'lucide-react';

interface SafetyPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
  initialTab?: 'plan' | 'contacts' | 'directory';
}

export const SafetyPlanModal: React.FC<SafetyPlanModalProps> = ({
  isOpen,
  onClose,
  token,
  initialTab = 'plan'
}) => {
  const [activeTab, setActiveTab] = useState<'plan' | 'contacts' | 'directory'>(initialTab);

  // Safety plan state
  const [plan, setPlan] = useState<any>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [planMessage, setPlanMessage] = useState('');

  // Trusted contacts state
  const [contacts, setContacts] = useState<any[]>([]);
  const [cName, setCName] = useState('');
  const [cRelation, setCRelation] = useState('friend');
  const [cEmail, setCEmail] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cAlertConsent, setCAlertConsent] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);

  // Professional directory
  const [directory, setDirectory] = useState<any[]>([]);

  const fetchSafetyData = async () => {
    const authToken = token || localStorage.getItem('manas_access_token');
    const headers: HeadersInit = authToken ? { Authorization: `Bearer ${authToken}` } : {};

    try {
      // 1. Safety Plan
      const pRes = await fetch('/api/safety/plan', { headers });
      if (pRes.ok) {
        const pData = await pRes.json();
        setPlan(pData.plan || {});
      }

      // 2. Trusted Contacts
      const cRes = await fetch('/api/safety/trusted-contacts', { headers });
      if (cRes.ok) {
        const cData = await cRes.json();
        setContacts(cData.contacts || []);
      }

      // 3. Directory
      const dRes = await fetch('/api/safety/professional-directory');
      if (dRes.ok) {
        const dData = await dRes.json();
        setDirectory(dData.resources || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchSafetyData();
    }
  }, [isOpen, token]);

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPlan(true);
    setPlanMessage('');
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch('/api/safety/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify(plan)
      });
      if (res.ok) {
        setPlanMessage('Safety plan saved securely!');
        setTimeout(() => setPlanMessage(''), 3000);
      }
    } catch (_) {
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim()) return;
    setIsAddingContact(true);
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch('/api/safety/trusted-contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          name: cName.trim(),
          relationship: cRelation,
          email: cEmail.trim(),
          phone: cPhone.trim(),
          consent_to_alert: cAlertConsent
        })
      });
      if (res.ok) {
        setCName('');
        setCEmail('');
        setCPhone('');
        setCAlertConsent(false);
        fetchSafetyData();
      }
    } catch (_) {
    } finally {
      setIsAddingContact(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      await fetch(`/api/safety/trusted-contacts/${id}`, {
        method: 'DELETE',
        headers: (authToken ? { Authorization: `Bearer ${authToken}` } : {}) as HeadersInit
      });
      fetchSafetyData();
    } catch (_) {}
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
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">Help & Safety Architecture</h2>
                <p className="text-xs text-white/50">Personal safety plan, trusted contacts & Tele-MANAS 14416</p>
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
          <div className="flex gap-2 my-5">
            {[
              { id: 'plan', label: 'Safety Plan', icon: ShieldAlert },
              { id: 'contacts', label: 'Trusted Contacts', icon: UserCheck },
              { id: 'directory', label: 'Official Hotlines', icon: Phone },
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

          {/* Tab 1: Safety Plan */}
          {activeTab === 'plan' && (
            <div className="space-y-5 text-xs">
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-200 leading-relaxed">
                <strong>Emergency Priority:</strong> If you or someone you know is in immediate danger or having thoughts of self-harm, call <strong>Tele-MANAS (14416)</strong> or <strong>Emergency (112)</strong> immediately. You do not have to carry this alone.
              </div>

              {plan && (
                <form onSubmit={handleSavePlan} className="space-y-4">
                  {[
                    { key: 'warning_signs', label: '1. My Personal Warning Signs', placeholder: 'e.g. Canceling all plans, staying awake past 3am' },
                    { key: 'internal_coping', label: '2. Internal Coping Strategies (What I can do alone)', placeholder: 'e.g. 5 rounds of 4-7-8 breathing, splash cold water' },
                    { key: 'distraction_places', label: '3. Calming People & Places for Distraction', placeholder: 'e.g. Campus library, quiet tea stall, terrace' },
                    { key: 'safe_environment_steps', label: '4. Making My Environment Safe', placeholder: 'e.g. Step away from balconies, ask a friend to stay over' }
                  ].map((sec) => (
                    <div key={sec.key} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
                      <span className="font-bold text-white block">{sec.label}</span>
                      <textarea
                        rows={2}
                        value={(plan[sec.key] || []).join('\n')}
                        onChange={(e) => setPlan({ ...plan, [sec.key]: e.target.value.split('\n') })}
                        placeholder={sec.placeholder}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-rose-400"
                      />
                    </div>
                  ))}

                  {planMessage && <span className="text-xs text-rose-300 font-bold block">{planMessage}</span>}

                  <button
                    type="submit"
                    disabled={isSavingPlan}
                    className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-lg cursor-pointer"
                  >
                    {isSavingPlan ? 'Saving Plan...' : 'Save Personalized Safety Plan'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Tab 2: Trusted Contacts */}
          {activeTab === 'contacts' && (
            <div className="space-y-6">
              <form onSubmit={handleAddContact} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <span className="text-[11px] font-mono text-white/40 uppercase block">Add a Trusted Contact</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="Name"
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-rose-400"
                  />
                  <select
                    value={cRelation}
                    onChange={(e) => setCRelation(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 focus:outline-none focus:border-rose-400"
                  >
                    <option value="friend">Friend</option>
                    <option value="parent">Parent / Family</option>
                    <option value="mentor">Mentor / Counselor</option>
                    <option value="partner">Partner</option>
                  </select>
                  <input
                    type="tel"
                    placeholder="Phone (+91...)"
                    value={cPhone}
                    onChange={(e) => setCPhone(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-rose-400"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={cEmail}
                    onChange={(e) => setCEmail(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-rose-400"
                  />
                </div>
                <div className="flex items-center justify-between pt-1 text-xs">
                  <label className="flex items-center gap-2 text-white/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cAlertConsent}
                      onChange={(e) => setCAlertConsent(e.target.checked)}
                      className="rounded accent-rose-500"
                    />
                    <span>Allow emergency notification with my explicit approval</span>
                  </label>
                  <button
                    type="submit"
                    disabled={isAddingContact || !cName.trim()}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 inline mr-1" /> Add
                  </button>
                </div>
              </form>

              {contacts.length === 0 ? (
                <div className="text-center py-10 text-xs text-white/40 font-mono">
                  No trusted contacts registered. Add someone you trust above.
                </div>
              ) : (
                <div className="space-y-2">
                  {contacts.map((c) => (
                    <div key={c.id} className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{c.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/60 capitalize">
                            {c.relationship}
                          </span>
                        </div>
                        <span className="text-[11px] text-white/50 block mt-0.5">{c.phone || c.email}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteContact(c.id)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Official Professional Directory */}
          {activeTab === 'directory' && (
            <div className="space-y-3">
              <span className="text-[11px] font-mono text-white/40 uppercase block pl-1">
                Verified Indian Mental Health & Crisis Helplines (Govt. & Certified NGOs)
              </span>
              <div className="space-y-3">
                {directory.map((r, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-rose-500/30 transition-all text-xs">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div>
                        <h4 className="font-bold text-white text-sm">{r.name}</h4>
                        <span className="text-[11px] text-rose-400 font-mono font-bold">{r.availability}</span>
                      </div>
                      <a
                        href={`tel:${r.helpline.split(' ')[0]}`}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Call {r.helpline.split(' ')[0]}
                      </a>
                    </div>
                    <p className="text-white/60 text-[11px] leading-relaxed">{r.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
