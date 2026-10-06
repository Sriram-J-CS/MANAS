import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Mail, User, Sparkles, AlertCircle, ArrowRight, CheckCircle2, Phone, KeyRound, RefreshCw } from 'lucide-react';

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

  // OTP state (Supports Mobile Phone or Email)
  const [otpType, setOtpType] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('+91 ');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Email / Password state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Status states
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Countdown for OTP resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  if (!isOpen) return null;

  // Send OTP
  const handleSendOtp = async () => {
    setError(null);
    setSuccessMsg(null);

    const isPhone = otpType === 'phone';
    const destination = isPhone
      ? phone.trim().replace(/[\s\-]/g, '')
      : otpEmail.trim().toLowerCase();

    if (isPhone && destination.length < 10) {
      setError('Please enter a valid mobile number with country code (e.g. +91 9876543210).');
      return;
    }
    if (!isPhone && (!destination || !destination.includes('@'))) {
      setError('Please enter a valid email address for OTP delivery.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          name: name.trim() || undefined,
          email: (!isPhone ? destination : email.trim()) || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to dispatch verification code.');
      }

      setOtpSent(true);
      setResendCooldown(60);
      setOtpCode('');
      setSuccessMsg(`6-digit code dispatched to ${data.masked_destination || destination}. Valid for 10 minutes.`);
    } catch (err: any) {
      setError(err.message || 'An error occurred while sending OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const isPhone = otpType === 'phone';
    const destination = isPhone
      ? phone.trim().replace(/[\s\-]/g, '')
      : otpEmail.trim().toLowerCase();

    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          code: cleanCode,
          name: name.trim() || 'Friend',
          email: (!isPhone ? destination : email.trim()) || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Invalid or expired verification code.');
      }

      // Store authenticated session
      localStorage.setItem('manas_access_token', data.access_token);
      localStorage.setItem('manas_refresh_token', data.refresh_token);
      localStorage.setItem('manas_user_id', data.user_id);
      if (data.phone) localStorage.setItem('manas_user_phone', data.phone);
      if (data.email) localStorage.setItem('manas_user_email', data.email);
      localStorage.setItem('manas_user_name', data.name);

      setSuccessMsg('Identity verified! Entering your MANAS sanctuary... 🌿');

      setTimeout(() => {
        onAuthSuccess({
          user_id: data.user_id,
          name: data.name,
          email: data.email,
          phone: data.phone,
        });
        onClose();
      }, 800);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the 6 digits.');
    } finally {
      setLoading(false);
    }
  };

  // Email + Password submit
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

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const payload = mode === 'signup'
        ? { email: email.trim().toLowerCase(), password, name: name.trim() }
        : { email: email.trim().toLowerCase(), password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed. Please try again.');
      }

      localStorage.setItem('manas_access_token', data.access_token);
      localStorage.setItem('manas_refresh_token', data.refresh_token);
      localStorage.setItem('manas_user_id', data.user_id);
      localStorage.setItem('manas_user_email', data.email);
      localStorage.setItem('manas_user_name', data.name);

      setSuccessMsg(mode === 'signup' ? 'Account created successfully!' : 'Welcome back!');
      setTimeout(() => {
        onAuthSuccess({
          user_id: data.user_id,
          name: data.name,
          email: data.email,
        });
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-[#0C0E14] border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl text-white z-10 overflow-hidden"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-violet-600/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="mb-5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-mono mb-3">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>MANAS Security · Production OTP</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white font-sans">
              {authMethod === 'otp' ? 'Instant 6-Digit OTP Login' : (mode === 'login' ? 'Sign In with Password' : 'Create Account')}
            </h2>
            <p className="text-xs text-white/60 font-mono mt-1">
              {authMethod === 'otp'
                ? 'Cryptographically verified single-use login code.'
                : 'Zero-PII storage with cryptographic token security.'}
            </p>
          </div>

          {/* Method Switcher Tabs */}
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
              <KeyRound className="w-3.5 h-3.5" />
              <span>Secure OTP</span>
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
              <span>Email & Pass</span>
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

          {/* TAB 1: PRODUCTION OTP FLOW */}
          {authMethod === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {/* Phone vs Email Toggle */}
              <div className="flex gap-2 text-xs font-mono mb-1">
                <button
                  type="button"
                  onClick={() => { setOtpType('phone'); setError(null); }}
                  className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                    otpType === 'phone'
                      ? 'bg-white/10 border-white/30 text-white font-semibold'
                      : 'border-transparent text-white/50 hover:text-white'
                  }`}
                >
                  Mobile SMS
                </button>
                <button
                  type="button"
                  onClick={() => { setOtpType('email'); setError(null); }}
                  className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                    otpType === 'email'
                      ? 'bg-white/10 border-white/30 text-white font-semibold'
                      : 'border-transparent text-white/50 hover:text-white'
                  }`}
                >
                  Email Address
                </button>
              </div>

              {otpType === 'phone' ? (
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
                      onClick={handleSendOtp}
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
              ) : (
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-white/60 mb-1.5">
                    Email Address
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400" />
                      <input
                        type="email"
                        required
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                        placeholder="you@domain.com"
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-violet-500 font-mono transition-colors"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={loading || resendCooldown > 0}
                      onClick={handleSendOtp}
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
              )}

              {/* Optional Name for Community Welcome */}
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

              {otpSent && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 pt-2"
                >
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-violet-300 mb-1.5 flex items-center justify-between">
                      <span>Enter 6-Digit Code</span>
                      <span className="text-[10px] text-white/40 normal-case">Check your SMS / Email</span>
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
                  onClick={handleSendOtp}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 transition-all cursor-pointer disabled:opacity-50 mt-4"
                >
                  <span>Dispatch 6-Digit OTP</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </form>
          )}

          {/* TAB 2: EMAIL / PASSWORD FLOW */}
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
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-violet-500 font-sans transition-colors"
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
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 transition-all cursor-pointer disabled:opacity-50 mt-6"
              >
                {loading ? (
                  <span>Please wait...</span>
                ) : (
                  <>
                    <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center text-xs font-mono text-white/60">
                {mode === 'login' ? (
                  <p>
                    Don't have an email account?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('signup')}
                      className="text-violet-400 hover:text-violet-300 font-bold underline cursor-pointer"
                    >
                      Create one
                    </button>
                  </p>
                ) : (
                  <p>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="text-violet-400 hover:text-violet-300 font-bold underline cursor-pointer"
                    >
                      Sign in
                    </button>
                  </p>
                )}
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AuthModal;
