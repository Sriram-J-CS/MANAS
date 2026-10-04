import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  ShieldAlert,
  HeartHandshake,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import type { Language, MascotExpression, ChatMessage } from '../types';
import { translations } from '../content/translations';

interface ChatDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang: Language;
  onOpenHelp: () => void;
}

export const ChatDemoModal: React.FC<ChatDemoModalProps> = ({
  isOpen,
  onClose,
  currentLang,
  onOpenHelp,
}) => {
  if (!isOpen) return null;
  const t = translations[currentLang].demoModal;

  const [mascotExpr, setMascotExpr] = useState<MascotExpression>('neutral');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentMood, setCurrentMood] = useState<number | null>(null);

  // Typing dynamics tracker states (§4.4 of Build Guide)
  const [keystrokes, setKeystrokes] = useState(0);
  const [backspaces, setBackspaces] = useState(0);
  const [pauses, setPauses] = useState(0);
  const [charsPerSec, setCharsPerSec] = useState(0);
  const typingStartTime = useRef<number | null>(null);
  const lastKeyTime = useRef<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Seed initial welcome message based on language
  useEffect(() => {
    if (messages.length === 0) {
      if (currentLang === 'ta') {
        setMessages([
          {
            id: '1',
            sender: 'mascot',
            text: 'வணக்கம்! நான் உங்கள் மனநல AI தோழன். இன்று உங்கள் மனம் எப்படி இருக்கிறது? தயங்காமல் என்னுடன் பேசுங்கள்.',
            time: 'Just now',
            expression: 'neutral',
          },
        ]);
      } else {
        setMessages([
          {
            id: '1',
            sender: 'mascot',
            text: "Hello! I'm your AI companion. I'm here to listen without judgment. How are you feeling today?",
            time: 'Just now',
            expression: 'neutral',
          },
        ]);
      }
    }
  }, [currentLang, messages.length]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Keydown listener for typing dynamics
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = performance.now();
    if (typingStartTime.current === null) {
      typingStartTime.current = now;
    }

    if (lastKeyTime.current && now - lastKeyTime.current > 2000) {
      setPauses((p) => p + 1);
    }

    if (e.key === 'Backspace') {
      setBackspaces((b) => b + 1);
    } else {
      setKeystrokes((k) => k + 1);
    }

    lastKeyTime.current = now;

    const elapsedSecs = (now - (typingStartTime.current || now)) / 1000;
    if (elapsedSecs > 0.5) {
      const cps = parseFloat(((keystrokes + 1) / elapsedSecs).toFixed(1));
      setCharsPerSec(cps);
    }
  };

  const resetTypingDynamics = () => {
    typingStartTime.current = null;
    lastKeyTime.current = null;
    setKeystrokes(0);
    setBackspaces(0);
    setPauses(0);
    setCharsPerSec(0);
  };

  // Preset conversation prompts from TEST_CASES.md
  const samplePrompts =
    currentLang === 'ta'
      ? [
          { label: 'தேர்வு பயம்', text: 'தேர்வு பயமா இருக்கு, எதுவும் படிக்க முடியல.' },
          { label: 'அலுவலக அழுத்தம்', text: 'இன்னைக்கு ரொம்ப சோர்வா இருக்கு, ஆபீஸ்ல வேலை அதிகம்.' },
          { label: 'பாதுகாப்பு சோதனை (High Risk)', text: 'எனக்கு வாழ பிடிக்கவில்லை. எல்லாத்தையும் முடிச்சுக்கணும்.' },
        ]
      : [
          { label: 'Exam Stress (T01)', text: "I have three exams next week and I can't focus. My mind just goes blank." },
          { label: 'Work Fatigue (T02)', text: "ugh work deadlines again. so tired of everything" },
          { label: 'Safety Trigger (T22)', text: "I don't want to live anymore." },
        ];

  // Send message and process safety filter
  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      time: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    resetTypingDynamics();
    setIsTyping(true);

    const lower = text.toLowerCase();
    const isCrisis =
      lower.includes("don't want to live") ||
      lower.includes('dont want to live') ||
      lower.includes('want to die') ||
      lower.includes('kill myself') ||
      lower.includes('suicide') ||
      lower.includes('hurt myself') ||
      lower.includes('end it all') ||
      text.includes('வாழ பிடிக்கவில்லை') ||
      text.includes('சாக வேண்டும்') ||
      text.includes('செத்துடலாம்') ||
      lower.includes('sethudalam') ||
      lower.includes('saaganum');

    setTimeout(() => {
      setIsTyping(false);

      if (isCrisis) {
        setMascotExpr('concerned');
        const crisisReply =
          currentLang === 'ta'
            ? 'நான் இப்போது நீங்கள் மிகவும் வேதனையில் இருப்பதை உணர்கிறேன். உங்கள் வாழ்க்கை மிக முக்கியமானது. தயவுசெய்து Tele-MANAS இலவச அவசர உதவி எண் 14416 (அல்லது 112) ஐ உடனே அழையுங்கள். 24 மணி நேரமும் உங்களுடன் பேச நிபுணர்கள் உள்ளனர்.'
            : 'I hear how painful things are right now, and I want to make sure you stay safe. Please connect with someone who can support you immediately: Tele-MANAS is free, confidential, and available 24/7 at 14416, or emergency at 112. You do not have to carry this alone.';

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'mascot',
            text: crisisReply,
            time: 'Just now',
            expression: 'concerned',
            isHighRisk: true,
          },
        ]);
      } else {
        let reply = '';
        let nextExpr: MascotExpression = 'happy';

        if (lower.includes('exam') || lower.includes('தேர்வு') || lower.includes('focus')) {
          nextExpr = 'concerned';
          reply =
            currentLang === 'ta'
              ? 'தேர்வு பயம் இயல்பானதுதான். உங்கள் மனம் தடுமாறுவது புரிகிறது. இப்போது புத்தகங்களை மூடிவிட்டு, 2 நிமிடங்கள் அமைதியாக மூச்சுப் பயிற்சி செய்வோமா? பிறகு சிறிய பகுதியாகப் படிக்கலாம்.'
              : "Exam stress can feel overwhelming when everything hits at once. It's completely valid to feel your mind blanking. Let's take one small step: take 3 slow breaths together, then we can break your study plan into 20-minute chunks. Would that help?";
        } else if (
          lower.includes('deadline') ||
          lower.includes('work') ||
          lower.includes('tired') ||
          lower.includes('சோர்வா')
        ) {
          nextExpr = 'neutral';
          reply =
            currentLang === 'ta'
              ? 'வேலைச்சுமை சில நேரங்களில் நம்மை மிகவும் சோர்வடையச் செய்யும். இப்போது எது உங்கள் மனதில் அதிக சுமையாகத் தெரிகிறது? சிறிது நேரம் பேசுங்கள், மனம் லேசாகலாம்.'
              : "Work pressure can truly drain your physical and emotional reserves. When everything feels heavy, what feels like the single heaviest task right now? Let's take a pause.";
        } else {
          nextExpr = 'happy';
          reply =
            currentLang === 'ta'
              ? 'நீங்கள் உங்கள் எண்ணங்களைப் பகிர்ந்தமைக்கு நன்றி. நான் எப்போதும் உங்களுக்கு ஆதரவாக இருப்பேன். நீங்கள் விரும்பினால் சிறிது நேரம் அமைதிப் பயிற்சி செய்யலாம்.'
              : "Thank you for sharing that with me. Acknowledging how you feel is always the first kind step to yourself. I'm right here with you.";
        }

        setMascotExpr(nextExpr);
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'mascot',
            text: reply,
            time: 'Just now',
            expression: nextExpr,
          },
        ]);
      }
    }, 1200);
  };

  const moodLevels = [
    { num: 1, emoji: '😔', label: 'Very Low' },
    { num: 2, emoji: '🙁', label: 'Low' },
    { num: 3, emoji: '😐', label: 'Okay' },
    { num: 4, emoji: '🙂', label: 'Good' },
    { num: 5, emoji: '😊', label: 'Great' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="bg-[#000000] text-white max-w-4xl w-full h-[92vh] max-h-[860px] border border-white/20 flex flex-col overflow-hidden relative">
        {/* Top Bar with Mascot Expression Avatar */}
        <div className="bg-[#0a0a0a] px-4 sm:px-6 py-3.5 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 border border-white/30 overflow-hidden bg-black">
              <img
                src={`/assets/mascot/mascot_${mascotExpr}.jpg`}
                alt={`Mascot ${mascotExpr}`}
                className="w-full h-full object-cover"
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm uppercase tracking-tight text-white">
                  MANAS Companion
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/30 text-white/80 font-bold uppercase">
                  Live Engine
                </span>
              </div>
              <p className="text-[11px] text-white/50 flex items-center gap-2 font-mono mt-0.5">
                <span>STATE: {mascotExpr.toUpperCase()}</span>
                <span>·</span>
                <span className="text-white/80">{t.status}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenHelp}
              className="pill-btn pill-btn-white py-1 px-3 text-[10px]"
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>14416</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-white/60 hover:text-white transition-colors"
              aria-label="Close Companion"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Telemetry Strip: Typing Dynamics & Guardrail Status */}
        <div className="bg-black border-b border-white/10 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-white/60">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-white font-medium">
              <Activity className="w-3.5 h-3.5" />
              <span>Cadence: {charsPerSec > 0 ? `${charsPerSec} char/s` : 'Mirroring rhythm'}</span>
            </span>
            <span>|</span>
            <span>Pauses: {pauses}</span>
            <span>|</span>
            <span>Edits: {backspaces}</span>
          </div>

          <div className="flex items-center gap-1.5 text-white/80 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Crisis Guardrail: Active Pre-Screen</span>
          </div>
        </div>

        {/* Chat Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-black">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-white text-black font-medium'
                    : msg.isHighRisk
                    ? 'bg-black border-2 border-red-500 text-white'
                    : 'bg-[#111111] border border-white/20 text-white'
                }`}
              >
                {msg.isHighRisk && (
                  <div className="flex items-center gap-1.5 text-red-400 font-bold text-xs mb-2 font-mono">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Tele-MANAS Emergency Safety Net Engaged</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.isHighRisk && (
                  <div className="mt-3 pt-2 border-t border-red-500/30 flex flex-wrap gap-2">
                    <a
                      href="tel:14416"
                      className="pill-btn pill-btn-white py-1 px-3 text-[10px]"
                    >
                      Call Tele-MANAS (14416)
                    </a>
                    <a
                      href="tel:112"
                      className="pill-btn pill-btn-outlined py-1 px-3 text-[10px]"
                    >
                      Call Emergency (112)
                    </a>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-white/40 font-mono mt-1 px-1">
                {msg.sender === 'mascot' ? 'Mascot' : 'You'} · {msg.time}
              </span>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-white/60 font-mono p-2 bg-[#111111] border border-white/20 w-fit">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>{t.typingIndicator}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Test Prompt Chips from TEST_CASES.md */}
        <div className="bg-[#0a0a0a] border-t border-white/10 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-mono text-white/50 shrink-0 uppercase tracking-widest">
            Presets:
          </span>
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(p.text)}
              className="text-[11px] font-mono px-3 py-1 rounded-full border border-white/20 hover:border-white text-white/80 hover:text-white whitespace-nowrap transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* 5-Point Mood Check-in Bar */}
        <div className="bg-black border-t border-white/10 px-4 py-2 flex items-center justify-between">
          <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider">
            {t.moodCheckinTitle}:
          </span>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {moodLevels.map((lvl) => (
              <button
                key={lvl.num}
                onClick={() => setCurrentMood(lvl.num)}
                className={`p-1.5 border transition-all ${
                  currentMood === lvl.num
                    ? 'border-white bg-white/20 scale-105'
                    : 'border-white/20 bg-black hover:border-white/50'
                }`}
                title={lvl.label}
              >
                <span className="text-base sm:text-lg">{lvl.emoji}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Input Bar */}
        <div className="p-3 sm:p-4 bg-[#0a0a0a] border-t border-white/10 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              handleKeyDown(e);
              if (e.key === 'Enter') handleSendMessage();
            }}
            placeholder={t.inputPlaceholder}
            className="flex-1 px-4 py-3 border border-white/20 bg-black text-sm text-white focus:outline-none focus:border-white placeholder:text-white/40 font-mono"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim()}
            className="pill-btn pill-btn-white py-3 px-5 disabled:opacity-30"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
