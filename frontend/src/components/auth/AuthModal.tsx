import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Mail, User, Sparkles, AlertCircle, ArrowRight, CheckCircle2, Phone, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase, normalizePhone, isSmsTestMode } from '../../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: { user_id: string; name: string; email?: string; phone?: string }) => void;
  initialMode?: 'login' | 'signup' | 'otp';
}

/**
 * 6-box OTP entry component with auto-focus, paste, and backspace navigation.
 */
const OtpDigitsInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  const handleChange = (index: number, char: string) => {
    const clean = char.replace(/\D/g, '');
    if (!clean) {
      const next = digits.slice();
      next[index] = '';
      onChange(next.join('').trim());
      return;
    }
    const next = digits.slice();
    next[index] = clean.slice(-1);
    const combined = next.join('');
    onChange(combined);

    if (index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange(pasted);
      const targetIdx = Math.min(5, pasted.length - 1);
      inputsRef.current[targetIdx]?.focus();
    }
  };

  return (
    <div className="flex gap-2 sm:gap-2.5 justify-between w-full my-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          value={digits[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          autoFocus={i === 0}
          className="w-11 sm:w-12 h-14 text-center text-xl sm:text-2xl font-bold font-mono rounded-xl bg-white/5 border border-white/20 text-white focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 transition-all shadow-inner disabled:opacity-50"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
};

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = 'otp',
}) => {
  const [authMethod, setAuthMethod] = useState<'otp' | 'password'>('otp');
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode === 'signup' ? 'signup' : 'login');

  // Phone OTP state
  const [phone, setPhone] = useState('+91 ');
  const [name, setName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Email & Password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Status states
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Countdown timer for 60s Supabase rate limit
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  if (!isOpen) return null;

  // ── Dispatch Phone OTP via Supabase ──────────────────────────────────────
  const handleSendPhoneOtp = async () => {
    setError(null);
    setSuccessMsg(null);

    const formatted = normalizePhone(phone);
    if (formatted.length < 12) {
      setError('Please enter a valid mobile number with country code (e.g. +91 9876543210).');
      return;
    }

    setLoading(true);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        phone: formatted,
        options: {
          data: {
            name: name.trim() || undefined,
          },
        },
      });

      if (otpErr) {
        if (otpErr.message.includes('rate limit') || otpErr.message.includes('once every')) {
          throw new Error('Too many requests. Please wait 60 seconds before requesting another code.');
        }
        throw new Error(otpErr.message || 'Failed to dispatch verification code.');
      }

      setOtpSent(true);
      setResendCooldown(60);
      setOtpCode('');
      setSuccessMsg(`6-digit code dispatched to ${formatted}. Valid for 10 minutes.`);
    } catch (err: any) {
      setError(err.message || 'An error occurred while sending OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ── Verify 6-Digit Phone OTP via Supabase ─────────────────────────────────
  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const formatted = normalizePhone(phone);
    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({
        phone: formatted,
        token: cleanCode,
        type: 'sms',
      });

      if (verifyErr) {
        if (verifyErr.message.includes('expired')) {
          throw new Error('The code has expired. Please request a new code.');
        }
        throw new Error('Invalid verification code. Please check the 6 digits and try again.');
      }

      if (!data.session || !data.user) {
        throw new Error('Authentication succeeded but session could not be established.');
      }

      const verifiedUser = data.user;
      const userName = (verifiedUser.user_metadata?.name as string) || name.trim() || 'Friend';

      // Update name in user metadata if provided
      if (name.trim()) {
        try {
          await supabase.auth.updateUser({ data: { name: name.trim() } });
        } catch (_) {}
      }

      setSuccessMsg('Identity verified! Entering your MANAS sanctuary... 🌿');

      setTimeout(() => {
        onAuthSuccess({
          user_id: verifiedUser.id,
          name: userName,
          email: verifiedUser.email,
          phone: verifiedUser.phone,
        });
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the 6 digits.');
    } finally {
      setLoading(false);
    }
  };

  // ── Email & Password Authentication via Supabase ─────────────────────────
  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: signErr } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              name: name.trim(),
            },
          },
        });

        if (signErr) {
          throw new Error(signErr.message);
        }

        if (data.session && data.user) {
          setSuccessMsg('Account created successfully! Welcome to MANAS.');
          setTimeout(() => {
            onAuthSuccess({
              user_id: data.user!.id,
              name: name.trim(),
              email: data.user!.email,
            });
            onClose();
          }, 700);
        } else {
          setSuccessMsg('Verification link sent! Please check your email to complete registration.');
        }
      } else {
        const { data, error: logErr } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (logErr) {
          if (logErr.message.includes('Invalid login credentials')) {
            throw new Error('Invalid email or password. Please try again.');
          }
          throw new Error(logErr.message);
        }

        if (!data.user) {
          throw new Error('Failed to retrieve user profile.');
        }

        const userName = (data.user.user_metadata?.name as string) || 'Friend';
        setSuccessMsg('Welcome back! Loading your companion...');
        setTimeout(() => {
          onAuthSuccess({
            user_id: data.user.id,
            name: userName,
            email: data.user.email,
          });
          onClose();
        }, 700);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-md bg-[#0F1015] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl text-white font-sans overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="relative z-10 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xs font-mono uppercase tracking-widest text-violet-400 font-bold">
              MANAS IDENTITY
            </span>
          </div>
          <h2 className="text-2xl font-bold font-serif tracking-tight">
            {authMethod === 'otp' ? 'Phone OTP Sign In' : mode === 'login' ? 'Welcome Back' : 'Create Your Space'}
          </h2>
          <p className="text-xs text-white/60 mt-1">
            {authMethod === 'otp'
              ? 'Instant verification via Supabase Phone OTP.'
              : 'Secure credentials with cryptographic user isolation.'}
          </p>
        </div>

        {/* Method Switcher Tabs: Phone OTP vs Email & password */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mb-5 text-xs font-mono">
          <button
            type="button"
            onClick={() => {
              setAuthMethod('otp');
              setError(null);
            }}
            className={`py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              authMethod === 'otp'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Phone OTP</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMethod('password');
              setError(null);
            }}
            className={`py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              authMethod === 'password'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email & password</span>
          </button>
        </div>

        {/* Error / Success Alerts */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ── TAB 1: PHONE OTP FLOW ──────────────────────────────────────── */}
        {authMethod === 'otp' && (
          <form onSubmit={handleVerifyPhoneOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-white/60 mb-1.5">
                Mobile Number
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-violet-500 font-mono transition-colors"
                  />
                </div>
                <button
                  type="button"
                  disabled={loading || resendCooldown > 0}
                  onClick={handleSendPhoneOtp}
                  className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-mono font-semibold text-white disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                >
                  {resendCooldown > 0 ? (
                    <span>{resendCooldown}s</span>
                  ) : (
                    <>
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                      <span>{otpSent ? 'Resend' : 'Send Code'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-white/60 mb-1">
                Your Name (Optional)
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 text-xs focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            </div>

            {isSmsTestMode && (
              <div className="p-2.5 rounded-xl bg-violet-950/40 border border-violet-800/40 text-[11px] text-violet-300 font-mono flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-violet-400" />
                <span>SMS Test Mode active: supports Supabase test numbers.</span>
              </div>
            )}

            {otpSent && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4 pt-2"
              >
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-violet-300 mb-1.5 flex items-center justify-between">
                    <span>Enter 6-Digit Code</span>
                    <span className="text-[10px] text-white/40 normal-case">Check your SMS</span>
                  </label>
                  <OtpDigitsInput
                    value={otpCode}
                    onChange={setOtpCode}
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 transition-all cursor-pointer disabled:opacity-50 mt-4"
                >
                  {loading ? (
                    <span>Verifying code...</span>
                  ) : (
                    <>
                      <span>Verify & Enter MANAS</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.div>
            )}

            {!otpSent && (
              <button
                type="button"
                disabled={loading}
                onClick={handleSendPhoneOtp}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 transition-all cursor-pointer disabled:opacity-50 mt-4"
              >
                <span>Dispatch 6-Digit OTP</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </form>
        )}

        {/* ── TAB 2: EMAIL & PASSWORD FLOW ──────────────────────────────── */}
        {authMethod === 'password' && (
          <form onSubmit={handleEmailPasswordSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-white/60 mb-1.5">
                  Your Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-violet-500 font-sans transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-white/60 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-violet-500 font-mono transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-white/60 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-violet-500 font-mono transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 transition-all cursor-pointer disabled:opacity-50 mt-4"
            >
              {loading ? (
                <span>Processing...</span>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Login vs Signup toggle */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  setError(null);
                }}
                className="text-xs font-mono text-white/50 hover:text-white transition-colors cursor-pointer"
              >
                {mode === 'login'
                  ? "Don't have an account? Sign up"
                  : 'Already registered? Sign in'}
              </button>
            </div>
          </form>
        )}

        {/* Footer Security Badge */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/40">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-violet-400" /> Supabase Isolated Auth
          </span>
          <span>Zero-PII Token</span>
        </div>
      </div>
    </div>
  );
};
