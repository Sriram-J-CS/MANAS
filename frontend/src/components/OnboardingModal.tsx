import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import {
  Volume2,
  VolumeX,
  ArrowRight,
  ArrowLeft,
  Check,
  Camera,
  Upload,
  Sparkles,
  X,
  ShieldCheck,
  Lock,
  Mic,
  Phone,
  Mail,
  User,
  Calendar,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { RealMascot } from './RealMascot';
import { VRMAvatarCanvas } from './avatar/VRMAvatarCanvas';
import { useI18n, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';
import type { Language, MascotExpression } from '../types';
import { speechEngine } from '../lib/voice/speechEngine';
import { speechGateway } from '../lib/voice/speechGateway';
import { sharedAudioManager } from '../lib/audio/sharedAudioContext';
import { ONBOARDING_FIXED_LINES } from '../lib/voice/onboardingVoiceLines';

import type { AvatarAppearanceAttributes } from '../lib/avatar/providers';
import { mediaPipeGeminiProvider } from '../lib/avatar/providers/MediaPipeGeminiProvider';
import {
  supabase,
  signInWithPhoneOtp,
  verifyPhoneOtp,
  linkPhoneToUser,
  verifyPhoneLinkOtp,
  createAnonymousSession,
  normalizePhone,
  isSmsTestMode,
} from '../lib/supabase';

export interface UserProfile {
  id?: string;
  name: string;
  companionName?: string;
  age: number;
  isMinor: boolean;
  guardianConsent: boolean;
  language: string;
  companion?: 'girl' | 'boy';
  contactEmail?: string;
  contactPhone?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  avatarUrl?: string;
  avatarType?: string;
  isCustomAvatar?: boolean;
  appearanceAttributes?: AvatarAppearanceAttributes | null;
  outfit?: string;
  mascotEnabled?: boolean;
  mascotPosition?: 'left' | 'right';
  voicePref?: string;
  voiceGender?: 'boy' | 'girl';
  voiceTone?: string;
  voicePitch?: number;
  voiceFollowsCompanion?: boolean;
  speakingStyle?: string;
  voiceSpeed?: number;
  replyLength?: 'Short' | 'Balanced' | 'Detailed' | string;
  micGranted?: boolean;
  stylePref?: 'reflective' | 'brief' | 'warm';
  consentDisclaimer: boolean;
  consentChat: boolean;
  consentMood: boolean;
  consentCadence: boolean;
  consentTimestamp: string;
  tone: 'gentle' | 'motivating' | 'straight-talking';
  role: 'student' | 'professional';
  gender: 'boy' | 'girl' | 'prefer_not_to_say';
  reasons: string[];
  customReason?: string;
}

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (profile: UserProfile) => void;
  initialLang?: Language;
  existingProfile?: UserProfile | null;
  onDeleteData?: () => void;
}

const contactSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  phone: z
    .string()
    .optional()
    .refine(
      (val) => !val || val.trim() === '' || val.trim() === '+91' || /^[+]?[0-9\s-]{10,15}$/.test(val.trim()),
      { message: 'Please enter a valid phone number or leave blank' }
    ),
  consent: z.boolean().refine((val) => val === true, {
    message: 'Consent is required to continue'
  })
});

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  initialLang = 'en',
  existingProfile,
  onDeleteData
}) => {
  // Step state (1: Language, 2: Name & Companion, 3: Age, 4: Contact & OTP, 5: Photo, 6: Voice)
  const [step, setStep] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('manas_entry_step_v2');
      if (saved) return Math.min(6, Math.max(1, parseInt(saved, 10)));
    } catch (_) {}
    return 1;
  });

  // Step 1: Language
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(() => {
    if (existingProfile?.language && ['en', 'ta', 'hi', 'te', 'kn', 'ml', 'bn', 'mr'].includes(existingProfile.language)) {
      return existingProfile.language as SupportedLanguage;
    }
    return (initialLang as SupportedLanguage) || 'en';
  });

  const { t } = useI18n(selectedLanguage);

  // Step 2: Name & Companion
  const [name, setName] = useState<string>(existingProfile?.name || '');
  const [nameError, setNameError] = useState<string>('');
  const [companion, setCompanion] = useState<'girl' | 'boy'>(() => {
    if (existingProfile?.companion) return existingProfile.companion;
    if (existingProfile?.gender === 'boy') return 'boy';
    return 'girl'; // default is Girl
  });
  const [companionName, setCompanionName] = useState<string>(() => {
    if (existingProfile?.companionName) return existingProfile.companionName;
    return companion === 'boy' ? 'Aarav' : 'Maya';
  });
  const [mascotGesture, setMascotGesture] = useState<string>('idle');

  // Step 3: Age (no prefilled default 20)
  const [age, setAge] = useState<number | ''>(() => {
    if (typeof existingProfile?.age === 'number') return existingProfile.age;
    return '';
  });
  const [guardianConsent, setGuardianConsent] = useState<boolean>(
    existingProfile?.guardianConsent || false
  );
  const [ageError, setAgeError] = useState<string>('');
  const isMinor = typeof age === 'number' && age < 18;

  // Step 4: Contact & Supabase Phone OTP
  const [email, setEmail] = useState<string>(existingProfile?.contactEmail || '');
  const [phone, setPhone] = useState<string>(existingProfile?.contactPhone || '+91 ');
  const [contactConsent, setContactConsent] = useState<boolean>(true);
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [devOtpHint, setDevOtpHint] = useState<string>('');
  const [emailVerified, setEmailVerified] = useState<boolean>(
    existingProfile?.emailVerified || existingProfile?.phoneVerified || false
  );
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [otpError, setOtpError] = useState<string>('');
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [isLinkingAccount, setIsLinkingAccount] = useState<boolean>(false);

  // Step 5: Photo & 3D Live Avatar Pipeline
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(
    existingProfile?.avatarUrl || null
  );
  const [appearanceAttrs, setAppearanceAttrs] = useState<AvatarAppearanceAttributes | null>(
    existingProfile?.appearanceAttributes || null
  );
  const [isProcessingPhoto, setIsProcessingPhoto] = useState<boolean>(false);
  const [showAdjustControls, setShowAdjustControls] = useState<boolean>(false);
  const [consentGeminiAnalysis, setConsentGeminiAnalysis] = useState<boolean>(true);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Step 6: Voice & Audio Setup
  const [micStatus, setMicStatus] = useState<'idle' | 'testing' | 'granted' | 'denied'>('idle');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [selectedVoice, setSelectedVoice] = useState<string>(
    existingProfile?.voicePref || ''
  );
  const [isAudioPreviewPlaying, setIsAudioPreviewPlaying] = useState<boolean>(false);

  // Voice tone cards per companion gender
  const GIRL_TONES = [
    { id: 'ananya', name: 'Ananya', style: 'Warm & Empathetic' },
    { id: 'diya',   name: 'Diya',   style: 'Gentle & Soft' },
    { id: 'janani', name: 'Janani', style: 'Bright & Encouraging' },
  ];
  const BOY_TONES = [
    { id: 'aarav', name: 'Aarav', style: 'Calm & Grounding' },
    { id: 'kabir', name: 'Kabir', style: 'Warm & Steady' },
    { id: 'arjun', name: 'Arjun', style: 'Soft & Friendly' },
  ];
  const availableTones = companion === 'boy' ? BOY_TONES : GIRL_TONES;

  // Mascot Guide & Speech Synthesis
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return sharedAudioManager.getIsVoiceMuted();
  });
  const [mascotSpeaking, setMascotSpeaking] = useState<boolean>(false);
  const [mascotExpression, setMascotExpression] = useState<MascotExpression>('happy');

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    sharedAudioManager.setVoiceMute(nextMuted);
    if (nextMuted) {
      speechGateway.stopSpeaking();
      setMascotSpeaking(false);
    } else {
      speakCurrentGuide();
    }
  };

  // Choose companion handler: waves once + speaks short greeting in user's language with lip-sync
  // When companion gender changes, reset voiceTone to the first valid tone for new gender
  const handleSelectCompanion = (picked: 'girl' | 'boy') => {
    setCompanion(picked);
    setMascotGesture('wave');
    // Reset voice selection to first tone of new companion
    const firstTone = picked === 'boy' ? 'aarav' : 'ananya';
    setSelectedVoice(firstTone);

    const cleanLang = (selectedLanguage || 'en').split('-')[0].toLowerCase();
    const lineId = 'greeting_companion';
    const speechText =
      ONBOARDING_FIXED_LINES[cleanLang]?.[picked]?.[lineId] ||
      ONBOARDING_FIXED_LINES.en[picked][lineId];

    setMascotSpeaking(true);
    setMascotExpression('happy');
    speechGateway.speak({
      text: speechText,
      lang: selectedLanguage,
      gender: picked,
      companion: picked,
      purpose: 'onboarding_greeting',
      lineId,
      pitch: picked === 'girl' ? 1.15 : 0.9,
      onStart: () => setMascotSpeaking(true),
      onEnd: () => {
        setMascotSpeaking(false);
        setMascotExpression('calm');
      },
      onError: () => {
        setMascotSpeaking(false);
        setMascotExpression('calm');
      },
    });
  };

  // Cooldown countdown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Persist current step
  useEffect(() => {
    try {
      localStorage.setItem('manas_entry_step_v2', step.toString());
    } catch (_) {}
  }, [step]);

  const getStepLineId = (currentStep: number): string => {
    switch (currentStep) {
      case 1:
        return 'step_1_language';
      case 2:
        return 'step_2_name';
      case 3:
        return 'step_3_age';
      case 4:
        return 'step_4_contact';
      case 5:
        return 'step_5_photo';
      case 6:
        return 'step_6_voice';
      default:
        return 'step_1_language';
    }
  };

  const currentLineId = getStepLineId(step);
  const cleanSelectedLang = (selectedLanguage || 'en').split('-')[0].toLowerCase();
  const companionKey = companion === 'boy' ? 'boy' : 'girl';
  const currentGuideText =
    ONBOARDING_FIXED_LINES[cleanSelectedLang]?.[companionKey]?.[currentLineId] ||
    ONBOARDING_FIXED_LINES.en[companionKey][currentLineId] ||
    'I am right here with you.';

  const speakCurrentGuide = (langOverride?: string) => {
    if (isMuted) return;
    const targetLang = langOverride || selectedLanguage;
    const cleanLang = (targetLang || 'en').split('-')[0].toLowerCase();
    const textToSpeak =
      ONBOARDING_FIXED_LINES[cleanLang]?.[companionKey]?.[currentLineId] ||
      ONBOARDING_FIXED_LINES.en[companionKey][currentLineId] ||
      currentGuideText;

    // Ensure audio manager has voice unmuted and volume at 1.0
    sharedAudioManager.setVoiceMute(false);
    sharedAudioManager.setVoiceVolume(1.0);

    speechGateway.stopSpeaking();
    speechGateway.speak({
      text: textToSpeak,
      lang: targetLang,
      gender: companion || 'girl',
      companion: companion || 'girl',
      pitch: companion === 'boy' ? 0.9 : 1.15,
      purpose: 'onboarding_step',
      lineId: currentLineId,
      onStart: () => {
        setMascotSpeaking(true);
        setMascotExpression('encouraging');
      },
      onEnd: () => {
        setMascotSpeaking(false);
        setMascotExpression('calm');
      },
      onError: () => {
        setMascotSpeaking(false);
        setMascotExpression('calm');
      }
    });
  };

  // Check active Supabase session
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        if (user.phone && (user.phone_confirmed_at || user.confirmed_at)) {
          setPhone(user.phone);
          setEmailVerified(true);
        } else if (user.email) {
          setEmail(user.email);
          setIsLinkingAccount(true);
        }
      }
    });
  }, [isOpen]);

  // Speak step instruction when entering step or when modal opens
  useEffect(() => {
    if (isOpen && !isMuted) {
      speakCurrentGuide();
    }
  }, [step, isOpen]);

  // Clean up speech only when modal unmounts
  useEffect(() => {
    return () => {
      speechGateway.stopSpeaking();
    };
  }, []);

  // Unlock audio context on user interaction
  useEffect(() => {
    const unlockAudio = () => {
      try {
        const ctx = sharedAudioManager.getAudioContext();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
      } catch (_) {}
    };

    window.addEventListener('click', unlockAudio, { capture: true, once: true });
    window.addEventListener('keydown', unlockAudio, { capture: true, once: true });
    return () => {
      window.removeEventListener('click', unlockAudio, { capture: true });
      window.removeEventListener('keydown', unlockAudio, { capture: true });
    };
  }, []);

  // Clean up camera on unmount or step change
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [step]);

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (_) {
      alert('Unable to access webcam. You can upload an image or skip this step.');
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, 400, 400);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPhotoDataUrl(dataUrl);
    stopCamera();
    await runPhotoAvatarPipeline(dataUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPhotoDataUrl(dataUrl);
      runPhotoAvatarPipeline(file);
    };
    reader.readAsDataURL(file);
  };

  // Step 6: Test Microphone
  const testMicrophone = async () => {
    setMicStatus('testing');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let ticks = 0;
      const interval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        ticks++;
        if (ticks > 25) {
          clearInterval(interval);
          stream.getTracks().forEach((track) => track.stop());
          audioCtx.close();
          setMicStatus('granted');
          setAudioLevel(0);
        }
      }, 100);
    } catch (_) {
      setMicStatus('denied');
    }
  };

  // Step 6: Voice Preview — uses exact companion+tone so user hears real speaker
  const playVoiceSample = () => {
    setIsAudioPreviewPlaying(true);

    const sampleText =
      selectedLanguage === 'ta'
        ? 'வணக்கம், நான் எப்போதும் உங்களுடன் துணை நிற்பேன்.'
        : selectedLanguage === 'hi'
        ? 'नमस्ते, मैं हमेशा आपकी बात सुनने के लिए उपस्थित हूँ।'
        : selectedLanguage === 'te'
        ? 'నమస్కారం, నేను ఎల్లప్పుడూ మీకు తోడుగా ఉంటాను.'
        : selectedLanguage === 'kn'
        ? 'ನಮಸ್ಕಾರ, ನಾನು ಯಾವಾಗಲೂ ನಿಮ್ಮೊಂದಿಗೆ ಇರುತ್ತೇನೆ.'
        : selectedLanguage === 'ml'
        ? 'നമസ്കാരം, ഞാൻ എപ്പോഴും നിങ്ങളുടെ കൂടെയുണ്ടാകും.'
        : selectedLanguage === 'bn'
        ? 'নমস্কার, আমি সর্বদা আপনার পাশে আছি।'
        : selectedLanguage === 'mr'
        ? 'नमस्कार, मी नेहमी तुमच्या पाठीशी आहे.'
        : companion === 'boy'
        ? 'Hey, I am always right here whenever you need to talk or just unwind.'
        : 'Hi there, I am always right here beside you whenever you need to talk.';

    // Use the exact companion gender and selected tone so user hears the real speaker
    speechGateway.speak({
      text: sampleText,
      lang: selectedLanguage,
      gender: companion,
      companion,
      tone: selectedVoice || undefined,
      purpose: 'voice_sample',
      onEnd: () => setIsAudioPreviewPlaying(false),
      onError: () => setIsAudioPreviewPlaying(false),
    });
  };

  // Validation flags for Next buttons (Phase 3)
  const isStep1Valid = Boolean(selectedLanguage);
  const isStep2Valid = name.trim().length >= 2 && Boolean(companion);
  const isStep3Valid = typeof age === 'number' && age >= 13 && age <= 100 && (age >= 18 || guardianConsent);
  const isStep4Valid = Boolean(emailVerified);

  // Navigation handlers
  const handleNextStep1 = () => {
    if (!isStep1Valid) return;
    setStep(2);
  };

  const handleNextStep2 = () => {
    if (!name.trim()) {
      setNameError('Please enter your name (at least 2 letters)');
      return;
    }
    if (name.trim().length < 2) {
      setNameError('Name must be at least 2 characters');
      return;
    }
    setNameError('');
    setStep(3);
  };

  const handleNextStep3 = () => {
    if (typeof age !== 'number' || age < 13 || age > 100) {
      setAgeError('Please enter your age between 13 and 100.');
      return;
    }
    if (isMinor && !guardianConsent) {
      setAgeError(t.steps.age.guardianConsentRequired || 'Guardian consent is required for under 18');
      return;
    }
    setAgeError('');
    setStep(4);
  };

  // Skip handler for each step: ONLY way to proceed with empty input, uses defaults with no error
  const handleSkipStep = async (currentStep: number) => {
    // Ensure anonymous Supabase session if user has not signed in yet
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        await createAnonymousSession();
      }
    } catch (_) {}

    switch (currentStep) {
      case 1:
        if (!selectedLanguage) setSelectedLanguage('en');
        setStep(2);
        break;
      case 2:
        if (!name.trim()) setName('Friend');
        if (!companion) setCompanion('girl');
        setNameError('');
        setStep(3);
        break;
      case 3:
        if (typeof age !== 'number' || age < 18) setAge(20);
        setGuardianConsent(true);
        setAgeError('');
        setStep(4);
        break;
      case 4:
        setStep(5);
        break;
      case 5:
        stopCamera();
        setStep(6);
        break;
      case 6:
        handleFinish();
        break;
      default:
        break;
    }
  };

  // Step 4: Send OTP to Mobile Number via Supabase
  const handleSendOtp = async () => {
    const rawDigits = phone.trim().replace(/\D/g, '');
    if (rawDigits.length < 10) {
      setContactErrors({ phone: 'Please enter a valid 10-digit mobile number (e.g. +91 9876543210)' });
      return;
    }
    setContactErrors({});
    setIsSendingOtp(true);
    setOtpError('');

    try {
      const formatted = normalizePhone(phone);
      if (isLinkingAccount) {
        const res = await linkPhoneToUser(formatted);
        if (!res.success) throw new Error(res.error || 'Failed to send OTP to mobile number');
      } else {
        const res = await signInWithPhoneOtp(formatted);
        if (!res.success) throw new Error(res.error || 'Failed to send OTP to mobile number');
      }
      setOtpSent(true);
      if (isSmsTestMode) {
        setDevOtpHint('Test mode active: Enter test OTP configured in Supabase or SMS');
      }
      setResendCooldown(60);
    } catch (err: any) {
      setOtpError(err.message || 'Error sending mobile OTP. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Step 4: Verify OTP from Mobile Number via Supabase
  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setOtpError('Please enter the 6-digit verification code.');
      return;
    }
    setIsVerifyingOtp(true);
    setOtpError('');

    try {
      const formatted = normalizePhone(phone);
      if (isLinkingAccount) {
        const res = await verifyPhoneLinkOtp(formatted, otpCode.trim());
        if (!res.success) throw new Error(res.error || 'Invalid verification code');
      } else {
        const res = await verifyPhoneOtp(formatted, otpCode.trim());
        if (!res.success) throw new Error(res.error || 'Invalid verification code');
        if (res.session?.access_token) {
          localStorage.setItem('manas_access_token', res.session.access_token);
          localStorage.setItem('manas_user_id', res.session.user.id);
        }
      }
      setEmailVerified(true);
      setStep(5);
    } catch (err: any) {
      setOtpError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Step 5: Live Photo Avatar Pipeline
  const runPhotoAvatarPipeline = async (source: File | string) => {
    setIsProcessingPhoto(true);
    try {
      const attrs = await mediaPipeGeminiProvider.processPhoto(source, {
        allowServerAnalysis: consentGeminiAnalysis,
        userConsentGiven: true,
      });
      setAppearanceAttrs(attrs);
      if (typeof source === 'string') {
        setPhotoDataUrl(source);
      }
    } catch (err: any) {
      console.warn('Photo avatar processing failed:', err);
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  // Final Complete Handler
  const handleFinish = async () => {
    let session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      await createAnonymousSession();
      session = (await supabase.auth.getSession()).data.session;
    }
    const finalUserId = session?.user?.id || existingProfile?.id || `user_${Date.now()}`;
    const finalAge = typeof age === 'number' ? age : 20;
    const finalIsMinor = finalAge < 18;

    const finalProfile: UserProfile = {
      id: finalUserId,
      name: name.trim() || 'Friend',
      companionName: companionName.trim() || (companion === 'boy' ? 'Aarav' : 'Maya'),
      age: finalAge,
      isMinor: finalIsMinor,
      guardianConsent: finalIsMinor ? guardianConsent : true,
      language: selectedLanguage,
      contactEmail: email.trim() || undefined,
      contactPhone: phone.trim() || undefined,
      emailVerified,
      phoneVerified: emailVerified,
      avatarUrl: photoDataUrl || undefined,
      appearanceAttributes: appearanceAttrs || undefined,
      voicePref: selectedVoice || (companion === 'boy' ? 'aarav' : 'ananya'),
      voiceTone: selectedVoice || (companion === 'boy' ? 'aarav' : 'ananya'),
      voiceGender: companion,
      micGranted: micStatus === 'granted',
      consentDisclaimer: true,
      consentChat: true,
      consentMood: true,
      consentCadence: true,
      consentTimestamp: new Date().toISOString(),
      tone: existingProfile?.tone || 'gentle',
      role: existingProfile?.role || 'student',
      companion,
      gender: companion,
      avatarType: companion,
      voicePitch: companion === 'girl' ? 1.15 : 0.9,
      reasons: existingProfile?.reasons || ['Stress & Pressure']
    };

    // Save profile to Supabase
    try {
      await supabase.from('profiles').upsert({
        user_id: finalUserId,
        name: finalProfile.name,
        age: finalProfile.age,
        language: finalProfile.language,
        companion: finalProfile.companion,
        voice_gender: finalProfile.voiceGender,
        voice_tone: finalProfile.voiceTone,
        avatar_type: finalProfile.avatarType,
        avatar_url: finalProfile.avatarUrl,
        guardian_consent: finalProfile.guardianConsent,
        consent_chat: true,
        consent_mood: true,
        consent_cadence: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

      if (appearanceAttrs) {
        await supabase.from('avatar_attrs').upsert({
          user_id: finalUserId,
          skin_tone: appearanceAttrs.skin_tone_hex,
          hair_color: appearanceAttrs.hair_color_hex,
          eye_color: appearanceAttrs.eye_color_hex,
          lip_color: appearanceAttrs.lip_color_hex,
          glasses: Boolean(appearanceAttrs.glasses),
          glasses_shape: appearanceAttrs.glasses_shape,
          glasses_color: appearanceAttrs.glasses_color_hex,
          hair_style: appearanceAttrs.hair_style,
          hair_length: appearanceAttrs.hair_length,
          facial_hair: appearanceAttrs.facial_hair,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      }
    } catch (e) {
      console.warn('Failed to persist profile to Supabase:', e);
    }

    try {
      localStorage.removeItem('manas_entry_step_v2');
    } catch (_) {}

    onComplete(finalProfile);
  };

  const handleDeleteDataClick = async () => {
    if (
      window.confirm(
        'Are you sure you want to permanently erase all your data? This action cannot be undone.'
      )
    ) {
      try {
        const uid = existingProfile?.id;
        if (uid) {
          await fetch(`/api/user/data/${uid}`, { method: 'DELETE' });
        }
        localStorage.clear();
        onDeleteData?.();
        onClose();
      } catch (_) {
        localStorage.clear();
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0A0A0A]/85 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative w-full max-w-2xl bg-[#FFFFFF] dark:bg-[#111622] rounded-3xl shadow-2xl border border-[#0A0A0A]/10 dark:border-[#FFFFFF]/10 overflow-hidden flex flex-col my-auto"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#0A0A0A]/5 dark:border-[#FFFFFF]/5">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold tracking-widest text-[#8B5CF6] uppercase">
              STEP 0{step} / 06
            </span>
            <div className="h-4 w-[1px] bg-[#0A0A0A]/10 dark:bg-[#FFFFFF]/10" />
            <span className="text-xs font-medium text-[#0A0A0A]/60 dark:text-[#FFFFFF]/60">
              {step === 1 && (t.steps.language.title || 'Language Choice')}
              {step === 2 && (t.steps.name.title || 'Welcome & Name')}
              {step === 3 && (t.steps.age.title || 'Age & Safety Mode')}
              {step === 4 && (t.steps.contact.title || 'Secure Contact & OTP')}
              {step === 5 && (t.steps.photo.title || 'Visual Avatar')}
              {step === 6 && (t.steps.voice.title || 'Audio & Voice')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              title={isMuted ? 'Unmute Mascot Guide' : 'Mute Mascot Guide'}
              className="p-2 rounded-full hover:bg-[#0A0A0A]/5 dark:hover:bg-[#FFFFFF]/5 text-[#0A0A0A]/70 dark:text-[#FFFFFF]/70 transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#8B5CF6]" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[#0A0A0A]/5 dark:hover:bg-[#FFFFFF]/5 text-[#0A0A0A]/50 dark:text-[#FFFFFF]/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Animated Step Progress Bar */}
        <div className="w-full h-1 bg-[#F0EDE4] dark:bg-[#1E2638]">
          <motion.div
            className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899]"
            initial={{ width: `${((step - 1) / 6) * 100}%` }}
            animate={{ width: `${(step / 6) * 100}%` }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.55 }}
          />
        </div>

        {/* Mascot Speech Bubble Guide */}
        <div className="px-6 pt-5 pb-2 flex items-start gap-4 bg-[#FBF9F5] dark:bg-[#151C2C]/50 border-b border-[#0A0A0A]/5 dark:border-[#FFFFFF]/5">
          <div className="shrink-0 relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#8B5CF6]/20 to-[#EC4899]/20 flex items-center justify-center border border-[#8B5CF6]/30 overflow-hidden shadow-sm">
              <VRMAvatarCanvas
                companion={companion}
                gender={companion}
                emotion={mascotExpression}
                gesture={mascotGesture}
                isSpeaking={mascotSpeaking}
                onWaveEnd={() => setMascotGesture('idle')}
                framing="portrait"
                className="w-full h-full"
              />
            </div>
            {mascotSpeaking && (
              <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8B5CF6] opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#8B5CF6]" />
              </span>
            )}
          </div>

          <div className="flex-1">
            <div
              onClick={() => speakCurrentGuide()}
              title="Click to hear MANAS speak"
              className="relative p-3 rounded-2xl bg-[#FFFFFF] dark:bg-[#1A2234] border border-[#0A0A0A]/10 dark:border-[#FFFFFF]/10 shadow-sm cursor-pointer hover:border-[#8B5CF6]/50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs sm:text-sm text-[#0A0A0A]/85 dark:text-[#FFFFFF]/90 leading-relaxed font-normal">
                  {currentGuideText}
                </p>
                <span className="shrink-0 p-1 text-[#8B5CF6] group-hover:scale-110 transition-transform">
                  <Volume2 className="w-3.5 h-3.5" />
                </span>
              </div>
              {/* Triangle pointer */}
              <div className="absolute top-4 -left-1.5 w-3 h-3 bg-[#FFFFFF] dark:bg-[#1A2234] border-l border-b border-[#0A0A0A]/10 dark:border-[#FFFFFF]/10 transform rotate-45" />
            </div>
          </div>
        </div>

        {/* Main Step Body */}
        <div className="p-6 flex-1 min-h-[340px] flex flex-col justify-center relative overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            {/* STEP 1: LANGUAGE (8 Indic Languages in Native Script) */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0.7, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex flex-col gap-4 max-w-xl mx-auto w-full"
              >
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0A0A0A] dark:text-[#FFFFFF]">
                    {t.steps.language.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#0A0A0A]/60 dark:text-[#FFFFFF]/60 mt-1">
                    {t.steps.language.subtitle}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[280px] overflow-y-auto pr-1">
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const isSelected = selectedLanguage === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          setSelectedLanguage(lang.code as SupportedLanguage);
                          speakCurrentGuide(lang.code);
                        }}
                        className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 dark:bg-[#8B5CF6]/20 shadow-sm'
                            : 'border-[#0A0A0A]/10 dark:border-[#FFFFFF]/10 hover:border-[#8B5CF6]/40 bg-[#FBF9F5] dark:bg-[#1E2638]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-base font-bold text-[#0A0A0A] dark:text-[#FFFFFF]">
                            {lang.nativeName}
                          </span>
                          <span className="text-[11px] font-mono text-[#0A0A0A]/50 dark:text-[#FFFFFF]/50 uppercase">
                            {lang.englishName}
                          </span>
                        </div>
                        <p className="text-xs text-[#0A0A0A]/70 dark:text-[#FFFFFF]/70 line-clamp-1">
                          {lang.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 2: NAME */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0.7, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex flex-col gap-4 max-w-lg mx-auto w-full"
              >
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0A0A0A] dark:text-[#FFFFFF]">
                    {t.steps.name.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#0A0A0A]/60 dark:text-[#FFFFFF]/60 mt-1">
                    {t.steps.name.subtitle}
                  </p>
                </div>

                <div className="relative mt-2">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8B5CF6]">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setNameError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleNextStep2()}
                    placeholder={t.steps.name.placeholder}
                    className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-[#F8F6F0] dark:bg-[#1E2638] border border-[#0A0A0A]/10 dark:border-[#FFFFFF]/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] transition-all text-[#0A0A0A] dark:text-[#FFFFFF]"
                    autoFocus
                  />
                </div>

                {nameError && (
                  <p className="text-xs font-medium text-rose-500 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> {nameError}
                  </p>
                )}

                <p className="text-xs text-[#0A0A0A]/50 dark:text-[#FFFFFF]/50">
                  {t.steps.name.helpText}
                </p>

                {/* Choose your companion: Girl / Boy */}
                <div className="pt-2">
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#0A0A0A]/70 dark:text-[#FFFFFF]/70 mb-2">
                    Choose your companion
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Girl Option (Default) */}
                    <button
                      type="button"
                      onClick={() => handleSelectCompanion('girl')}
                      className={`relative p-3 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer text-left ${
                        companion === 'girl'
                          ? 'border-pink-500 bg-pink-500/10 ring-2 ring-pink-500/30'
                          : 'border-[#0A0A0A]/10 dark:border-[#FFFFFF]/10 hover:border-pink-500/40 bg-[#FBF9F5] dark:bg-[#1E2638]/50'
                      }`}
                    >
                      <div className="w-12 h-14 rounded-xl overflow-hidden bg-pink-100/50 dark:bg-pink-950/30 shrink-0 border border-pink-200/50 flex items-center justify-center">
                        <img
                          src="/avatars/girl.png"
                          alt="Girl Companion"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-[#0A0A0A] dark:text-[#FFFFFF]">
                            Girl
                          </span>
                          {companion === 'girl' && (
                            <span className="text-pink-500 text-xs font-bold font-mono">✓ Selected</span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#0A0A0A]/60 dark:text-[#FFFFFF]/60 block truncate">
                          gentle & empathetic
                        </span>
                      </div>
                    </button>

                    {/* Boy Option */}
                    <button
                      type="button"
                      onClick={() => handleSelectCompanion('boy')}
                      className={`relative p-3 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer text-left ${
                        companion === 'boy'
                          ? 'border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/30'
                          : 'border-[#0A0A0A]/10 dark:border-[#FFFFFF]/10 hover:border-cyan-500/40 bg-[#FBF9F5] dark:bg-[#1E2638]/50'
                      }`}
                    >
                      <div className="w-12 h-14 rounded-xl overflow-hidden bg-cyan-100/50 dark:bg-cyan-950/30 shrink-0 border border-cyan-200/50 flex items-center justify-center">
                        <img
                          src="/avatars/boy.png"
                          alt="Boy Companion"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-[#0A0A0A] dark:text-[#FFFFFF]">
                            Boy
                          </span>
                          {companion === 'boy' && (
                            <span className="text-cyan-500 text-xs font-bold font-mono">✓ Selected</span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#0A0A0A]/60 dark:text-[#FFFFFF]/60 block truncate">
                          grounded & calm
                        </span>
                      </div>
                    </button>
                  </div>
                  <p className="text-[10px] font-mono text-[#0A0A0A]/40 dark:text-[#FFFFFF]/40 mt-1.5">
                    Default is Girl. You can change your companion anytime in Edit Profile.
                  </p>

                  {/* Companion Name */}
                  <div className="pt-3">
                    <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#0A0A0A]/70 dark:text-[#FFFFFF]/70 mb-1.5">
                      Companion Name
                    </label>
                    <input
                      type="text"
                      value={companionName}
                      onChange={(e) => setCompanionName(e.target.value)}
                      placeholder={companion === 'boy' ? 'Aarav' : 'Maya'}
                      className="w-full px-4 py-3 rounded-2xl bg-[#F8F6F0] dark:bg-[#1E2638] border border-[#0A0A0A]/10 dark:border-[#FFFFFF]/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] transition-all text-[#0A0A0A] dark:text-[#FFFFFF]"
                    />
                    <p className="text-[10px] font-mono text-[#0A0A0A]/40 dark:text-[#FFFFFF]/40 mt-1">
                      Default is {companion === 'boy' ? 'Aarav' : 'Maya'}. You can personalize this anytime in Edit Profile.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3: AGE & MINOR-SAFE MODE */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0.7, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex flex-col gap-4 max-w-lg mx-auto w-full"
              >
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0A0A0A] dark:text-[#FFFFFF]">
                    {t.steps.age.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#0A0A0A]/60 dark:text-[#FFFFFF]/60 mt-1">
                    {t.steps.age.subtitle}
                  </p>
                </div>

                <div className="flex items-center gap-4 mt-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8B5CF6]">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <input
                      type="number"
                      min={13}
                      max={100}
                      value={age}
                      placeholder="Enter age (13-100)"
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                        setAge(val as any);
                        setAgeError('');
                      }}
                      className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-[#F8F6F0] dark:bg-[#1E2638] border border-[#0A0A0A]/10 dark:border-[#FFFFFF]/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] transition-all text-[#0A0A0A] dark:text-[#FFFFFF]"
                    />
                  </div>
                  <span className="text-sm font-medium text-[#0A0A0A]/60 dark:text-[#FFFFFF]/60">
                    Years Old
                  </span>
                </div>

                {ageError && (
                  <p className="text-xs font-medium text-rose-500 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> {ageError}
                  </p>
                )}

                {/* Under 18 Minor Safe Mode Activation Card */}
                {isMinor && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex flex-col gap-3"
                  >
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-xs uppercase tracking-wider">
                      <ShieldCheck className="w-4 h-4" />
                      {t.steps.age.minorSafeActive}
                    </div>
                    <p className="text-xs text-emerald-900/80 dark:text-emerald-200/80 leading-relaxed">
                      {t.steps.age.minorSafeDesc} Childline India (1098) support is actively prioritized.
                    </p>
                    <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={guardianConsent}
                        onChange={(e) => {
                          setGuardianConsent(e.target.checked);
                          setAgeError('');
                        }}
                        className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-medium text-emerald-950 dark:text-emerald-100">
                        {t.steps.age.guardianConsentCheckbox}
                      </span>
                    </label>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* STEP 4: CONTACT & OTP VERIFICATION */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0.7, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex flex-col gap-4 max-w-lg mx-auto w-full"
              >
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0A0A0A] dark:text-[#FFFFFF]">
                    {t.steps.contact.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#0A0A0A]/60 dark:text-[#FFFFFF]/60 mt-1">
                    {t.steps.contact.subtitle}
                  </p>
                </div>

                {/* Phone Field (Primary for OTP) */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[#0A0A0A]/70 dark:text-[#FFFFFF]/70 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#8B5CF6]" />
                      Mobile Number (OTP Verification)
                    </span>
                    <span className="text-[10px] font-mono text-[#8B5CF6]">Required</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    disabled={emailVerified}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-3 rounded-2xl bg-[#F8F6F0] dark:bg-[#1E2638] border border-[#0A0A0A]/10 dark:border-[#FFFFFF]/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] transition-all disabled:opacity-60 text-[#0A0A0A] dark:text-[#FFFFFF]"
                  />
                  {contactErrors.phone && (
                    <span className="text-xs text-rose-500 font-medium">
                      {contactErrors.phone}
                    </span>
                  )}
                </div>

                {/* Email Field (Optional) */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[#0A0A0A]/70 dark:text-[#FFFFFF]/70 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-[#8B5CF6]" />
                      {t.steps.contact.emailLabel}
                    </span>
                    <span className="text-[10px] font-mono text-white/40">Optional</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    disabled={emailVerified}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com (optional)"
                    className="w-full px-4 py-3 rounded-2xl bg-[#F8F6F0] dark:bg-[#1E2638] border border-[#0A0A0A]/10 dark:border-[#FFFFFF]/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] transition-all disabled:opacity-60 text-[#0A0A0A] dark:text-[#FFFFFF]"
                  />
                  {contactErrors.email && (
                    <span className="text-xs text-rose-500 font-medium">
                      {contactErrors.email}
                    </span>
                  )}
                </div>

                {/* Consent Checkbox */}
                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={contactConsent}
                    disabled={emailVerified}
                    onChange={(e) => setContactConsent(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded text-[#8B5CF6] focus:ring-[#8B5CF6]"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-[#0A0A0A]/85 dark:text-[#FFFFFF]/85">
                      {t.steps.contact.consentCheckbox}
                    </span>
                    <span className="text-[11px] text-[#0A0A0A]/50 dark:text-[#FFFFFF]/50 mt-0.5">
                      {t.steps.contact.consentDetails}
                    </span>
                  </div>
                </label>
                {contactErrors.consent && (
                  <span className="text-xs text-rose-500 font-medium">
                    {contactErrors.consent}
                  </span>
                )}

                {/* Auto-Save from Chat Feature Explanation */}
                <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <span className="font-bold text-cyan-900 dark:text-cyan-200">
                      Auto-Save From Chat (Default On)
                    </span>
                    <p className="text-[11px] text-cyan-950/80 dark:text-cyan-100/70 leading-relaxed font-sans">
                      As you talk with your companion, details you mention (such as mood, sleep, stress, memories, or goals) are automatically organized into your Mental Twin and Memory Center. Every entry has a 1-click Undo toast, is fully editable & deletable, and can be switched to Manual Only mode anytime in Settings.
                    </p>
                  </div>
                </div>

                {/* OTP Verification Section */}
                {!emailVerified ? (
                  <div className="flex flex-col gap-3 pt-2">
                    {!otpSent ? (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={isSendingOtp}
                        className="w-full py-3.5 rounded-2xl bg-[#0A0A0A] dark:bg-[#FFFFFF] text-[#FFFFFF] dark:text-[#0A0A0A] text-xs font-mono font-bold tracking-widest uppercase hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isSendingOtp ? t.common.loading : t.steps.contact.sendOtp}
                      </button>
                    ) : (
                      <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/30">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#8B5CF6]">
                            Enter 6-Digit OTP Code
                          </span>
                          {devOtpHint && (
                            <span className="text-[10px] font-mono bg-white dark:bg-black px-2 py-0.5 rounded text-[#8B5CF6]">
                              Dev Code: {devOtpHint}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            placeholder={t.steps.contact.otpPlaceholder}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-[#1E2638] border border-[#8B5CF6]/40 text-center font-mono text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                          />
                          <button
                            type="button"
                            onClick={handleVerifyOtp}
                            disabled={isVerifyingOtp}
                            className="px-5 py-2.5 rounded-xl bg-[#8B5CF6] text-white text-xs font-mono font-bold uppercase hover:bg-[#7C3AED] transition-colors"
                          >
                            {isVerifyingOtp ? t.common.loading : t.steps.contact.verifyOtp}
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[#0A0A0A]/60 dark:text-[#FFFFFF]/60 pt-1">
                          <span>Did not receive code?</span>
                          <button
                            type="button"
                            disabled={resendCooldown > 0}
                            onClick={handleSendOtp}
                            className="text-[#8B5CF6] font-semibold hover:underline disabled:opacity-50"
                          >
                            {resendCooldown > 0
                              ? `Resend in ${resendCooldown}s`
                              : t.steps.contact.resendOtp}
                          </button>
                        </div>
                      </div>
                    )}

                    {otpError && (
                      <p className="text-xs font-medium text-rose-500 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> {otpError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 flex items-center gap-2 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
                    <Check className="w-4 h-4 text-emerald-600" />
                    {t.steps.contact.otpVerifiedSuccess}
                  </div>
                )}

                {/* Privacy Badge */}
                <div className="p-3 rounded-2xl bg-[#0A0A0A]/5 dark:bg-[#FFFFFF]/5 flex items-center gap-2.5 text-[11px] text-[#0A0A0A]/60 dark:text-[#FFFFFF]/60">
                  <Lock className="w-4 h-4 text-[#8B5CF6] shrink-0" />
                  <span>{t.steps.contact.neverSentToLlm}</span>
                </div>
              </motion.div>
            )}

            {/* STEP 5: LIVE PHOTO-AVATAR PIPELINE */}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0.7, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex flex-col gap-4 max-w-lg mx-auto w-full items-center text-center"
              >
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0A0A0A] dark:text-[#FFFFFF]">
                    {t.steps.photo.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#0A0A0A]/60 dark:text-[#FFFFFF]/60 mt-1">
                    {t.steps.photo.subtitle}
                  </p>
                </div>

                {/* Live 3D Avatar Preview Container */}
                <div className="w-52 h-52 rounded-3xl border-2 border-dashed border-[#8B5CF6]/50 flex items-center justify-center overflow-hidden bg-[#FBF9F5] dark:bg-[#1E2638] relative shadow-inner">
                  {cameraActive ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : appearanceAttrs ? (
                    <div className="w-full h-full relative">
                      <VRMAvatarCanvas
                        companion={companion}
                        gender={companion}
                        appearanceAttributes={appearanceAttrs}
                        isSpeaking={false}
                        emotion="happy"
                        className="w-full h-full"
                      />
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-violet-600 text-white font-mono text-[9px] font-bold tracking-wider uppercase shadow">
                        3D Live
                      </span>
                    </div>
                  ) : photoDataUrl ? (
                    <img
                      src={photoDataUrl}
                      alt="Avatar preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-[#0A0A0A]/40 dark:text-[#FFFFFF]/40 p-4">
                      <Sparkles className="w-8 h-8 text-[#8B5CF6]" />
                      <span className="text-xs font-mono">Soothing Default 3D Avatar</span>
                    </div>
                  )}

                  {isProcessingPhoto && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white">
                      <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[11px] font-mono">Analyzing colors & features...</span>
                    </div>
                  )}
                </div>

                {/* Camera / Upload Controls */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {cameraActive ? (
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="px-5 py-2.5 rounded-full bg-[#8B5CF6] text-white text-xs font-mono font-bold uppercase shadow cursor-pointer hover:bg-[#7C3AED]"
                    >
                      {t.steps.photo.takePhoto}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-4 py-2 rounded-xl bg-[#F0EDE4] dark:bg-[#1E2638] hover:bg-[#8B5CF6]/15 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5 text-[#8B5CF6]" />
                        {t.steps.photo.cameraButton}
                      </button>

                      <label className="px-4 py-2 rounded-xl bg-[#F0EDE4] dark:bg-[#1E2638] hover:bg-[#8B5CF6]/15 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer">
                        <Upload className="w-3.5 h-3.5 text-[#8B5CF6]" />
                        {t.steps.photo.uploadButton}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </>
                  )}

                  {appearanceAttrs && !cameraActive && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowAdjustControls(!showAdjustControls)}
                        className="px-3.5 py-2 rounded-xl border border-violet-400 text-violet-700 dark:text-violet-300 text-xs font-mono font-semibold hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors cursor-pointer"
                      >
                        {showAdjustControls ? 'Close Adjust' : 'Adjust Appearance'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAppearanceAttrs(null);
                          setPhotoDataUrl(null);
                          setShowAdjustControls(false);
                        }}
                        className="px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs font-mono hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        Reset
                      </button>
                    </>
                  )}
                </div>

                {/* Adjust Appearance Drawer */}
                {showAdjustControls && appearanceAttrs && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="w-full max-w-sm p-3.5 rounded-2xl bg-[#FBF9F5] dark:bg-[#1E2638]/70 border border-violet-500/30 flex flex-col gap-2.5 text-left text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0A0A0A] dark:text-[#FFFFFF] font-mono">Fine-Tune 3D Avatar</span>
                      <span className="text-[10px] text-violet-600 font-mono">Live Sync</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-mono text-[#0A0A0A]/60 dark:text-[#FFFFFF]/60">Skin Tone</span>
                        <input
                          type="color"
                          value={appearanceAttrs.skin_tone_hex || '#F0C8A0'}
                          onChange={(e) =>
                            setAppearanceAttrs({ ...appearanceAttrs, skin_tone_hex: e.target.value })
                          }
                          className="w-full h-8 rounded-lg cursor-pointer bg-transparent border border-black/10"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-mono text-[#0A0A0A]/60 dark:text-[#FFFFFF]/60">Hair Color</span>
                        <input
                          type="color"
                          value={appearanceAttrs.hair_color_hex || '#2C1B18'}
                          onChange={(e) =>
                            setAppearanceAttrs({ ...appearanceAttrs, hair_color_hex: e.target.value })
                          }
                          className="w-full h-8 rounded-lg cursor-pointer bg-transparent border border-black/10"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-mono text-[#0A0A0A]/60 dark:text-[#FFFFFF]/60">Eye Color</span>
                        <input
                          type="color"
                          value={appearanceAttrs.eye_color_hex || '#3D2314'}
                          onChange={(e) =>
                            setAppearanceAttrs({ ...appearanceAttrs, eye_color_hex: e.target.value })
                          }
                          className="w-full h-8 rounded-lg cursor-pointer bg-transparent border border-black/10"
                        />
                      </label>
                    </div>

                    <label className="flex items-center gap-2 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(appearanceAttrs.glasses)}
                        onChange={(e) =>
                          setAppearanceAttrs({ ...appearanceAttrs, glasses: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500"
                      />
                      <span className="text-xs font-medium text-[#0A0A0A]/80 dark:text-[#FFFFFF]/80">
                        Include Glasses
                      </span>
                    </label>
                  </motion.div>
                )}

                {/* Consent checkbox for AI feature detection */}
                <label className="flex items-center gap-2 cursor-pointer text-left text-[11px] text-[#0A0A0A]/60 dark:text-[#FFFFFF]/60 max-w-sm">
                  <input
                    type="checkbox"
                    checked={consentGeminiAnalysis}
                    onChange={(e) => setConsentGeminiAnalysis(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-violet-600 focus:ring-violet-500 shrink-0"
                  />
                  <span>Allow transient AI analysis (glasses, hairstyle). Photo is never saved.</span>
                </label>

                <p className="text-[11px] text-[#0A0A0A]/50 dark:text-[#FFFFFF]/50 max-w-sm">
                  {t.steps.photo.clientSideNotice}
                </p>
              </motion.div>
            )}

            {/* STEP 6: OPTIONAL VOICE SETUP */}
            {step === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0.7, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex flex-col gap-4 max-w-lg mx-auto w-full"
              >
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0A0A0A] dark:text-[#FFFFFF]">
                    {t.steps.voice.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#0A0A0A]/60 dark:text-[#FFFFFF]/60 mt-1">
                    {t.steps.voice.subtitle}
                  </p>
                </div>

                {/* Mic Permission Test Card */}
                <div className="p-4 rounded-2xl bg-[#FBF9F5] dark:bg-[#1E2638]/50 border border-[#0A0A0A]/10 dark:border-[#FFFFFF]/10 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#0A0A0A]/70 dark:text-[#FFFFFF]/70 flex items-center gap-1.5">
                      <Mic className="w-4 h-4 text-[#8B5CF6]" />
                      Microphone Access (Voice Input)
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        micStatus === 'granted'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-zinc-200 text-zinc-700'
                      }`}
                    >
                      {micStatus === 'granted' ? 'CONNECTED' : 'OPTIONAL'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={testMicrophone}
                      className="px-4 py-2.5 rounded-xl bg-[#8B5CF6] text-white text-xs font-mono font-bold uppercase hover:bg-[#7C3AED] transition-colors"
                    >
                      {micStatus === 'testing'
                        ? t.steps.voice.micTesting
                        : t.steps.voice.micTestButton}
                    </button>

                    {micStatus === 'testing' && (
                      <div className="flex-1 h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-100"
                          style={{ width: `${audioLevel}%` }}
                        />
                      </div>
                    )}

                    {micStatus === 'granted' && (
                      <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        {t.steps.voice.micGranted}
                      </span>
                    )}
                  </div>
                </div>

                {/* Companion Voice Timbre — filtered strictly by chosen companion gender */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#0A0A0A]/70 dark:text-[#FFFFFF]/70">
                      {t.steps.voice.voiceSelectLabel}
                      <span className="ml-2 text-[10px] font-mono text-[#8B5CF6]">
                        {companion === 'boy' ? '♂ Boy Companion' : '♀ Girl Companion'}
                      </span>
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {availableTones.map((v) => {
                      const isSelected = selectedVoice === v.id || (!selectedVoice && v.id === availableTones[0].id);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVoice(v.id)}
                          className={`p-3 rounded-2xl border text-center transition-all ${
                            isSelected
                              ? 'border-[#8B5CF6] bg-[#8B5CF6]/15 font-bold shadow-sm'
                              : 'border-[#0A0A0A]/10 dark:border-[#FFFFFF]/10 hover:border-[#8B5CF6]/30 bg-[#FBF9F5] dark:bg-[#1E2638]/40'
                          }`}
                        >
                          <div className="text-xs font-bold">{v.name}</div>
                          <div className="text-[10px] text-[#0A0A0A]/50 dark:text-[#FFFFFF]/50 mt-0.5">
                            {v.style}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={playVoiceSample}
                  disabled={isAudioPreviewPlaying}
                  className="py-2.5 px-4 rounded-xl border border-[#8B5CF6]/30 text-xs font-mono font-semibold text-[#8B5CF6] hover:bg-[#8B5CF6]/10 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  {isAudioPreviewPlaying ? 'Playing sample...' : t.steps.voice.playPreview}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Navigation Bar */}
        <div className="px-6 py-4 border-t border-[#0A0A0A]/5 dark:border-[#FFFFFF]/5 flex items-center justify-between bg-[#FBF9F5] dark:bg-[#151C2C]/50">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2.5 rounded-full border border-[#0A0A0A]/20 dark:border-[#FFFFFF]/20 text-xs font-mono font-semibold uppercase hover:bg-[#0A0A0A]/5 dark:hover:bg-[#FFFFFF]/5 transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {t.common.back}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDeleteDataClick}
                className="text-[11px] font-mono text-rose-500/80 hover:text-rose-600 transition-colors flex items-center gap-1"
                title="Permanently erase all stored messages and contacts under DPDP Act"
              >
                <Trash2 className="w-3 h-3" />
                {t.common.deleteData}
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
            {/* Inline validation hint when next button is disabled */}
            {step === 1 && !isStep1Valid && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">
                Please select a language
              </span>
            )}
            {step === 2 && !isStep2Valid && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">
                Enter name (2+ characters) and select companion
              </span>
            )}
            {step === 3 && !isStep3Valid && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">
                Enter age (13-100){typeof age === 'number' && age < 18 && !guardianConsent ? ' with guardian consent' : ''}
              </span>
            )}
            {step === 4 && !isStep4Valid && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">
                Verify mobile OTP or use 'Skip for now'
              </span>
            )}

            {/* Skip for now option available on every onboarding step */}
            <button
              type="button"
              onClick={() => handleSkipStep(step)}
              className="px-4 py-2.5 rounded-full text-xs font-mono font-medium text-[#0A0A0A]/60 dark:text-[#FFFFFF]/60 hover:text-[#0A0A0A] dark:hover:text-[#FFFFFF] hover:bg-[#0A0A0A]/5 dark:hover:bg-[#FFFFFF]/5 transition-colors cursor-pointer"
            >
              Skip for now
            </button>

            {step === 1 && (
              <button
                type="button"
                onClick={handleNextStep1}
                disabled={!isStep1Valid}
                className="px-6 py-3 rounded-full bg-[#0A0A0A] dark:bg-[#FFFFFF] text-[#FFFFFF] dark:text-[#0A0A0A] text-xs font-mono font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                {t.common.next}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleNextStep2}
                disabled={!isStep2Valid}
                className="px-6 py-3 rounded-full bg-[#0A0A0A] dark:bg-[#FFFFFF] text-[#FFFFFF] dark:text-[#0A0A0A] text-xs font-mono font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                {t.common.next}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleNextStep3}
                disabled={!isStep3Valid}
                className="px-6 py-3 rounded-full bg-[#0A0A0A] dark:bg-[#FFFFFF] text-[#FFFFFF] dark:text-[#0A0A0A] text-xs font-mono font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                {t.common.next}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 4 && (
              <button
                type="button"
                onClick={() => setStep(5)}
                disabled={!isStep4Valid}
                className="px-6 py-3 rounded-full bg-[#0A0A0A] dark:bg-[#FFFFFF] text-[#FFFFFF] dark:text-[#0A0A0A] text-xs font-mono font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                {t.common.next}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 5 && (
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setStep(6);
                }}
                className="px-6 py-3 rounded-full bg-[#0A0A0A] dark:bg-[#FFFFFF] text-[#FFFFFF] dark:text-[#0A0A0A] text-xs font-mono font-bold uppercase tracking-wider hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                {t.common.next}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 6 && (
              <button
                type="button"
                onClick={handleFinish}
                className="px-8 py-3.5 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white text-xs font-mono font-bold uppercase tracking-widest hover:opacity-95 transition-opacity flex items-center gap-2 cursor-pointer shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                {t.steps.voice.finishButton}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
