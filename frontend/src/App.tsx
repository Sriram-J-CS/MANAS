
import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { MenuOverlay } from './components/MenuOverlay';
import { Hero } from './components/Hero';
import { Statement } from './components/Statement';
import { WorksTrack } from './components/WorksTrack';
import { Studio } from './components/Studio';
import { WordsOverMedia } from './components/WordsOverMedia';
import { Footer } from './components/Footer';
import { Cursor } from './components/Cursor';
import { AmbientMusicPlayer } from './components/AmbientMusicPlayer';
import { OnboardingModal, type UserProfile } from './components/OnboardingModal';
import { ChatCompanionModal } from './components/ChatCompanionModal';
import { HelpModal } from './components/HelpModal';
import { CalmSpaceModal } from './components/CalmSpaceModal';
import { ChatSettingsModal } from './components/ChatSettingsModal';
import { MascotSettingsModal } from './components/settings/MascotSettingsModal';
import { avatar } from './lib/avatar/avatarConfigService';
import { initLenis } from './lib/lenis';
import { siteConfigByLang, type WorkItem } from './content/site.config';
import type { Language } from './types';
import { AuthModal } from './components/auth/AuthModal';
import { VoiceRatingLabModal } from './components/voice/VoiceRatingLabModal';
import { DigitalTwinModal } from './components/twin/DigitalTwinModal';
import { PersonalityDiscoveryModal } from './components/personality/PersonalityDiscoveryModal';
import { WhatWorksModal } from './components/interventions/WhatWorksModal';
import { MemoryCenterModal } from './components/memory/MemoryCenterModal';
import { JournalAndGoalsModal } from './components/journal/JournalAndGoalsModal';
import { SafetyPlanModal } from './components/safety/SafetyPlanModal';
import { PrivacyCenterModal } from './components/privacy/PrivacyCenterModal';
import { NotificationCenterModal } from './components/notifications/NotificationCenterModal';
import { NotificationPreferencesModal } from './components/notifications/NotificationPreferencesModal';
import { registerServiceWorker } from './lib/push/pushService';
import { PageIntroCurtain } from './components/effects/PageIntroCurtain';
import { FloatingBackgroundShapes } from './components/effects/FloatingBackgroundShapes';
import { VoiceDebugHUD } from './components/voice/VoiceDebugHUD';
import { supabase } from './lib/supabase';

export function App() {
  const [currentLang, setCurrentLang] = useState<Language>('en');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isCompanionOpen, setIsCompanionOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isCalmOpen, setIsCalmOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMascotCustomizerOpen, setIsMascotCustomizerOpen] = useState(false);
  const [isVoiceRatingLabOpen, setIsVoiceRatingLabOpen] = useState(false);

  // EmotiCare Domain Modals State
  const [isTwinOpen, setIsTwinOpen] = useState(false);
  const [isPersonalityOpen, setIsPersonalityOpen] = useState(false);
  const [isWhatWorksOpen, setIsWhatWorksOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isJournalGoalsOpen, setIsJournalGoalsOpen] = useState(false);
  const [isSafetyPlanOpen, setIsSafetyPlanOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isNotificationPrefsOpen, setIsNotificationPrefsOpen] = useState(false);

  // Authenticated user state
  const [authUser, setAuthUser] = useState<{ user_id: string; name: string; email?: string; phone?: string } | null>(() => {
    try {
      const uid = localStorage.getItem('manas_user_id');
      const email = localStorage.getItem('manas_user_email');
      const phone = localStorage.getItem('manas_user_phone');
      const name = localStorage.getItem('manas_user_name');
      if (uid && (email || phone)) return { user_id: uid, email: email || '', phone: phone || '', name: name || 'User' };
    } catch (_) { }
    return null;
  });

  // User Profile state (persisted in localStorage)
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const loggedInName = typeof window !== 'undefined' ? localStorage.getItem('manas_user_name') : null;
    const loggedInId = typeof window !== 'undefined' ? localStorage.getItem('manas_user_id') : null;
    try {
      const saved = localStorage.getItem('manas_twin_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (loggedInName && (!parsed.name || parsed.name === 'Friend' || parsed.name.toLowerCase() === 'akshay')) {
          parsed.name = loggedInName;
        }
        if (loggedInId) parsed.id = loggedInId;
        if (!parsed.speakingStyle) parsed.speakingStyle = 'Warm & Caring';
        if (parsed.voiceFollowsCompanion === undefined) parsed.voiceFollowsCompanion = true;
        if (parsed.voiceSpeed === undefined) parsed.voiceSpeed = 1.0;
        if (!parsed.replyLength) parsed.replyLength = 'Balanced';
        return parsed;
      }
    } catch (_) { }
    return {
      name: loggedInName || 'Friend',
      id: loggedInId || undefined,
      age: 20,
      isMinor: false,
      guardianConsent: false,
      reasons: ['Stress'],
      tone: 'gentle',
      role: 'student',
      gender: 'boy',
      companion: 'boy',
      voiceGender: 'boy',
      voiceTone: 'aarav',
      speakingStyle: 'Warm & Caring',
      voiceSpeed: 1.0,
      replyLength: 'Balanced',
      voiceFollowsCompanion: true,
      avatarType: 'cyber_manas',
      language: 'en',
      stylePref: 'reflective',
      avatarUrl: 'cyber_manas',
      isCustomAvatar: false,
      consentDisclaimer: true,
      consentChat: true,
      consentMood: true,
      consentCadence: true,
      consentTimestamp: new Date().toISOString(),
      mascotEnabled: true,
      mascotPosition: 'right',
    };
  });

  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(() => {
    return localStorage.getItem('manas_twin_onboarded') === 'true';
  });

  // Custom Cursor hover state
  const [cursorVisible, setCursorVisible] = useState(false);
  const [cursorText, setCursorText] = useState('EXPLORE →');

  const config = siteConfigByLang[currentLang];

  useEffect(() => {
    avatar.loadConfigOnStartup();
    registerServiceWorker();
    const lenisInstance = initLenis();

    // Sync active Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !session.user.is_anonymous) {
        const pName = session.user.user_metadata?.name || session.user.user_metadata?.full_name || 'User';
        setAuthUser({
          user_id: session.user.id,
          name: pName,
          email: session.user.email,
          phone: session.user.phone,
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setAuthUser(null);
        setHasCompletedOnboarding(false);
        setUserProfile((prev) => ({
          ...prev,
          name: 'Friend',
          id: undefined,
        }));
      } else if (session?.user && !session.user.is_anonymous) {
        const pName = session.user.user_metadata?.name || session.user.user_metadata?.full_name || 'User';
        setAuthUser({
          user_id: session.user.id,
          name: pName,
          email: session.user.email,
          phone: session.user.phone,
        });
        setUserProfile((prev) => ({
          ...prev,
          name: pName,
          id: session.user.id,
        }));
      }
    });

    // Load server-side user profile if available
    const loadDbProfile = async () => {
      try {
        const token = localStorage.getItem('manas_access_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/user/profile', { headers });
        if (res.ok) {
          const data = await res.json();
          if (data && data.name) {
            setUserProfile((prev) => {
              const merged: UserProfile = {
                ...prev,
                name: data.name || prev.name,
                age: data.age || prev.age,
                language: data.language || prev.language,
                companion: data.companion || prev.companion,
                voiceGender: data.voice_gender || prev.voiceGender,
                voiceTone: data.voice_tone || prev.voiceTone,
                speakingStyle: data.speaking_style || prev.speakingStyle,
                voiceSpeed: data.voice_speed !== undefined ? data.voice_speed : prev.voiceSpeed,
                replyLength: data.reply_length || prev.replyLength,
                voiceFollowsCompanion: data.voice_follows_companion !== undefined ? data.voice_follows_companion : prev.voiceFollowsCompanion,
              };
              try {
                localStorage.setItem('manas_twin_profile', JSON.stringify(merged));
                localStorage.setItem('manas_user_profile_v2', JSON.stringify(merged));
              } catch (_) {}
              return merged;
            });
          }
        }
      } catch (_) {}
    };
    loadDbProfile();

    // Direct chat opening or voice lab opening via URL query param or hash (/voice-test)
    const params = new URLSearchParams(window.location.search);
    if (params.get('chat') === 'open' || window.location.hash === '#chat') {
      setIsCompanionOpen(true);
    }
    const isVoiceTest =
      window.location.pathname === '/voice-test' ||
      window.location.pathname.startsWith('/voice-test') ||
      params.get('test-voice') === 'true' ||
      params.get('voice-test') === 'true' ||
      params.get('page') === 'voice-test' ||
      window.location.hash === '#test-voice' ||
      window.location.hash === '#voice-test';

    if (isVoiceTest) {
      setIsVoiceRatingLabOpen(true);
    }

    const handleHashOrPopState = () => {
      const p = new URLSearchParams(window.location.search);
      if (
        window.location.pathname === '/voice-test' ||
        p.get('test-voice') === 'true' ||
        p.get('voice-test') === 'true' ||
        window.location.hash === '#voice-test' ||
        window.location.hash === '#test-voice'
      ) {
        setIsVoiceRatingLabOpen(true);
      }
    };
    window.addEventListener('popstate', handleHashOrPopState);
    window.addEventListener('hashchange', handleHashOrPopState);

    return () => {
      window.removeEventListener('popstate', handleHashOrPopState);
      window.removeEventListener('hashchange', handleHashOrPopState);
      lenisInstance?.destroy();
    };
  }, []);

  // Update HTML lang attribute for accessibility
  useEffect(() => {
    document.documentElement.lang = currentLang;
  }, [currentLang]);

  const handleSelectLanguage = (lang: Language) => {
    setCurrentLang(lang);
    setUserProfile((prev) => {
      const next = { ...prev, language: lang };
      try {
        localStorage.setItem('manas_twin_profile', JSON.stringify(next));
      } catch (_) { }
      return next;
    });
  };

  const toggleLanguage = () => {
    const langCodes: Language[] = ['en', 'ta', 'hi', 'te', 'kn', 'ml', 'bn', 'mr'];
    const currIdx = langCodes.indexOf(currentLang);
    const nextLang = langCodes[(currIdx + 1) % langCodes.length];
    handleSelectLanguage(nextLang);
  };

  // Launch Chat / Onboarding trigger with session check
  const handleStartTalking = async () => {
    // Chat requires a session (either authenticated or anonymous from "Skip for now")
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      if (!hasCompletedOnboarding) {
        setIsOnboardingOpen(true);
      } else {
        setIsAuthOpen(true);
      }
      return;
    }

    if (!hasCompletedOnboarding) {
      setIsOnboardingOpen(true);
    } else {
      setIsCompanionOpen(true);
    }
  };

  const handleOnboardingComplete = (profile: UserProfile) => {
    setUserProfile(profile);
    setHasCompletedOnboarding(true);
    try {
      localStorage.setItem('manas_twin_profile', JSON.stringify(profile));
      localStorage.setItem('manas_twin_onboarded', 'true');
    } catch (_) { }

    if (profile.language) {
      setCurrentLang(profile.language as Language);
    }

    setIsOnboardingOpen(false);
    setIsCompanionOpen(true);
  };

  const handleUpdateProfile = (updated: Partial<UserProfile>) => {
    if (updated.language) {
      setCurrentLang(updated.language as Language);
    }
    setUserProfile((prev) => {
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem('manas_twin_profile', JSON.stringify(next));
        localStorage.setItem('manas_user_profile_v2', JSON.stringify(next));
      } catch (_) { }
      return next;
    });
  };

  const handleDeleteAllUserData = async () => {
    try {
      if (userProfile.id) {
        await fetch(`/api/user/data/${userProfile.id}`, { method: 'DELETE' });
      }
    } catch (_) { }
    localStorage.removeItem('manas_twin_profile');
    localStorage.removeItem('manas_twin_onboarded');
    setHasCompletedOnboarding(false);
    setUserProfile({
      name: 'Friend',
      age: 20,
      isMinor: false,
      guardianConsent: false,
      reasons: ['Stress'],
      tone: 'gentle',
      role: 'student',
      gender: 'boy',
      avatarType: 'cyber_manas',
      language: 'en',
      stylePref: 'reflective',
      avatarUrl: 'cyber_manas',
      isCustomAvatar: false,
      consentDisclaimer: true,
      consentChat: true,
      consentMood: true,
      consentCadence: true,
      consentTimestamp: new Date().toISOString(),
      mascotEnabled: true,
      mascotPosition: 'right',
    });
    setIsCompanionOpen(false);
    setIsOnboardingOpen(false);
  };

  const handleSelectWork = (item: WorkItem) => {
    if (item.actionId === 'chat' || item.actionId === 'voice' || item.actionId === 'mood' || item.actionId === 'cadence') {
      handleStartTalking();
    } else if (item.actionId === 'safety') {
      setIsHelpOpen(true);
    } else if (item.actionId === 'calm') {
      setIsCalmOpen(true);
    } else if (item.actionId === 'team') {
      const el = document.getElementById('studio');
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleHoverWork = (hovering: boolean, text?: string) => {
    setCursorVisible(hovering);
    if (text) setCursorText(text);
  };

  return (
    <div
      className={`min-h-screen bg-[#000000] text-[#ffffff] selection:bg-[#ffffff] selection:text-[#000000] ${currentLang === 'ta' ? 'font-tamil' : ''
        }`}
    >
      {/* Calm Page-Load Reveal Veil (< 1.2s) */}
      <PageIntroCurtain />

      {/* Floating Soft 3D-Style Shapes Reacting Gently to Cursor */}
      <FloatingBackgroundShapes />

      {/* Custom Awwwards Cursor */}
      <Cursor visible={cursorVisible} text={cursorText} />

      {/* Mind-Relaxing Peaceful Background Ambient Music Engine (Only when companion chat is closed) */}
      {!isCompanionOpen && <AmbientMusicPlayer />}

      {/* Fixed Thin Difference Blend Navbar */}
      <Navbar
        logo={config.logo}
        isMenuOpen={isMenuOpen}
        onToggleMenu={() => setIsMenuOpen(!isMenuOpen)}
        onOpenDemo={handleStartTalking}
        user={authUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenVoiceRatingLab={() => setIsVoiceRatingLabOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
      />

      {/* Fullscreen Overlay Menu */}
      <MenuOverlay
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        currentLang={currentLang}
        onToggleLang={toggleLanguage}
        onSelectLang={handleSelectLanguage}
        onOpenDemo={handleStartTalking}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenCalm={() => setIsCalmOpen(true)}
        onOpenMascotCustomizer={() => setIsMascotCustomizerOpen(true)}
        onOpenVoiceRatingLab={() => setIsVoiceRatingLabOpen(true)}
        onOpenTwin={() => setIsTwinOpen(true)}
        onOpenPersonality={() => setIsPersonalityOpen(true)}
        onOpenWhatWorks={() => setIsWhatWorksOpen(true)}
        onOpenMemory={() => setIsMemoryOpen(true)}
        onOpenJournalGoals={() => setIsJournalGoalsOpen(true)}
        onOpenSafetyPlan={() => setIsSafetyPlanOpen(true)}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
      />



      <main className="w-full overflow-x-clip">
        {/* Signature Moment 1: Hero with Organic Ink Trail & 3D Glossy Textures Inside Letters */}
        <Hero
          config={config}
          onOpenDemo={handleStartTalking}
          onOpenHelp={() => setIsHelpOpen(true)}
          onToggleLang={toggleLanguage}
        />


        {/* Signature Moment 2: Statement with Word-by-Word Scroll Opacity Scrub */}
        <Statement statement={config.statement} />

        {/* Signature Moment 3: Works Track with Pinned Horizontal Scroll & Alternating Staggered Cards */}
        <WorksTrack
          works={config.works}
          worksCount={config.worksCount}
          headTitle={config.worksHeadTitle}
          headYear={config.worksHeadYear}
          onSelectWork={handleSelectWork}
          onHoverWork={handleHoverWork}
        />

        {/* Signature Moment 4: Studio Section with Floating Parallax Media & Text Scramble */}
        <Studio studio={config.studio} />

        {/* Signature Moment 5: Words Over Media with Mouse Parallax Drift */}
        <WordsOverMedia
          title={config.wordsOverMedia.title}
          fragments={config.wordsOverMedia.fragments}
          bgImage={config.wordsOverMedia.bgImage}
          onOpenDemo={handleStartTalking}
        />

        {/* Signature Moment 6: Footer with Headline, Pill Buttons, Socials & Giant Bottom Wordmark */}
        <Footer
          footer={config.footer}
          onOpenDemo={handleStartTalking}
          onOpenHelp={() => setIsHelpOpen(true)}
        />
      </main>

      {/* Step 1: Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={handleOnboardingComplete}
        initialLang={currentLang}
        existingProfile={hasCompletedOnboarding ? userProfile : null}
        onDeleteData={handleDeleteAllUserData}
      />

      {/* Step 2: Live Chat Companion Interface - WHOLE BIG SCREEN with 3D Avatar Speaking & Lip-Sync */}
      <ChatCompanionModal
        isOpen={isCompanionOpen}
        onClose={() => setIsCompanionOpen(false)}
        userProfile={userProfile}
        onUpdateProfile={handleUpdateProfile}
        onOpenHelp={() => setIsHelpOpen(true)}
        onEditProfile={() => {
          setIsCompanionOpen(false);
          setIsOnboardingOpen(true);
        }}
        onDeleteData={handleDeleteAllUserData}
        onOpenTwin={() => setIsTwinOpen(true)}
        onOpenPersonality={() => setIsPersonalityOpen(true)}
        onOpenWhatWorks={() => setIsWhatWorksOpen(true)}
        onOpenMemory={() => setIsMemoryOpen(true)}
        onOpenJournalGoals={() => setIsJournalGoalsOpen(true)}
        onOpenSafetyPlan={() => setIsSafetyPlanOpen(true)}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
      />

      {/* 3D Mascot Customizer Studio Modal */}
      <MascotSettingsModal
        isOpen={isMascotCustomizerOpen}
        onClose={() => setIsMascotCustomizerOpen(false)}
      />

      {/* Mascot & Avatar Settings Modal */}
      <ChatSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userProfile={userProfile}
        onUpdateProfile={handleUpdateProfile}
        isFullscreen={true}
        onToggleFullscreen={() => { }}
        onDeleteData={handleDeleteAllUserData}
      />

      {/* 24/7 Crisis Help & Tele-MANAS Safety Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        currentLang={currentLang}
      />

      {/* Interactive Calm Space Modal with 4-6 Breathing & Web Audio Synthesizer */}
      <CalmSpaceModal
        isOpen={isCalmOpen}
        onClose={() => setIsCalmOpen(false)}
        currentLang={currentLang}
      />

      {/* User Authentication Modal (JWT & Zero PII) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(u) => {
          setAuthUser(u);
          setUserProfile((prev) => {
            const next = {
              ...prev,
              id: u.user_id,
              name: u.name,
              contactEmail: u.email || prev.contactEmail,
              contactPhone: u.phone || prev.contactPhone,
            };
            try {
              localStorage.setItem('manas_twin_profile', JSON.stringify(next));
              localStorage.setItem('manas_user_name', u.name);
              localStorage.setItem('manas_user_id', u.user_id);
            } catch (_) {}
            return next;
          });
        }}
      />

      {/* Multilingual Voice Rating Lab Modal (8 Indian Languages) */}
      <VoiceRatingLabModal
        isOpen={isVoiceRatingLabOpen}
        onClose={() => setIsVoiceRatingLabOpen(false)}
        initialLanguage={currentLang}
      />

      {/* EmotiCare Production Domain Modals */}
      <DigitalTwinModal
        isOpen={isTwinOpen}
        onClose={() => setIsTwinOpen(false)}
      />

      <PersonalityDiscoveryModal
        isOpen={isPersonalityOpen}
        onClose={() => setIsPersonalityOpen(false)}
      />

      <WhatWorksModal
        isOpen={isWhatWorksOpen}
        onClose={() => setIsWhatWorksOpen(false)}
      />

      <MemoryCenterModal
        isOpen={isMemoryOpen}
        onClose={() => setIsMemoryOpen(false)}
      />

      <JournalAndGoalsModal
        isOpen={isJournalGoalsOpen}
        onClose={() => setIsJournalGoalsOpen(false)}
      />

      <SafetyPlanModal
        isOpen={isSafetyPlanOpen}
        onClose={() => setIsSafetyPlanOpen(false)}
      />

      <PrivacyCenterModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
        onAccountDeleted={handleDeleteAllUserData}
      />

      {/* Notification Center & Preferences Modals */}
      <NotificationCenterModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onOpenPreferences={() => {
          setIsNotificationsOpen(false);
          setIsNotificationPrefsOpen(true);
        }}
        onNavigateAction={(url) => {
          setIsNotificationsOpen(false);
          if (url.includes('twin')) setIsTwinOpen(true);
          else if (url.includes('memory')) setIsMemoryOpen(true);
          else if (url.includes('journal')) setIsJournalGoalsOpen(true);
          else if (url.includes('calm')) setIsCalmOpen(true);
          else handleStartTalking();
        }}
      />

      <NotificationPreferencesModal
        isOpen={isNotificationPrefsOpen}
        onClose={() => setIsNotificationPrefsOpen(false)}
      />

      {/* Voice Gateway Debug HUD (dev only, active when ?voicedebug=1 is present) */}
      <VoiceDebugHUD />
    </div>
  );
}

export default App;
