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
} from 'lucide-react';
import type { UserProfile } from './OnboardingModal';
import type { ChatMessage, MascotExpression } from '../types';
import type { MascotEmotion } from '../lib/emotion/emotionEngine';
import { MascotViewer } from './mascot/MascotViewer';
import { MascotStage } from './MascotStage';
import { MascotControls } from './mascot/MascotControls';
import { OutfitsPanel } from './mascot/OutfitsPanel';
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
import { PersistentMiniPlayer } from './music/PersistentMiniPlayer';
import { MusicDrawer } from './music/MusicDrawer';
import {
  streamChatMessage,
  sendChatFeedback,
  fetchChatHistory,
  clearChatHistoryRemote,
} from '../lib/ai/aiChatService';

interface ChatCompanionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onUpdateProfile?: (updated: Partial<UserProfile>) => void;
  onOpenHelp: () => void;
  onEditProfile?: () => void;
  onDeleteData?: () => void;
}

export const ChatCompanionModal: React.FC<ChatCompanionModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onUpdateProfile: _onUpdateProfile,
  onOpenHelp,
  onEditProfile,
  onDeleteData,
}) => {
  if (!isOpen) return null;

  // View & Overlay states
  const [showMoodDrawer, setShowMoodDrawer] = useState<boolean>(false);
  const [isBreathingOpen, setIsBreathingOpen] = useState<boolean>(false);
  const [isGroundingOpen, setIsGroundingOpen] = useState<boolean>(false);
  const [isFeedbackDashboardOpen, setIsFeedbackDashboardOpen] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState<boolean>(false);
  const [isOutfitsOpen, setIsOutfitsOpen] = useState<boolean>(false);
  const [isMusicDrawerOpen, setIsMusicDrawerOpen] = useState<boolean>(false);

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

  // Messages state: strictly one chronological list (oldest at top, newest at bottom)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState<boolean>(false);

  // Mood Tracker state
  const [currentMood, setCurrentMood] = useState<number | null>(null);
  const [moodHistory, setMoodHistory] = useState<Array<{ score: number; tags?: string; created_at: string }>>([
    { score: 3, tags: 'Exams,Sleep', created_at: '2 days ago' },
    { score: 4, tags: 'Study,Calm', created_at: 'Yesterday' },
    { score: 4, tags: 'Good,Peace', created_at: 'Today' },
  ]);

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

  // Barge-in: immediately stop speech synthesis when user interrupts
  const handleBargeIn = () => {
    speechEngine.stopSpeaking();
    setIsAvatarSpeaking(false);
    setSpeakingMessageId(null);
    setAudioEnergy(0);
  };

  // Register speech barge-in hook
  useEffect(() => {
    const unsub = speechEngine.onBargeIn(() => {
      handleBargeIn();
    });
    return () => unsub();
  }, []);

  // Duck music volume when avatar is speaking
  useEffect(() => {
    musicPlayer.setAvatarSpeaking(isAvatarSpeaking);
  }, [isAvatarSpeaking]);

  // Speak response aloud with synchronized lip-sync energy and segment progression
  const speakResponse = (
    text: string,
    lang = 'en',
    messageId?: string,
    segments?: Array<{ spoken_text?: string; text?: string; emotion?: string; gesture?: string }>
  ) => {
    if (!text.trim()) return;

    handleBargeIn();
    setIsAvatarSpeaking(true);
    if (messageId) setSpeakingMessageId(messageId);

    // If structured sentence segments exist, advance through each segment
    if (segments && segments.length > 0) {
      let currentSegIdx = 0;

      const playNextSegment = () => {
        if (currentSegIdx >= segments.length) {
          setIsAvatarSpeaking(false);
          setSpeakingMessageId(null);
          setAudioEnergy(0);
          setTimeout(() => {
            setMascotExpr((prev) => (prev === 'concerned' ? 'empathetic' : 'calm'));
            setActiveGesture('idle');
          }, 1200);
          return;
        }

        const seg = segments[currentSegIdx++];
        const segText = seg.spoken_text || seg.text || '';
        if (seg.emotion) {
          setMascotExpr(seg.emotion as MascotEmotion);
        }
        if (seg.gesture) {
          setActiveGesture(seg.gesture as any);
        }

        speechEngine.speak(segText, lang, {
          voiceSpeed: mascotConfig.voiceSpeed,
          onEnergy: (energy) => setAudioEnergy(energy),
          onEnd: () => {
            playNextSegment();
          },
          onError: () => {
            setIsAvatarSpeaking(false);
            setSpeakingMessageId(null);
            setAudioEnergy(0);
          },
        });
      };

      playNextSegment();
      return;
    }

    // Single-pass speech synthesis fallback
    speechEngine.speak(text, lang, {
      voiceSpeed: mascotConfig.voiceSpeed,
      onEnergy: (energy) => setAudioEnergy(energy),
      onEnd: () => {
        setIsAvatarSpeaking(false);
        setSpeakingMessageId(null);
        setAudioEnergy(0);
        setTimeout(() => {
          setMascotExpr((prev) => (prev === 'concerned' ? 'empathetic' : 'calm'));
        }, 1200);
      },
      onError: () => {
        setIsAvatarSpeaking(false);
        setSpeakingMessageId(null);
        setAudioEnergy(0);
      },
    });
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
        } catch (_) {}
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
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isTyping) return;

    handleBargeIn();

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
        language: userProfile.language || 'en',
        personality: mascotConfig.personality,
        role: userProfile.role || 'student',
        stylePref: userProfile.stylePref || 'reflective',
        age: userProfile.age || 20,
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
          if (shouldAutoScrollRef.current) {
            scrollToBottom(false);
          }
        },
      });

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
                gesture: res.animation,
                spoken_text: res.spoken_text,
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

      // Speak aloud if voice output is enabled
      if (voiceOutputEnabled) {
        speakResponse(res.spoken_text || res.message, userProfile.language, botMsgId, res.segments);
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
                text: 'Connection hiccup. Your companion is right here — click Retry to send again.',
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

  // Clear conversation option
  const handleClearConversation = async () => {
    if (confirm('Clear the current conversation?')) {
      handleBargeIn();
      setMessages([]);
      setMascotExpr('calm');
      const userId = userProfile.id || localStorage.getItem('manas_user_id') || 'default_user';
      localStorage.removeItem(`manas_chat_${userId}`);
      await clearChatHistoryRemote(userId);
    }
  };

  // Contextual chips for prompt inspiration (simply insert text into the normal send pipeline)
  const getContextualChips = () => {
    const lang = userProfile.language || 'en';
    if (lang === 'ta') {
      return [
        'இன்று மனம் மிகவும் பாரமாக இருக்கிறது',
        'படபடப்பைக் குறைக்க என்ன செய்ய வேண்டும்?',
        'நாம் 4-7-8 மூச்சுப் பயிற்சி செய்வோம்',
      ];
    }
    if (lang === 'hi') {
      return [
        'आज मन बहुत भारी और तनावग्रस्त है',
        'घबराहट शांत करने के लिए क्या करूं?',
        'मेरे साथ 4-7-8 सांस का अभ्यास करें',
      ];
    }
    return [
      "I'm feeling really stressed today",
      'Help me untangle what feels heaviest',
      'Can we do the 4-7-8 breathing exercise?',
      'Guide me through 5-4-3-2-1 grounding',
    ];
  };

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

          {/* Quick Customize Mascot Trigger */}
          <button
            type="button"
            onClick={() => setIsCustomizerOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#0A0A0A]/15 bg-[#FDFBF7] hover:bg-[#F3F0E6] text-xs font-mono text-[#0A0A0A] transition-colors cursor-pointer"
            title="Customize Mascot"
          >
            <Sliders className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>Customize</span>
          </button>

          {/* Soundscapes Music Trigger */}
          <button
            type="button"
            onClick={() => setIsMusicDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 text-xs font-mono text-[#8B5CF6] font-bold transition-colors cursor-pointer shadow-xs"
            title="Therapeutic Soundscapes Player (12 Royalty-Free Tracks)"
          >
            <Disc3 className="w-3.5 h-3.5 animate-[spin_6s_linear_infinite]" />
            <span className="hidden sm:inline">Music</span>
          </button>

          {/* Quick Outfits Trigger */}
          <button
            type="button"
            onClick={() => setIsOutfitsOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 text-xs font-mono text-[#8B5CF6] font-bold transition-colors cursor-pointer shadow-xs"
            title="Wardrobe Outfits"
          >
            <Shirt className="w-3.5 h-3.5" />
            <span>Outfits</span>
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
                    setIsOutfitsOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F2EFE8] flex items-center gap-2 font-bold text-[#8B5CF6] cursor-pointer"
                >
                  <Shirt className="w-3.5 h-3.5" /> Outfits &amp; Style
                </button>
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
                      onClose();
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
            onClick={onClose}
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
              gender={userProfile.gender === 'girl' ? 'girl' : 'boy'}
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
              audioEnergy={audioEnergy}
              prefer3D={true}
            />
          </div>
        </section>

        {/* RIGHT 55%: ONE UNIFIED CHRONOLOGICAL CONVERSATION TRANSCRIPT */}
        <section
          aria-label="Conversation with Mascot"
          className="w-full md:w-[55%] flex-1 flex flex-col justify-between overflow-hidden bg-[#FFFFFF] relative"
        >
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
            {/* Quick Contextual Response Chips */}
            <div className="flex flex-wrap gap-1.5">
              {getContextualChips().map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isTyping}
                  onClick={() => handleSendMessage(chip)}
                  className="px-2.5 py-1 rounded-full border border-[#0A0A0A]/15 bg-[#FDFBF7] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-[#FFFFFF] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs font-mono tracking-wide cursor-pointer"
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

      {isOutfitsOpen && (
        <OutfitsPanel
          isOpen={isOutfitsOpen}
          onClose={() => setIsOutfitsOpen(false)}
          currentGender={userProfile.gender === 'girl' ? 'girl' : 'boy'}
          onSelectOutfit={(outfit) => {
            avatar.setOutfit(outfit);
          }}
          onPhotoPersonalize={() => {
            setIsOutfitsOpen(false);
            setIsCustomizerOpen(true);
          }}
        />
      )}

      {isBreathingOpen && (
        <BreathingWidget
          isOpen={isBreathingOpen}
          onClose={() => setIsBreathingOpen(false)}
          durationSecs={180}
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
          userId={userProfile.id || 'default_user'}
          moodHistory={moodHistory}
          onLogMood={async (score) => {
            setCurrentMood(score);
            try {
              await fetch('/api/mood', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  user_id: userProfile.id,
                  score,
                  tags: ['MoodJourney'],
                  note: 'Logged from Chat Workspace',
                }),
              });
              setMoodHistory((prev) => [
                { score, tags: 'Logged', created_at: 'Just now' },
                ...prev,
              ]);
            } catch (_) {}
          }}
        />
      )}

      {isFeedbackDashboardOpen && (
        <FeedbackDashboardModal
          isOpen={isFeedbackDashboardOpen}
          onClose={() => setIsFeedbackDashboardOpen(false)}
        />
      )}

      {/* Persistent Spotify-Style Mini Player */}
      <PersistentMiniPlayer onOpenDrawer={() => setIsMusicDrawerOpen(true)} />

      {/* Music Playlist Drawer */}
      <MusicDrawer
        isOpen={isMusicDrawerOpen}
        onClose={() => setIsMusicDrawerOpen(false)}
      />
    </div>
  );
};

export default ChatCompanionModal;
