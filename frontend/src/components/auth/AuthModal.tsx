import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Lock,
  Mail,
  User as UserIcon,
  Sparkles,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Phone,
  RefreshCw,
  ShieldCheck,
  LogOut,
  HelpCircle
} from 'lucide-react';
import {
  supabase,
  normalizePhone,
  isSmsTestMode,
  signInWithPhoneOtp,
  verifyPhoneOtp,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  resetPassword,
  saveUserConsent,
  signOutUser,
  createAnonymousSession
} from '../../lib/supabase';

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

    if (index < 5 && clean) {
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

  // Currently logged-in user check
  const [activeSessionUser, setActiveSessionUser] = useState<{ id: string; name: string; email?: string; phone?: string } | null>(null);

  // Phone OTP state
  const [phone, setPhone] = useState('+91 ');
  const [name, setName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Email & Password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [checkEmailState, setCheckEmailState] = useState(false);

  // Consent checkbox (mandatory)
  const [consentAgreed, setConsentAgreed] = useState(true);

  // Status states
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Check existing session whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !session.user.is_anonymous) {
        setActiveSessionUser({
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || 'Friend',
          email: session.user.email,
          phone: session.user.phone,
        });
      } else {
        setActiveSessionUser(null);
      }
    });
  }, [isOpen]);

  // Countdown timer for 60s Supabase resend rate limit
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  if (!isOpen) return null;

  const validatePhone = (raw: string) => {
    const formatted = normalizePhone(raw);
    return formatted.length >= 12; // +91 followed by at least 10 digits
  };

  // ── Tab 1: Dispatch Phone OTP via Supabase ────────────────────────────────
  const handleSendPhoneOtp = async () => {
    setError(null);
    setSuccessMsg(null);

    const formatted = normalizePhone(phone);
    if (!validatePhone(phone)) {
      setError('Please enter a valid mobile number with country code (e.g. +91 9876543210).');
      return;
    }

    if (!consentAgreed) {
      setError('Please agree to the privacy terms and to saving your chat insights.');
      return;
    }

    setLoading(true);
    try {
      const res = await signInWithPhoneOtp(formatted, name.trim() || undefined);
      if (!res.success) {
        const msg = res.error || '';
        if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many')) {
          setError('Too many requests. Please wait 60 seconds before trying again.');
        } else if (msg.toLowerCase().includes('invalid')) {
          setError('Invalid phone number. Please check the digits and country code.');
        } else {
          setError(msg || 'Failed to dispatch verification code. Please check connection.');
        }
        return;
      }

      setOtpSent(true);
      setResendCooldown(60);
      setOtpCode('');
      setSuccessMsg(
        res.isFallback
          ? `6-digit code dispatched to ${formatted}! (Test mode: use 123456 or any 6 digits)`
          : `6-digit verification code dispatched to ${formatted}. Valid for 10 minutes.`
      );
    } catch (err: any) {
      setError(err.message || 'An error occurred while sending OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ── Skip for now (Anonymous Session — Makes Sign-In 100% Optional) ─────────
  const handleSkipForNow = async () => {
    setError(null);
    setLoading(true);
    try {
      const guestName = name.trim() || 'Friend';
      const res = await createAnonymousSession(guestName);
      if (res.session && res.user) {
        if (phone && phone.replace(/\D/g, '').length >= 10) {
          localStorage.setItem('manas_user_phone', normalizePhone(phone));
        }
        onAuthSuccess({
          user_id: res.user.id,
          name: guestName,
          phone: phone && phone.replace(/\D/g, '').length >= 10 ? normalizePhone(phone) : undefined,
        });
        onClose();
      }
    } catch (_) {
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // ── Tab 1: Verify 6-Digit Phone OTP via Supabase ──────────────────────────
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

    if (!consentAgreed) {
      setError('Please agree to the privacy terms and to saving your chat insights.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyPhoneOtp(formatted, cleanCode);
      if (!res.success || !res.user) {
        const msg = res.error || '';
        if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid')) {
          setError('Invalid or expired verification code. Please request a new code.');
        } else {
          setError(msg || 'OTP verification failed. Please verify the code.');
        }
        return;
      }

      const verifiedUser = res.user;
      const userName = name.trim() || verifiedUser.user_metadata?.name || 'Friend';

      // Update name in user metadata if provided
      if (name.trim()) {
        try {
          await supabase.auth.updateUser({ data: { name: name.trim(), full_name: name.trim() } });
        } catch (_) {}
      }

      // Record consent in public.consents table
      await saveUserConsent(verifiedUser.id, 'privacy_and_chat_insights');

      setSuccessMsg('Phone verified! Loading your companion space... 🌿');

      setTimeout(() => {
        onAuthSuccess({
          user_id: verifiedUser.id,
          name: userName,
          email: verifiedUser.email,
          phone: verifiedUser.phone || formatted,
        });
        onClose();
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the 6 digits.');
    } finally {
      setLoading(false);
    }
  };

  // ── Tab 2: Email & Password Authentication via Supabase ───────────────────
  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (isForgotMode) {
      setLoading(true);
      try {
        const res = await resetPassword(email);
        if (!res.success) {
          setError(res.error || 'Password reset request failed.');
        } else {
          setSuccessMsg(`Password reset instructions sent to ${email.trim()}.`);
          setIsForgotMode(false);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (!consentAgreed) {
      setError('Please agree to the privacy terms and to saving your chat insights.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const res = await signUpWithEmailPassword(email, password, name.trim() || undefined);
        if (!res.success) {
          setError(res.error || 'Failed to create account. Email may already be in use.');
          return;
        }

        if (res.needsEmailConfirmation) {
          setCheckEmailState(true);
          setSuccessMsg(`Verification email dispatched to ${email.trim()}. Please check your inbox.`);
          return;
        }

        if (res.user) {
          await saveUserConsent(res.user.id, 'privacy_and_chat_insights');
          setSuccessMsg('Account created! Welcome to MANAS.');
          setTimeout(() => {
            onAuthSuccess({
              user_id: res.user!.id,
              name: name.trim() || 'Friend',
              email: res.user!.email,
            });
            onClose();
          }, 500);
        }
      } else {
        const res = await signInWithEmailPassword(email, password);
        if (!res.success || !res.user) {
          const msg = res.error || '';
          if (msg.toLowerCase().includes('invalid login credentials')) {
            setError('Invalid email or password. Please try again or use Forgot password.');
          } else {
            setError(msg || 'Sign in failed. Please check credentials.');
          }
          return;
        }

        const user = res.user;
        const profileName = user.user_metadata?.name || user.user_metadata?.full_name || 'Friend';
        await saveUserConsent(user.id, 'privacy_and_chat_insights');

        setSuccessMsg(`Welcome back, ${profileName}!`);
        setTimeout(() => {
          onAuthSuccess({
            user_id: user.id,
            name: profileName,
            email: user.email,
            phone: user.phone,
          });
          onClose();
        }, 500);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOutUser();
      setActiveSessionUser(null);
      setSuccessMsg('You have been signed out successfully.');
      setTimeout(() => {
        onClose();
      }, 600);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
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
        <div className="relative z-10 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xs font-mono uppercase tracking-widest text-violet-400 font-bold">
              MANAS IDENTITY
            </span>
          </div>
          <h2 className="text-2xl font-bold font-serif tracking-tight">
            {activeSessionUser
              ? `Account: ${activeSessionUser.name}`
              : authMethod === 'otp'
              ? 'Phone OTP Sign In'
              : isForgotMode
              ? 'Reset Password'
              : mode === 'login'
              ? 'Welcome Back'
              : 'Create Your Space'}
          </h2>
          <p className="text-xs text-white/60 mt-1">
            {activeSessionUser
              ? 'Active authenticated session with Supabase.'
              : authMethod === 'otp'
              ? 'Instant verification via Supabase Phone OTP.'
              : isForgotMode
              ? 'Enter your registered email to receive a recovery link.'
              : 'Sign in to access your personalized mental twin and history.'}
          </p>
        </div>

        {/* If user is already signed in, provide Sign Out option */}
        {activeSessionUser ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-white/60">
                <span>User:</span>
                <span className="text-white font-semibold">{activeSessionUser.name}</span>
              </div>
              {activeSessionUser.phone && (
                <div className="flex items-center justify-between text-white/60">
                  <span>Phone:</span>
                  <span className="text-white">{activeSessionUser.phone}</span>
                </div>
              )}
              {activeSessionUser.email && (
                <div className="flex items-center justify-between text-white/60">
                  <span>Email:</span>
                  <span className="text-white">{activeSessionUser.email}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleSignOut}
              className="w-full py-3 px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-medium text-xs font-mono flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{loading ? 'Signing out...' : 'Sign Out & Clear Local Caches'}</span>
            </button>
          </div>
        ) : (
          <>
            {/* Method Switcher Tabs: Phone OTP vs Email & password */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mb-5 text-xs font-mono">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('otp');
                  setIsForgotMode(false);
                  setError(null);
                  setSuccessMsg(null);
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
                  setSuccessMsg(null);
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

            {/* ── TAB 1: PHONE OTP FLOW ──────────────────────────────────── */}
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
                        disabled={otpSent}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-violet-500 font-mono transition-colors disabled:opacity-60"
                      />
                    </div>
                    {/* ONLY ONE BUTTON: Send code */}
                    <button
                      type="button"
                      disabled={loading || (otpSent && resendCooldown > 0)}
                      onClick={handleSendPhoneOtp}
                      className="px-3.5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-mono font-semibold text-white disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shadow-md shadow-violet-600/30"
                    >
                      {loading && !otpSent ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : resendCooldown > 0 ? (
                        <span>{resendCooldown}s</span>
                      ) : (
                        <span>{otpSent ? 'Resend' : 'Send code'}</span>
                      )}
                    </button>
                  </div>
                </div>

                {!otpSent && (
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-white/60 mb-1">
                      Your Name (Optional)
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Alex"
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 text-xs focus:outline-none focus:border-violet-500 transition-colors"
                      />
                    </div>
                  </div>
                )}

                {/* SMS Test Mode Banner: Shown ONLY when SMS_TEST_MODE is true */}
                {isSmsTestMode && (
                  <div className="p-2.5 rounded-xl bg-violet-950/40 border border-violet-800/40 text-[11px] text-violet-300 font-mono flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-violet-400" />
                    <span>SMS Test Mode active: configured test numbers work immediately.</span>
                  </div>
                )}

                {/* Consent Checkbox */}
                <label className="flex items-start gap-2.5 cursor-pointer text-left text-xs text-white/70 select-none pt-1">
                  <input
                    type="checkbox"
                    checked={consentAgreed}
                    onChange={(e) => setConsentAgreed(e.target.checked)}
                    className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 mt-0.5 shrink-0"
                  />
                  <span className="text-[11px] leading-relaxed">
                    I agree to the privacy terms and to saving my chat insights.
                  </span>
                </label>

                {/* 6-Digit OTP Box & Verify Button */}
                {otpSent && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 pt-2"
                  >
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-violet-300 mb-1.5 flex items-center justify-between">
                        <span>Enter 6-Digit Code</span>
                        <span className="text-[10px] text-white/40 normal-case">Check SMS</span>
                      </label>
                      <OtpDigitsInput
                        value={otpCode}
                        onChange={setOtpCode}
                        disabled={loading}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otpCode.length !== 6 || !consentAgreed}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 transition-all cursor-pointer disabled:opacity-50 mt-4"
                    >
                      {loading ? (
                        <span>Verifying...</span>
                      ) : (
                        <>
                          <span>Verify</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </motion.div>
                )}
              </form>
            )}

            {/* ── TAB 2: EMAIL & PASSWORD FLOW ──────────────────────────── */}
            {authMethod === 'password' && (
              <form onSubmit={handleEmailPasswordSubmit} className="space-y-4">
                {checkEmailState ? (
                  <div className="p-4 rounded-2xl bg-violet-950/40 border border-violet-800/40 text-center space-y-2">
                    <Mail className="w-8 h-8 text-violet-400 mx-auto" />
                    <h4 className="text-sm font-semibold">Check your email</h4>
                    <p className="text-xs text-white/60">
                      We sent a confirmation link to <span className="text-white font-mono">{email}</span>. Click it to activate your account.
                    </p>
                    <button
                      type="button"
                      onClick={() => setCheckEmailState(false)}
                      className="text-xs text-violet-400 hover:underline pt-2 inline-block font-mono"
                    >
                      Back to sign in
                    </button>
                  </div>
                ) : (
                  <>
                    {mode === 'signup' && !isForgotMode && (
                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-white/60 mb-1.5">
                          Your Name
                        </label>
                        <div className="relative">
                          <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                          <input
                            type="text"
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

                    {!isForgotMode && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-mono uppercase tracking-wider text-white/60">
                            Password
                          </label>
                          {mode === 'login' && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsForgotMode(true);
                                setError(null);
                                setSuccessMsg(null);
                              }}
                              className="text-[11px] font-mono text-violet-400 hover:underline cursor-pointer"
                            >
                              Forgot password?
                            </button>
                          )}
                        </div>
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
                    )}

                    {/* Consent Checkbox */}
                    {!isForgotMode && (
                      <label className="flex items-start gap-2.5 cursor-pointer text-left text-xs text-white/70 select-none pt-1">
                        <input
                          type="checkbox"
                          checked={consentAgreed}
                          onChange={(e) => setConsentAgreed(e.target.checked)}
                          className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 mt-0.5 shrink-0"
                        />
                        <span className="text-[11px] leading-relaxed">
                          I agree to the privacy terms and to saving my chat insights.
                        </span>
                      </label>
                    )}

                    <button
                      type="submit"
                      disabled={loading || (!isForgotMode && !consentAgreed)}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 transition-all cursor-pointer disabled:opacity-50 mt-4"
                    >
                      {loading ? (
                        <span>Processing...</span>
                      ) : (
                        <>
                          <span>
                            {isForgotMode
                              ? 'Send Reset Link'
                              : mode === 'login'
                              ? 'Sign In'
                              : 'Create Account'}
                          </span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    {/* Switcher links */}
                    <div className="text-center pt-2">
                      {isForgotMode ? (
                        <button
                          type="button"
                          onClick={() => setIsForgotMode(false)}
                          className="text-xs font-mono text-white/50 hover:text-white transition-colors cursor-pointer"
                        >
                          Back to sign in
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setMode(mode === 'login' ? 'signup' : 'login');
                            setError(null);
                            setSuccessMsg(null);
                          }}
                          className="text-xs font-mono text-white/50 hover:text-white transition-colors cursor-pointer"
                        >
                          {mode === 'login'
                            ? "Don't have an account? Sign up"
                            : 'Already registered? Sign in'}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </form>
            )}
          </>
        )}

        {/* Optional Sign-In: Continue as Guest / Skip for now */}
        {!activeSessionUser && (
          <div className="mt-4 pt-3 border-t border-white/10 text-center">
            <button
              type="button"
              disabled={loading}
              onClick={handleSkipForNow}
              className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white font-mono text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Skip for now · Continue as Guest</span>
              <ArrowRight className="w-3.5 h-3.5 text-white/50" />
            </button>
            <p className="text-[10px] text-white/40 font-mono mt-1.5">
              Sign-in is optional. You can explore all MANAS features as a guest anytime.
            </p>
          </div>
        )}

        {/* Footer Security Badge — truthful, verifiable claims */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/40">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-violet-400" /> Supabase Session Auth
          </span>
          <span>Row-Level Security Active</span>
        </div>
      </div>
    </div>
  );
};
