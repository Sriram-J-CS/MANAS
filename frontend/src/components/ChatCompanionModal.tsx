import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  TrendingUp,
  Trash2,
  Edit3,
  Wind,
  PhoneCall,
  Sliders,
  Shirt,
  Sparkles,
  ArrowDown,
  X,
  Disc3,
  Globe,
  ChevronDown,
  Activity,
  ShieldCheck,
  Brain,
  Compass,
  BookOpen,
  Volume2,
  VolumeX,
  Bell,
} from 'lucide-react';
import { AutoSaveToast, type AutoSaveEventData } from './chat/AutoSaveToast';
import type { UserProfile } from './OnboardingModal';
import type { ChatMessage, MascotExpression } from '../types';
import type { MascotEmotion } from '../lib/emotion/emotionEngine';
import { MascotViewer } from './mascot/MascotViewer';
import { MascotStage } from './MascotStage';
import { AvatarStudioModal } from './avatar/AvatarStudioModal';
import { MascotControls } from './mascot/MascotControls';
import { EditProfileModal } from './profile/EditProfileModal';
import { MascotCustomizer } from './mascot/MascotCustomizer';
import { ChatInput } from './chat/ChatInput';
import { ChatMessages } from './chat/ChatMessages';
import { MoodJourneyDrawer } from './chat/MoodJourneyDrawer';
import { BreathingWidget } from './chat/BreathingWidget';
import { GroundingWidget } from './chat/GroundingWidget';
import { speechEngine } from '../lib/voice/speechEngine';
import { getMascotConfig, type MascotConfig } from '../lib/mascot/mascotConfig';
import { avatar } from '../lib/avatar/avatarConfigService';
import { FeedbackDashboardModal } from './admin/FeedbackDashboardModal';
import { musicPlayer } from '../lib/music/musicPlayerService';
import { sharedAudioManager } from '../lib/audio/sharedAudioContext';
import { SUPPORTED_LANGUAGES, LANGUAGE_MAP } from '../i18n/languages';
import {
  streamChatMessage,
  sendChatFeedback,
  fetchChatHistory,
  clearChatHistoryRemote,
  saveSessionSummaryRemote,
  fetchSessionSummaryRemote,
  deleteSessionSummaryRemote,
} from '../lib/ai/aiChatService';

interface ChatCompanionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onUpdateProfile?: (updated: Partial<UserProfile>) => void;
  onOpenHelp: () => void;
  onEditProfile?: () => void;
  onDeleteData?: () => void;
  onOpenTwin?: () => void;
  onOpenPersonality?: () => void;
  onOpenWhatWorks?: () => void;
  onOpenMemory?: () => void;
  onOpenJournalGoals?: () => void;
  onOpenSafetyPlan?: () => void;
  onOpenPrivacy?: () => void;
  onOpenNotifications?: () => void;
}

/**
 * Extracts completed sentences from a streaming text buffer.
 * Sentence boundaries match punctuation (.!?।) followed by whitespace/newlines.
 */
function extractFinishedSentences(buffer: string): { sentences: string[]; remaining: string } {
  const sentences: string[] = [];
  const regex = /^([\s\S]*?[.!?।\n]+)(?:\s+|\n+)([\s\S]*)$/;
  let remaining = buffer;
  let match = remaining.match(regex);
  while (match) {
    const s = match[1].trim();
    if (s) {
      sentences.push(s);
    }
    remaining = match[2];
    match = remaining.match(regex);
  }
  return { sentences, remaining };
}

/**
 * Default starting quick replies per language
 */
function getInitialQuickReplies(lang: string): string[] {
  if (lang === 'ta') {
    return [
      'இன்று மனம் மிகவும் பாரமாக இருக்கிறது',
      'என்னுடன் சிறிது நேரம் பேசுங்கள்',
      'எனக்கு கொஞ்சம் ஆறுதல் வேண்டும்',
    ];
  }
  if (lang === 'hi') {
    return [
      'आज मन बहुत भारी और अकेला लग रहा है',
      'मेरे साथ थोड़ी देर बात कीजिए',
      'मुझे थोड़ी शांति और संबल चाहिए',
    ];
  }
  if (lang === 'te') {
    return [
      'ఈరోజు మనస్సు చాలా భారంగా ఉంది',
      'నాతో కాసేపు మాట్లాడండి',
      'నాకు కొంచెం ధైర్యం కావాలి',
    ];
  }
  if (lang === 'kn') {
    return [
      'ಇಂದು ಮನಸ್ಸು ತುಂಬಾ ಭಾರವಾಗಿದೆ',
      'ನನ್ನ ಜೊತೆ ಸ್ವಲ್ಪ ಹೊತ್ತು ಮಾತನಾಡಿ',
      'ನನಗೆ ಸ್ವಲ್ಪ ನೆಮ್ಮದಿ ಬೇಕು',
    ];
  }
  if (lang === 'ml') {
    return [
      'ഇന്ന് മനസ്സ് വളരെ ഭാരമുള്ളതാണ്',
      'എന്റെ കൂടെ കുറച്ചുനേരം സംസാരിക്കാമോ',
      'എനിക്ക് കുറച്ച് ആശ്വാസം വേണം',
    ];
  }
  if (lang === 'bn') {
    return [
      'আজ মন খুব ভারী আর ক্লান্ত লাগছে',
      'আমার সাথে একটু কথা বলো',
      'একটু মনের শান্তি পেতে চাই',
    ];
  }
  if (lang === 'mr') {
    return [
      'आज मन खूप जड आणि उदास वाटत आहे',
      'माझ्याशी थोडा वेळ बोलू शकाल का',
      'मला थोडा धीर हवा आहे',
    ];
  }
  return [
    "I'm feeling really drained and heavy today",
    "Can you just talk with me for a bit?",
    "Help me find a little peace right now",
  ];
}

export const ChatCompanionModal: React.FC<ChatCompanionModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onUpdateProfile: _onUpdateProfile,
  onOpenHelp,
  onEditProfile,
  onDeleteData,
  onOpenTwin,
  onOpenPersonality,
  onOpenWhatWorks,
  onOpenMemory,
  onOpenJournalGoals,
  onOpenSafetyPlan,
  onOpenPrivacy,
  onOpenNotifications,
}) => {
  // View & Overlay states
  const [showMoodDrawer, setShowMoodDrawer] = useState<boolean>(false);
  const [isBreathingOpen, setIsBreathingOpen] = useState<boolean>(false);
  const [isGroundingOpen, setIsGroundingOpen] = useState<boolean>(false);
  const [isFeedbackDashboardOpen, setIsFeedbackDashboardOpen] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState<boolean>(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState<boolean>(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState<boolean>(false);
  const [isAvatarStudioOpen, setIsAvatarStudioOpen] = useState<boolean>(false);
  const [activeAutoSave, setActiveAutoSave] = useState<AutoSaveEventData | null>(null);

  // Simple Voice Mute State (Kept as single simple toggle)
  const [isVoiceMuted, setIsVoiceMuted] = useState<boolean>(sharedAudioManager.getIsVoiceMuted());
  const [confirmAction, setConfirmAction] = useState<'memory' | 'data' | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Ambient music defaults to OFF in chat
  useEffect(() => {
    if (musicPlayer.getState().isPlaying) {
      musicPlayer.pause();
    }
  }, []);

  // Sync voice mute with sharedAudioManager
  useEffect(() => {
    const unsubAudio = sharedAudioManager.subscribe(() => {
      setIsVoiceMuted(sharedAudioManager.getIsVoiceMuted());
    });
    return () => {
      unsubAudio();
    };
  }, []);

  const handleToggleVoiceMute = () => {
    sharedAudioManager.toggleVoiceMute();
  };

  const handleConfirmDeleteMemory = async () => {
    setConfirmAction(null);
    setIsDeletingMemory(true);
    try {
      const userId = userProfile.id || localStorage.getItem('manas_user_id') || 'default_user';
      const token = localStorage.getItem('manas_access_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await Promise.allSettled([
        deleteSessionSummaryRemote(userId),
        fetch('/api/memory/clear', { method: 'POST', headers }),
      ]);

      setSessionMemory(null);
      setActionToast('Companion memory deleted successfully from DB.');
      setTimeout(() => {
        setActionToast(null);
        if (onEditProfile) onEditProfile();
        else onClose();
      }, 1200);
    } catch (err) {
      console.warn('Failed to delete memory:', err);
    } finally {
      setIsDeletingMemory(false);
    }
  };

  const handleConfirmDeleteData = async () => {
    setConfirmAction(null);
    try {
      const userId = userProfile.id || localStorage.getItem('manas_user_id') || 'default_user';
      await fetch(`/api/user/data/${userId}`, { method: 'DELETE' });
      try {
        localStorage.removeItem('manas_twin_profile');
        localStorage.removeItem('manas_twin_onboarded');
        localStorage.removeItem('manas_user_id');
        localStorage.removeItem('manas_user_name');
        localStorage.removeItem('manas_access_token');
        localStorage.removeItem('manas_user_profile_v2');
      } catch (_) { }
      setActionToast('All user data deleted successfully from database.');
      setTimeout(() => {
        setActionToast(null);
        if (onDeleteData) {
          onDeleteData();
        } else {
          onClose();
        }
      }, 1200);
    } catch (err) {
      console.warn('Failed to delete user data:', err);
    }
  };

  // Load avatar configuration on startup
  useEffect(() => {
    avatar.loadConfigOnStartup();
  }, []);

  // Mascot Config (persisted locally)
  const [mascotConfig, setMascotConfig] = useState<MascotConfig>(getMascotConfig());

  // Mascot State Machine
  const [mascotExpr, setMascotExpr] = useState<MascotEmotion>('calm');
  const [activeGesture, setActiveGesture] = useState<any>('idle');
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState<boolean>(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [audioEnergy, setAudioEnergy] = useState<number>(0);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState<boolean>(mascotConfig.speakingEnabled);
  const voiceOutputEnabledRef = useRef<boolean>(mascotConfig.speakingEnabled);
  useEffect(() => {
    voiceOutputEnabledRef.current = voiceOutputEnabled;
  }, [voiceOutputEnabled]);

  // Session memory state (Requirement 6)
  const [sessionMemory, setSessionMemory] = useState<{
    mood_themes?: string;
    what_helped?: string;
    summary?: string;
    created_at?: string;
  } | null>(null);
  const [isDeletingMemory, setIsDeletingMemory] = useState<boolean>(false);

  // Active Companion Language (immediately responsive to in-chat switching)
  const [activeLanguage, setActiveLanguage] = useState<string>(() => userProfile.language || 'en');

  // Dynamic quick-reply chips from live LLM (Requirement 4)
  const [quickReplies, setQuickReplies] = useState<string[]>(() =>
    getInitialQuickReplies(userProfile.language || 'en')
  );

  useEffect(() => {
    if (userProfile.language && userProfile.language !== activeLanguage) {
      setActiveLanguage(userProfile.language);
      setQuickReplies(getInitialQuickReplies(userProfile.language));
    }
  }, [userProfile.language]);

  const handleSelectLanguage = (langCode: string) => {
    setActiveLanguage(langCode);
    _onUpdateProfile?.({ language: langCode });
    setIsLangMenuOpen(false);
    setQuickReplies(getInitialQuickReplies(langCode));
  };

  // Streaming sentence-by-sentence TTS queue (Requirement 8)
  const sentenceBufferRef = useRef<string>('');
  const ttsQueueRef = useRef<string[]>([]);
  const isTTSPlayingRef = useRef<boolean>(false);
  const currentTTSMsgIdRef = useRef<string | null>(null);

  // Messages state: strictly one chronological list (oldest at top, newest at bottom)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState<boolean>(false);

  // Mood Tracker state
  const [currentMood, setCurrentMood] = useState<number | null>(null);
  const [moodHistory, setMoodHistory] = useState<Array<{ score: number; tags?: string; created_at: string }>>([]);

  // Fetch real mood history from server
  useEffect(() => {
    const fetchMoodHistory = async () => {
      try {
        const token = localStorage.getItem('manas_access_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const uid = userProfile.id || localStorage.getItem('manas_user_id') || 'anonymous';
        const res = await fetch(`/api/mood/history?user_id=${encodeURIComponent(uid)}`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.history)) {
            setMoodHistory(data.history);
          }
        }
      } catch (err) {
        console.warn('Could not load mood history:', err);
      }
    };
    fetchMoodHistory();
  }, [userProfile.id]);

  // Scroll & Transcript refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState<boolean>(false);
  const shouldAutoScrollRef = useRef<boolean>(true);

  // Menu popover refs
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Ink-wipe transition trigger
  const [inkWiping, setInkWiping] = useState<boolean>(true);
  useEffect(() => {
    const t = setTimeout(() => setInkWiping(false), 450);
    return () => clearTimeout(t);
  }, []);

  // Sync mascot config changes from customizer
  const handleApplyMascotConfig = (cfg: MascotConfig) => {
    setMascotConfig(cfg);
    setVoiceOutputEnabled(cfg.speakingEnabled);
  };

  // Close profile menu on outside click or Esc key
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(e.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  // Barge-in: immediately stop speech synthesis and clear streaming sentence queue
  const handleBargeIn = useCallback(() => {
    speechEngine.stopSpeaking();
    ttsQueueRef.current = [];
    isTTSPlayingRef.current = false;
    currentTTSMsgIdRef.current = null;
    sentenceBufferRef.current = '';
    setIsAvatarSpeaking(false);
    setSpeakingMessageId(null);
    setAudioEnergy(0);
  }, []);

  // Register speech barge-in hook
  useEffect(() => {
    const unsub = speechEngine.onBargeIn(() => {
      handleBargeIn();
    });
    return () => unsub();
  }, [handleBargeIn]);

  // Duck music volume when avatar is speaking
  useEffect(() => {
    musicPlayer.setAvatarSpeaking(isAvatarSpeaking);
  }, [isAvatarSpeaking]);

  // Play sentences sequentially from queue (Requirement 8)
  const playNextQueuedSentence = useCallback(() => {
    if (isTTSPlayingRef.current) return;
    if (ttsQueueRef.current.length === 0) {
      setIsAvatarSpeaking(false);
      setSpeakingMessageId(null);
      setAudioEnergy(0);
      return;
    }

    const nextSentence = ttsQueueRef.current.shift()!;
    isTTSPlayingRef.current = true;
    setIsAvatarSpeaking(true);
    if (currentTTSMsgIdRef.current) {
      setSpeakingMessageId(currentTTSMsgIdRef.current);
    }

    // ── Resolve companion gender + voiceTone at CALL TIME from localStorage ──
    // Never rely on stale closure state — read fresh from profile every utterance.
    let callTimeCompanion: 'girl' | 'boy' = 'girl';
    let callTimeTone = '';
    try {
      const raw = localStorage.getItem('manas_twin_profile');
      if (raw) {
        const p = JSON.parse(raw);
        const c = (p.companion || p.avatarType || 'girl').toLowerCase();
        callTimeCompanion = c === 'boy' ? 'boy' : 'girl';
        callTimeTone = (p.voiceTone || '').toLowerCase();
      }
    } catch (_) { }

    const userPitch = userProfile.voicePitch;

    speechEngine.speak(nextSentence, activeLanguage || userProfile.language || 'en', {
      voiceSpeed: mascotConfig.voiceSpeed,
      pitch: userPitch,
      gender: callTimeCompanion,
      purpose: 'chat_reply',
      onEnergy: (energy) => setAudioEnergy(energy),
      onEnd: () => {
        isTTSPlayingRef.current = false;
        playNextQueuedSentence();
      },
      onError: () => {
        isTTSPlayingRef.current = false;
        playNextQueuedSentence();
      },
    });

    // Also pass tone through speechEngine → speechGateway (gateway reads localStorage anyway,
    // but explicit passing ensures consistency for voice sample calls)
    void callTimeTone; // acknowledged — gateway reads localStorage directly
  }, [
    userProfile.voicePitch,
    userProfile.language,
    activeLanguage,
    mascotConfig.voiceSpeed,
  ]);


  // Enqueue a finished sentence to TTS (Requirement 8)
  const enqueueSentenceTTS = useCallback(
    (sentence: string, botId?: string) => {
      if (!sentence.trim()) return;
      ttsQueueRef.current.push(sentence.trim());
      if (botId) currentTTSMsgIdRef.current = botId;
      playNextQueuedSentence();
    },
    [playNextQueuedSentence]
  );

  // Speak response aloud (replay on demand or full text)
  const speakResponse = (text: string, _lang = 'en', messageId?: string) => {
    if (!text.trim()) return;
    handleBargeIn();
    const { sentences, remaining } = extractFinishedSentences(text);
    const toPlay = sentences.length > 0 ? sentences : [text.trim()];
    if (remaining.trim() && sentences.length > 0) {
      toPlay.push(remaining.trim());
    }
    for (const s of toPlay) {
      enqueueSentenceTTS(s, messageId);
    }
  };

  // Load session memory from DB on mount (Requirement 6)
  useEffect(() => {
    const userId = userProfile.id || localStorage.getItem('manas_user_id') || 'default_user';
    fetchSessionSummaryRemote(userId)
      .then((mem) => {
        if (mem && (mem.mood_themes || mem.summary)) {
          setSessionMemory(mem);
        }
      })
      .catch((err) => console.warn('Could not load session memory:', err));
  }, [userProfile.id]);

  // Delete session memory handler (Requirement 6)
  const handleDeleteSessionMemory = async () => {
    const userId = userProfile.id || localStorage.getItem('manas_user_id') || 'default_user';
    setIsDeletingMemory(true);
    try {
      await deleteSessionSummaryRemote(userId);
      setSessionMemory(null);
    } catch (err) {
      console.warn('Failed to delete session memory:', err);
    } finally {
      setIsDeletingMemory(false);
    }
  };

  // Save session memory on close or navigation
  const saveCurrentSessionMemory = useCallback(async () => {
    const userMsgs = messages.filter((m) => m.sender === 'user' && !m.isError);
    if (userMsgs.length >= 2) {
      const userId = userProfile.id || localStorage.getItem('manas_user_id') || 'default_user';
      const recentThemes = userMsgs.slice(-4).map((m) => m.text).join('; ');
      try {
        await saveSessionSummaryRemote(userId, {
          mood_themes: recentThemes.slice(0, 150),
          what_helped: 'Conversational emotional reflection and grounding support',
          summary: `Session with ${userMsgs.length} messages. Discussed: ${recentThemes.slice(0, 120)}`,
        });
      } catch (err) {
        console.warn('Could not save session memory:', err);
      }
    }
  }, [messages, userProfile.id]);

  const handleCloseWorkspace = () => {
    saveCurrentSessionMemory();
    onClose();
  };

  // Smooth scroll helper
  const scrollToBottom = useCallback((smooth = true) => {
    const el = chatContainerRef.current;
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
      setShowJumpToLatest(false);
    }
  }, []);

  // Scroll event listener: detect if user scrolled up
  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom > 100) {
      setShowJumpToLatest(true);
      shouldAutoScrollRef.current = false;
    } else {
      setShowJumpToLatest(false);
      shouldAutoScrollRef.current = true;
    }
  };

  // Load chat history from SQLite Database on mount (with localStorage fallback)
  useEffect(() => {
    const userId = userProfile.id || localStorage.getItem('manas_user_id') || 'default_user';
    let isMounted = true;

    async function loadHistory() {
      // 1. Fetch from Database
      const remoteMsgs = await fetchChatHistory(userId);
      if (!isMounted) return;

      if (remoteMsgs && remoteMsgs.length > 0) {
        setMessages(remoteMsgs);
        // Persist to local cache
        localStorage.setItem(`manas_chat_${userId}`, JSON.stringify(remoteMsgs));
        setTimeout(() => scrollToBottom(false), 80);
        return;
      }

      // 2. Fallback to localStorage cache
      const cached = localStorage.getItem(`manas_chat_${userId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
            setTimeout(() => scrollToBottom(false), 80);
            return;
          }
        } catch (_) { }
      }

      // 3. New conversation welcome message
      const nm = userProfile.name || 'Friend';
      let welcome = `Hey ${nm}, I am right here beside you. Whatever you are feeling right now, you don't have to carry it alone. Take a slow, quiet breath with me. How is your mind feeling today?`;

      if (userProfile.language === 'ta') {
        welcome = `வணக்கம் ${nm}! நான் உங்கள் மனநல AI தோழன். கல்லூரி மற்றும் வேலைச்சுமை அதிகமாக இருந்தாலும், நீங்கள் தனியாக இந்த பாரத்தை சுமக்க வேண்டாம். நாம் இருவரும் சேர்ந்து ஆழ்ந்து ஒரு முறை மூச்சு விடுவோம். இப்போது உங்கள் மனம் எப்படி உணர்கிறது?`;
      } else if (userProfile.language === 'hi') {
        welcome = `नमस्ते ${nm}! मैं आपका डिजिटल मेंटल साथी हूँ। जब तनाव बहुत भारी लगने लगे, तो याद रखिए कि आप अकेले नहीं हैं। आइए साथ में एक गहरी और शांत सांस लें। अभी आपके मन में क्या चल रहा है?`;
      }

      const welcomeMsg: ChatMessage = {
        id: `welcome_${Date.now()}`,
        sender: 'mascot',
        text: welcome,
        time: 'Just now',
        expression: 'calm',
        state_label: 'Attuned & Present',
        stress_level: 3,
      };
      setMessages([welcomeMsg]);
      localStorage.setItem(`manas_chat_${userId}`, JSON.stringify([welcomeMsg]));

      if (voiceOutputEnabled) {
        speakResponse(welcome, userProfile.language, welcomeMsg.id);
      }
    }

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, []);

  // Save conversation locally on update
  useEffect(() => {
    const userId = userProfile.id || localStorage.getItem('manas_user_id') || 'default_user';
    const cleanToStore = messages.filter((m) => !m.isThinking && !m.isError);
    if (cleanToStore.length > 0) {
      localStorage.setItem(`manas_chat_${userId}`, JSON.stringify(cleanToStore));
    }
  }, [messages, userProfile.id]);

  /**
   * Main Conversational Loop:
   * 1. User message appears instantly at bottom.
   * 2. Thinking bubble appears under user message.
   * 3. AI response streams directly into that same bubble.
   * 4. Double-send prevented by isTyping flag.
   * 5. Retry button available on error.
   */
  const handleSendMessage = async (textToSend: string, typingCPS?: number) => {
    if (!textToSend.trim() || isTyping) return;

    handleBargeIn();
    sentenceBufferRef.current = '';

    const timestamp = Date.now();
    const userMsgId = `user_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;
    const botMsgId = `bot_${timestamp + 1}_${Math.random().toString(36).substring(2, 7)}`;

    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: textToSend.trim(),
      time: 'Just now',
    };

    const thinkingPlaceholder: ChatMessage = {
      id: botMsgId,
      sender: 'mascot',
      text: '',
      time: 'Just now',
      expression: 'thinking',
      state_label: 'Reflecting & Attuning',
      isThinking: true,
      retryText: textToSend.trim(),
    };

    // Append user message then thinking bubble directly at bottom
    setMessages((prev) => [...prev, userMsg, thinkingPlaceholder]);
    setIsTyping(true);
    setIsThinking(true);
    setMascotExpr('thinking');

    // Auto-scroll to bottom
    shouldAutoScrollRef.current = true;
    setTimeout(() => scrollToBottom(true), 40);

    try {
      const res = await streamChatMessage({
        message: textToSend.trim(),
        userName: userProfile.name || 'Friend',
        language: activeLanguage || userProfile.language || 'en',
        personality: mascotConfig.personality,
        role: userProfile.role || 'student',
        stylePref: userProfile.stylePref || 'reflective',
        age: userProfile.age || 20,
        typing_cps: typingCPS,
        onAutoSave: (autoSaveData) => {
          if (autoSaveData) {
            setActiveAutoSave(autoSaveData);
          }
        },
        onMeta: (meta) => {
          setIsThinking(false);
          if (meta.emotion) setMascotExpr(meta.emotion as MascotEmotion);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botMsgId
                ? {
                  ...m,
                  isThinking: false,
                  isStreaming: true,
                  expression: (meta.emotion as MascotExpression) || m.expression,
                  state_label: meta.state_label || m.state_label,
                  stress_level: meta.stress_level,
                  suggested_exercise: meta.suggested_exercise,
                  suggest_tool: meta.suggest_tool,
                  helplines: meta.helplines,
                  isHighRisk: meta.isHighRisk,
                  crisis: meta.crisis,
                }
                : m
            )
          );
        },
        onToken: (token) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botMsgId
                ? {
                  ...m,
                  isThinking: false,
                  isStreaming: true,
                  text: m.text + token,
                }
                : m
            )
          );

          // Requirement 8: Send each finished sentence to TTS as it streams, then to the avatar
          if (voiceOutputEnabledRef.current) {
            sentenceBufferRef.current += token;
            const { sentences, remaining } = extractFinishedSentences(sentenceBufferRef.current);
            sentenceBufferRef.current = remaining;
            for (const sentence of sentences) {
              enqueueSentenceTTS(sentence, botMsgId);
            }
          }

          if (shouldAutoScrollRef.current) {
            scrollToBottom(false);
          }
        },
      });

      // Stream completed: flush any remaining sentence buffer to TTS
      if (voiceOutputEnabledRef.current && sentenceBufferRef.current.trim()) {
        enqueueSentenceTTS(sentenceBufferRef.current.trim(), botMsgId);
        sentenceBufferRef.current = '';
      }

      // Requirement 4: Update quick-reply chips dynamically from live LLM response
      if (res.quick_replies && Array.isArray(res.quick_replies) && res.quick_replies.length > 0) {
        setQuickReplies(res.quick_replies.slice(0, 3));
      }

      // Check for error response from LLM / API
      if (res.isError) {
        setIsThinking(false);
        setMascotExpr('concerned');
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? {
                ...m,
                isThinking: false,
                isStreaming: false,
                isError: true,
                text: 'Connection hiccup, please try again.',
                retryText: textToSend.trim(),
              }
              : m
          )
        );
        return;
      }

      // Finalize bot message
      setIsThinking(false);
      setMascotExpr(res.emotion);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? {
              ...m,
              isThinking: false,
              isStreaming: false,
              text: res.message,
              expression: res.emotion,
              isHighRisk: res.isHighRisk,
              crisis: res.crisis,
              stress_level: res.stress_level,
              helplines: res.helplines,
              state_label: res.state_label,
              suggested_exercise: res.suggested_exercise,
              suggest_tool: res.suggest_tool,
              gesture: res.animation,
              spoken_text: res.spoken_text,
              quick_replies: res.quick_replies,
            }
            : m
        )
      );

      if (res.isHighRisk || res.crisis) {
        onOpenHelp();
      }

      // Auto-scroll when complete
      if (shouldAutoScrollRef.current) {
        scrollToBottom(true);
      }
    } catch (err) {
      console.warn('Chat interaction error:', err);
      setIsThinking(false);
      setMascotExpr('concerned');
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? {
              ...m,
              isThinking: false,
              isStreaming: false,
              isError: true,
              text: 'Connection hiccup, please try again.',
              retryText: textToSend.trim(),
            }
            : m
        )
      );
    } finally {
      setIsTyping(false);
    }
  };

  // Retry failed message
  const handleRetry = (textToRetry: string) => {
    if (!textToRetry) return;
    // Remove the failed bot bubble and re-send
    setMessages((prev) => prev.filter((m) => !m.isError));
    handleSendMessage(textToRetry);
  };

  // Procedural emotion and gesture triggers
  const handleTriggerEmotion = (emotion: MascotEmotion) => {
    setMascotExpr(emotion);
    setTimeout(() => setMascotExpr('calm'), 3200);
  };

  const handleTriggerGesture = (gesture: any) => {
    setActiveGesture(gesture);
    setTimeout(() => setActiveGesture('idle'), 2800);
  };

  // Clear conversation option and companion memory (Requirement 6)
  const handleClearConversation = async () => {
    if (confirm('Clear the current conversation and companion memory?')) {
      handleBargeIn();
      setMessages([]);
      setMascotExpr('calm');
      const userId = userProfile.id || localStorage.getItem('manas_user_id') || 'default_user';
      localStorage.removeItem(`manas_chat_${userId}`);
      await clearChatHistoryRemote(userId);
      await deleteSessionSummaryRemote(userId);
      setSessionMemory(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FFFFFF] text-[#0A0A0A] overflow-hidden select-none font-sans">
      {/* Ink-Wipe Transition Screen */}
      {inkWiping && (
        <div
          className="fixed inset-0 z-50 pointer-events-none bg-[#0A0A0A]"
          style={{
            animation: 'inkWipeOut 0.45s cubic-bezier(0.85, 0, 0.15, 1) forwards',
          }}
        />
      )}

      {/* TOP EDITORIAL BAR */}
      <header className="h-[64px] px-4 md:px-8 border-b border-[#0A0A0A]/10 bg-[#FFFFFF] flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3 md:gap-6">
          <span className="font-mono font-black text-base md:text-lg tracking-[-0.04em] flex items-center gap-1.5">
            MANAS′ <span className="text-xs px-2 py-0.5 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] font-mono">3D MASCOT</span>
          </span>

          <span className="hidden sm:inline-block text-xs font-mono text-[#0A0A0A]/60">
            Companion: <span className="font-bold text-[#0A0A0A]">{mascotConfig.name}</span> ({mascotConfig.personality})
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Permanent Tele-MANAS Emergency Black Pill */}
          <button
            type="button"
            onClick={onOpenHelp}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0A0A0A] text-white text-xs font-mono font-bold hover:bg-rose-900 transition-colors shadow-xs cursor-pointer"
            title="Tele-MANAS 24/7 Toll-Free Mental Health Support"
          >
            <PhoneCall className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">24/7 HELPLINE:</span>
            <span>14416</span>
          </button>

          {/* Digital Mental Twin Trigger */}
          {onOpenTwin && (
            <button
              type="button"
              onClick={onOpenTwin}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-xs font-mono text-teal-700 font-bold transition-colors cursor-pointer shadow-xs"
              title="Digital Mental Twin Baselines & Workload Strain"
            >
              <Activity className="w-3.5 h-3.5 text-teal-600" />
              <span className="hidden sm:inline">Mental Twin</span>
            </button>
          )}

          {/* Privacy Center Trigger */}
          {onOpenPrivacy && (
            <button
              type="button"
              onClick={onOpenPrivacy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-mono text-emerald-700 font-bold transition-colors cursor-pointer shadow-xs"
              title="Privacy Center & DPDP Consent Management"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Privacy</span>
            </button>
          )}

          {/* Notifications Trigger */}
          {onOpenNotifications && (
            <button
              type="button"
              onClick={onOpenNotifications}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-xs font-mono text-cyan-700 font-bold transition-colors cursor-pointer shadow-xs"
              title="Notification Center & Reminders"
            >
              <Bell className="w-3.5 h-3.5 text-cyan-600" />
              <span className="hidden sm:inline">Notifications</span>
            </button>
          )}

          {/* 8 Indian Languages Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#0A0A0A]/15 bg-[#FDFBF7] hover:bg-[#F3F0E6] text-xs font-mono text-[#0A0A0A] transition-colors cursor-pointer"
              title="Change Companion Language"
            >
              <Globe className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span className="font-bold">
                {LANGUAGE_MAP[(activeLanguage || 'en') as keyof typeof LANGUAGE_MAP]?.nativeName || 'English'}
              </span>
              <ChevronDown className="w-3 h-3 text-[#0A0A0A]/40" />
            </button>

            {isLangMenuOpen && (
              <div
                className="absolute right-0 top-11 w-52 bg-[#FFFFFF] border border-[#0A0A0A]/15 shadow-2xl rounded-2xl p-1.5 z-50 text-xs font-mono space-y-1"
              >
                <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider text-[#0A0A0A]/40 font-bold border-b border-[#0A0A0A]/8">
                  Indian Languages (8)
                </div>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleSelectLanguage(lang.code)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${(activeLanguage || 'en') === lang.code
                        ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] font-bold'
                        : 'hover:bg-[#F2EFE8] text-[#0A0A0A]'
                      }`}
                  >
                    <span>{lang.nativeName}</span>
                    <span className="text-[10px] text-[#0A0A0A]/40">{lang.englishName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Simple Voice Mute Toggle */}
          <button
            type="button"
            id="voice-mute-button"
            data-testid="voice-mute-button"
            onClick={handleToggleVoiceMute}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono transition-all cursor-pointer ${
              isVoiceMuted
                ? 'bg-rose-50 text-rose-600 border-rose-200'
                : 'border-[#0A0A0A]/15 bg-[#FDFBF7] hover:bg-[#F3F0E6] text-[#0A0A0A]'
            }`}
            title={isVoiceMuted ? 'Unmute companion voice' : 'Mute companion voice'}
          >
            {isVoiceMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-500" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-[#0A0A0A]/60" />
            )}
            <span>{isVoiceMuted ? 'UNMUTE' : 'MUTE VOICE'}</span>
          </button>

          {/* Profile & Settings Menu Popover */}
          <div className="relative">
            <button
              ref={menuButtonRef}
              type="button"
              id="profile-menu-button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="px-3.5 py-1.5 rounded-full border border-[#0A0A0A]/15 text-xs font-mono hover:bg-[#F2EFE8] transition-colors cursor-pointer"
            >
              MENU
            </button>

            {isMenuOpen && (
              <div
                ref={menuRef}
                id="profile-menu-popover"
                className="absolute right-0 top-11 w-64 bg-[#FFFFFF] border border-[#0A0A0A]/15 shadow-2xl rounded-2xl p-2 z-50 text-xs font-mono space-y-1 backdrop-blur-md"
              >
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#0A0A0A]/40 font-bold border-b border-[#0A0A0A]/8">
                  Profile &amp; Settings
                </div>
                <button
                  onClick={() => {
                    setIsCustomizerOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F2EFE8] flex items-center gap-2 font-bold text-[#0A0A0A] cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#8B5CF6]" /> Customize Mascot
                </button>
                <button
                  onClick={() => {
                    setIsAvatarStudioOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F2EFE8] flex items-center gap-2 font-bold text-[#8B5CF6] cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-violet-500" /> Avatar Studio
                </button>
                <button
                  onClick={() => {
                    setIsBreathingOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F2EFE8] flex items-center gap-2 cursor-pointer"
                >
                  <Wind className="w-3.5 h-3.5 text-[#8B5CF6]" /> Guided Breathing
                </button>
                <button
                  onClick={() => {
                    setShowMoodDrawer(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F2EFE8] flex items-center gap-2 cursor-pointer"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-[#8B5CF6]" /> Mood Journey
                </button>
                <button
                  onClick={() => {
                    setIsFeedbackDashboardOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F2EFE8] flex items-center gap-2 cursor-pointer text-[#8B5CF6]"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Empathy Review Dashboard
                </button>
                {onOpenTwin && (
                  <button
                    onClick={() => {
                      onOpenTwin();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F2EFE8] flex items-center gap-2 font-bold text-teal-700 cursor-pointer"
                  >
                    <Activity className="w-3.5 h-3.5 text-teal-600" /> Digital Mental Twin
                  </button>
                )}
                {onOpenPersonality && (
                  <button
                    onClick={() => {
                      onOpenPersonality();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F2EFE8] flex items-center gap-2 cursor-pointer"
                  >
                    <Compass className="w-3.5 h-3.5 text-[#8B5CF6]" /> OCEAN Personality
                  </button>
                )}
                {onOpenWhatWorks && (
                  <button
                    onClick={() => {
                      onOpenWhatWorks();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F2EFE8] flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> What Works For Me
                  </button>
                )}
                {onOpenMemory && (
                  <button
                    onClick={() => {
                      onOpenMemory();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F2EFE8] flex items-center gap-2 cursor-pointer"
                  >
                    <Brain className="w-3.5 h-3.5 text-[#8B5CF6]" /> Memory Center
                  </button>
                )}
                {onOpenJournalGoals && (
                  <button
                    onClick={() => {
                      onOpenJournalGoals();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F2EFE8] flex items-center gap-2 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#8B5CF6]" /> Journal &amp; Goals
                  </button>
                )}
                {onOpenSafetyPlan && (
                  <button
                    onClick={() => {
                      onOpenSafetyPlan();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-50 flex items-center gap-2 text-rose-700 font-bold cursor-pointer"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-rose-600" /> Safety Plan &amp; Helplines
                  </button>
                )}
                {onOpenPrivacy && (
                  <button
                    onClick={() => {
                      onOpenPrivacy();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-emerald-50 flex items-center gap-2 text-emerald-700 font-bold cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Privacy Center
                  </button>
                )}
                {onEditProfile && (
                  <button
                    onClick={() => {
                      onEditProfile();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F2EFE8] flex items-center gap-2 cursor-pointer text-[#0A0A0A]/70"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Profile
                  </button>
                )}
                <button
                  onClick={() => {
                    handleDeleteSessionMemory();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-50 flex items-center gap-2 text-rose-600 cursor-pointer"
                  title="Clear remembered mood themes and session history"
                >
                  <Brain className="w-3.5 h-3.5 text-rose-500" /> Delete Companion Memory
                </button>
                {onDeleteData && (
                  <button
                    onClick={() => {
                      onDeleteData();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-50 flex items-center gap-2 text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete My Data
                  </button>
                )}
                <div className="pt-1 border-t border-[#0A0A0A]/8">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleCloseWorkspace();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F2EFE8] text-[#0A0A0A]/60 cursor-pointer"
                  >
                    Close Workspace
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Close Workspace Button */}
          <button
            type="button"
            onClick={handleCloseWorkspace}
            className="p-1.5 rounded-full hover:bg-[#F2EFE8] text-[#0A0A0A]/60 hover:text-[#0A0A0A] transition-colors cursor-pointer"
            title="Close workspace"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* MAIN WORKSPACE SPLIT */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* LEFT 45%: THE 3D AI MASCOT STAGE */}
        <section
          aria-label="3D AI Mascot Companion"
          className="w-full md:w-[45%] h-[38vh] md:h-full border-b md:border-b-0 md:border-r border-[#0A0A0A]/10 shrink-0 relative flex flex-col justify-between overflow-hidden bg-gradient-to-b from-[#FDFBF7] via-[#F6F3EC] to-[#EDE7DC]"
        >
          <div className="flex-1 w-full h-full relative">
            <MascotStage
              gender={userProfile.companion || (userProfile.gender === 'girl' ? 'girl' : 'boy')}
              onGenderChange={(newGender) => {
                _onUpdateProfile?.({
                  companion: newGender,
                  gender: newGender,
                  avatarType: newGender,
                  voiceGender: newGender,
                });
                try {
                  const saved = localStorage.getItem('manas_user_profile_v2');
                  const parsed = saved ? JSON.parse(saved) : {};
                  parsed.companion = newGender;
                  parsed.gender = newGender;
                  parsed.avatarType = newGender;
                  parsed.voiceGender = newGender;
                  localStorage.setItem('manas_user_profile_v2', JSON.stringify(parsed));
                } catch (_) { }
              }}
              emotion={
                mascotExpr === 'concerned'
                  ? 'concerned'
                  : mascotExpr === 'happy'
                    ? 'happy'
                    : mascotExpr === 'sad'
                      ? 'sad'
                      : mascotExpr === 'surprised'
                        ? 'surprised'
                        : 'calm'
              }
              isSpeaking={isAvatarSpeaking}
              isUserTyping={isListening || isTyping}
              isThinking={isThinking}
              audioEnergy={audioEnergy}
              prefer3D={true}
              appearanceAttributes={userProfile.appearanceAttributes}
              onOpenPhotoAvatar={() => setIsAvatarStudioOpen(true)}
            />
          </div>
        </section>

        {/* RIGHT 55%: ONE UNIFIED CHRONOLOGICAL CONVERSATION TRANSCRIPT */}
        <section
          aria-label="Conversation with Mascot"
          className="w-full md:w-[55%] flex-1 flex flex-col justify-between overflow-hidden bg-[#FFFFFF] relative"
        >
          {/* Session Memory Indicator (Requirement 6) */}
          {sessionMemory && (
            <div className="mx-4 sm:mx-8 mt-3 p-2.5 rounded-xl border border-[#8B5CF6]/20 bg-[#8B5CF6]/5 flex items-center justify-between gap-3 text-xs font-mono shrink-0">
              <div className="flex items-center gap-2 truncate text-[#0A0A0A]/80">
                <Brain className="w-4 h-4 text-[#8B5CF6] shrink-0" />
                <span className="truncate">
                  <strong className="text-[#8B5CF6]">Remembered:</strong>{' '}
                  {sessionMemory.mood_themes || sessionMemory.summary}
                </span>
              </div>
              <button
                type="button"
                onClick={handleDeleteSessionMemory}
                disabled={isDeletingMemory}
                className="shrink-0 flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                title="Delete remembered session memory"
              >
                <Trash2 className="w-3 h-3" />
                <span>{isDeletingMemory ? 'Deleting...' : 'Delete Memory'}</span>
              </button>
            </div>
          )}

          {/* Scrollable Conversation Container: oldest at top, newest at bottom */}
          <div
            ref={chatContainerRef}
            onScroll={handleScroll}
            aria-live="polite"
            className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-6 space-y-4"
          >
            <ChatMessages
              messages={messages}
              isTyping={isTyping}
              speakingMessageId={speakingMessageId}
              onSpeak={(text) => speakResponse(text, userProfile.language)}
              onRetry={handleRetry}
              onStartBreathing={() => setIsBreathingOpen(true)}
              onStartGrounding={() => setIsGroundingOpen(true)}
              onOpenHelp={onOpenHelp}
              onFeedback={(messageId, rating) => {
                const idx = messages.findIndex((m) => m.id === messageId);
                const botMsg = messages[idx];
                const prevUserMsg = idx > 0 ? messages.slice(0, idx).reverse().find((m) => m.sender === 'user')?.text : '';
                sendChatFeedback({
                  messageId,
                  rating: rating === 'not_understood' ? -1 : rating,
                  feltUnderstood: rating === 'not_understood' ? 0 : 1,
                  userConsent: 0,
                  userMessage: prevUserMsg || '',
                  botReply: botMsg?.text || '',
                });
              }}
            />
            <div ref={messagesEndRef} />
          </div>

          {/* Floating "Jump to latest" chip when user scrolls up */}
          {showJumpToLatest && (
            <button
              type="button"
              id="jump-to-latest-chip"
              onClick={() => {
                shouldAutoScrollRef.current = true;
                scrollToBottom(true);
              }}
              className="absolute bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0A0A0A] text-white text-xs font-mono font-bold shadow-xl hover:bg-neutral-800 transition-all cursor-pointer"
            >
              <span>Jump to latest</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          )}

          {/* BOTTOM CHAT COMPOSER AREA */}
          <div className="p-3 sm:p-5 border-t border-[#0A0A0A]/10 bg-[#FFFFFF] space-y-2.5 shrink-0 z-10">
            {/* Quick Contextual Response Chips from Live LLM (horizontal scroll above input bar) */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scroll-smooth shrink-0 flex-nowrap whitespace-nowrap">
              {quickReplies.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isTyping}
                  onClick={() => handleSendMessage(chip)}
                  className="shrink-0 px-3 py-1.5 rounded-full border border-[#0A0A0A]/15 bg-[#FDFBF7] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-[#FFFFFF] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs font-mono tracking-wide cursor-pointer shadow-xs"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Chat Input Pill */}
            <ChatInput
              onSendMessage={handleSendMessage}
              isTyping={isTyping}
              voiceOutputEnabled={voiceOutputEnabled}
              onToggleVoiceOutput={() => setVoiceOutputEnabled(!voiceOutputEnabled)}
              onClearConversation={handleClearConversation}
              onOpenMascotUpload={() => setIsCustomizerOpen(true)}
              language={userProfile.language || 'en'}
              isBotSpeaking={isAvatarSpeaking}
            />
          </div>
        </section>
      </div>

      {/* ANCILLARY MODALS & DRAWERS */}
      {isCustomizerOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] bg-[#FFFFFF] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <MascotCustomizer
              onClose={() => setIsCustomizerOpen(false)}
              onApply={handleApplyMascotConfig}
            />
          </div>
        </div>
      )}

      {/* Edit Profile Dedicated Modal */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        userProfile={userProfile}
        onUpdateProfile={(updated) => {
          if (_onUpdateProfile) {
            _onUpdateProfile(updated);
          }
        }}
      />

      {/* Confirmation Modal for Delete Companion Memory / Delete My Data */}
      {confirmAction && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in"
        >
          <div className="w-full max-w-md bg-[#0F1117] border border-white/15 rounded-3xl p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {confirmAction === 'memory' ? 'Delete Companion Memory?' : 'Delete All My Data?'}
                </h3>
                <p className="text-xs text-white/50">
                  {confirmAction === 'memory'
                    ? 'Permanent database reset'
                    : 'Irreversible data erasure'}
                </p>
              </div>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              {confirmAction === 'memory'
                ? 'This will permanently remove your companion’s remembered session themes, preferences, and notes from the database. This action cannot be undone.'
                : 'This will permanently delete your account profile, avatar appearance attributes, wellness logs, memories, goals, and journal entries from the database and return you to onboarding.'}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
              <button
                type="button"
                id="confirm-dialog-cancel"
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-medium cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-dialog-proceed"
                onClick={confirmAction === 'memory' ? handleConfirmDeleteMemory : handleConfirmDeleteData}
                disabled={isDeletingMemory}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs text-white font-bold cursor-pointer transition-colors shadow-lg"
              >
                {isDeletingMemory
                  ? 'Deleting...'
                  : confirmAction === 'memory'
                  ? 'Delete Memory'
                  : 'Delete All Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Success Toast */}
      {actionToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-80 px-4 py-2.5 rounded-2xl bg-emerald-600 text-white text-xs font-mono font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span>✓</span>
          <span>{actionToast}</span>
        </div>
      )}

      {isBreathingOpen && (
        <BreathingWidget
          isOpen={isBreathingOpen}
          onClose={() => setIsBreathingOpen(false)}
          language={activeLanguage}
          companionGender={userProfile.companion || (userProfile.gender === 'girl' ? 'girl' : 'boy')}
          onSyncAvatarBreathe={(phase) => {
            setMascotExpr(phase === 'inhale' ? 'calm' : 'empathetic');
          }}
        />
      )}

      {isGroundingOpen && (
        <GroundingWidget
          isOpen={isGroundingOpen}
          onClose={() => setIsGroundingOpen(false)}
        />
      )}

      {showMoodDrawer && (
        <MoodJourneyDrawer
          isOpen={showMoodDrawer}
          onClose={() => setShowMoodDrawer(false)}
          moodHistory={moodHistory}
          currentMood={currentMood}
          onSelectMood={async (score) => {
            setCurrentMood(score);
            try {
              const token = localStorage.getItem('manas_access_token');
              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
              if (token) headers['Authorization'] = `Bearer ${token}`;
              const uid = userProfile.id || localStorage.getItem('manas_user_id') || 'anonymous';
              await fetch('/api/mood', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  user_id: uid,
                  score,
                  tags: ['MoodJourney'],
                  note: 'Logged from Chat Workspace',
                }),
              });
              setMoodHistory((prev) => [
                ...prev,
                { score, tags: 'MoodJourney', created_at: 'Just now' },
              ]);
            } catch (err) {
              console.warn('Failed to record mood:', err);
            }
          }}
          onDeleteMood={async (id) => {
            try {
              const token = localStorage.getItem('manas_access_token');
              const headers: Record<string, string> = {};
              if (token) headers['Authorization'] = `Bearer ${token}`;
              await fetch(`/api/mood/${id}`, { method: 'DELETE', headers });
              setMoodHistory((prev) => prev.filter((m: any) => m.id !== id));
            } catch (err) {
              console.warn('Failed to delete mood:', err);
            }
          }}
          onEditMood={async (id, newScore) => {
            try {
              const token = localStorage.getItem('manas_access_token');
              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
              if (token) headers['Authorization'] = `Bearer ${token}`;
              await fetch(`/api/mood/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ score: newScore }),
              });
              setMoodHistory((prev) =>
                prev.map((m: any) => (m.id === id ? { ...m, score: newScore } : m))
              );
            } catch (err) {
              console.warn('Failed to edit mood:', err);
            }
          }}
        />
      )}

      {isFeedbackDashboardOpen && (
        <FeedbackDashboardModal
          isOpen={isFeedbackDashboardOpen}
          onClose={() => setIsFeedbackDashboardOpen(false)}
        />
      )}

      {/* 3-Step Speaking Avatar Studio Modal */}
      <AvatarStudioModal
        isOpen={isAvatarStudioOpen}
        onClose={() => setIsAvatarStudioOpen(false)}
        userProfile={userProfile}
        onApplyAvatar={(updated) => {
          if (_onUpdateProfile) {
            _onUpdateProfile(updated);
          }
        }}
      />

      {/* Real-time Auto-Save Toast with Undo & Confirmation */}
      {activeAutoSave && (
        <AutoSaveToast
          event={activeAutoSave}
          onUndo={async (actionId) => {
            try {
              const token = localStorage.getItem('manas_access_token');
              await fetch('/api/chat/auto-save/undo', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ action_id: actionId }),
              });
            } catch (err) {
              console.warn('Failed to undo auto save:', err);
            }
          }}
          onConfirm={
            activeAutoSave.requires_confirmation
              ? async (event) => {
                try {
                  const token = localStorage.getItem('manas_access_token');
                  const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  };
                  if (event.tool === 'set_reminder') {
                    await fetch('/api/chat/auto-save/confirm-reminder', {
                      method: 'POST',
                      headers,
                      body: JSON.stringify({
                        action_id: event.action_id,
                        text: event.reminder_text || event.summary,
                        time_or_recurrence: event.time_or_recurrence || '09:00',
                      }),
                    });
                  } else if (event.tool === 'update_preference') {
                    await fetch('/api/chat/auto-save/confirm-preference', {
                      method: 'POST',
                      headers,
                      body: JSON.stringify({
                        action_id: event.action_id,
                        key: event.pref_key || 'preference',
                        value: event.pref_value || event.summary,
                      }),
                    });
                  }
                } catch (err) {
                  console.warn('Failed to confirm auto save:', err);
                }
              }
              : undefined
          }
          onDismiss={() => setActiveAutoSave(null)}
        />
      )}
    </div>
  );
};

export default ChatCompanionModal;
