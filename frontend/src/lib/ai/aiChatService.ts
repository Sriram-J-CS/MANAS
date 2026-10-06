import type { MascotEmotion } from '../emotion/emotionEngine';
import { normalizeEmotion } from '../emotion/emotionEngine';
import type { MascotPersonality } from '../mascot/mascotConfig';

export interface StructuredAIResponse {
  message: string;
  emotion: MascotEmotion;
  animation: 'gentle' | 'talking' | 'nod' | 'listening' | 'excited' | 'waving';
  voice: boolean;
  spoken_text: string;
  state_label?: string;
  stress_level?: number;
  helplines?: Array<{ name: string; number: string; alt?: string }>;
  suggested_exercise?: string;
  suggest_tool?: 'none' | 'breathing' | 'grounding' | 'music' | 'journaling';
  quick_replies?: string[];
  risk_level?: 'none' | 'low' | 'medium' | 'high';
  isHighRisk?: boolean;
  crisis?: boolean;
  isError?: boolean;
  segments?: any[];
}

export interface SendMessageOptions {
  message: string;
  userName?: string;
  language?: string;
  personality?: MascotPersonality;
  role?: string;
  stylePref?: string;
  age?: number;
  typing_cps?: number;
}

/**
 * Clean AI Service layer interfacing with backend /api/chat.
 */
export async function sendChatMessage(options: SendMessageOptions): Promise<StructuredAIResponse> {
  return await streamChatMessage(options);
}

export async function sendChatFeedback(options: {
  messageId: string;
  rating: 'thumbs_up' | 'thumbs_down' | 'not_understood' | 1 | -1;
  feltUnderstood?: 0 | 1;
  userConsent: boolean | 0 | 1;
  userMessage?: string;
  botReply?: string;
  strategy?: string;
  notes?: string;
}): Promise<boolean> {
  try {
    let normalizedRating: string = 'thumbs_up';
    if (options.rating === 1 || options.rating === 'thumbs_up') {
      normalizedRating = 'thumbs_up';
    } else if (options.rating === -1) {
      normalizedRating = options.feltUnderstood === 0 ? 'not_understood' : 'thumbs_down';
    } else if (options.rating === 'not_understood') {
      normalizedRating = 'not_understood';
    } else {
      normalizedRating = 'thumbs_down';
    }

    const consent = Boolean(options.userConsent);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = typeof window !== 'undefined' ? localStorage.getItem('manas_access_token') : null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message_id: options.messageId,
        rating: normalizedRating,
        felt_understood: options.feltUnderstood ?? (normalizedRating === 'not_understood' ? 0 : 1),
        user_message: consent ? (options.userMessage || '') : '',
        bot_reply: consent ? (options.botReply || '') : '',
        strategy: options.strategy || '',
        user_consent: consent ? 1 : 0,
        notes: options.notes || '',
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to send feedback:', err);
    return false;
  }
}

/**
 * Streams chat response token-by-token from POST /api/chat.
 * Emits live tokens for sentence-by-sentence TTS and real-time typewriter effect.
 */
export async function streamChatMessage(
  options: SendMessageOptions & {
    onMeta?: (meta: Partial<StructuredAIResponse> & { id: string }) => void;
    onToken?: (token: string) => void;
    onAutoSave?: (autoSaveData: any) => void;
  }
): Promise<StructuredAIResponse> {
  const {
    message,
    userName = 'Friend',
    language = 'en',
    personality = 'friendly',
    role = 'student',
    stylePref = 'reflective',
    age = 20,
    onMeta,
    onToken,
    onAutoSave,
  } = options;

  const storedName = typeof window !== 'undefined' ? localStorage.getItem('manas_user_name') : null;
  const resolvedName = (userName && userName !== 'Friend')
    ? userName
    : (storedName || userName || 'Friend');

  const toneMap: Record<MascotPersonality, string> = {
    friendly: 'gentle',
    calm: 'gentle',
    encouraging: 'motivating',
    playful: 'motivating',
    professional: 'straight-talking',
  };

  try {
    const streamHeaders: Record<string, string> = {
      'Content-Type': 'application/json; charset=utf-8',
      'Accept': 'text/event-stream; charset=utf-8',
    };
    const streamToken = typeof window !== 'undefined' ? localStorage.getItem('manas_access_token') : null;
    if (streamToken) {
      streamHeaders['Authorization'] = `Bearer ${streamToken}`;
    }

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: streamHeaders,
      body: JSON.stringify({
        message,
        user_name: resolvedName,
        language,
        tone: toneMap[personality] || 'gentle',
        persona: `mascot_${personality}`,
        role,
        style_pref: stylePref,
        age,
        typing_cps: options.typing_cps,
      }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Chat API error status ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulatedText = '';
    let metaData: any = {};
    let buffer = '';

    const processBlocks = (blocks: string[]) => {
      for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;
        const blockLines = trimmed.split(/\r?\n/);
        let event = 'message';
        let dataStr = '';
        for (const line of blockLines) {
          if (line.startsWith('event:')) {
            event = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            const piece = line.slice(5).trim();
            dataStr += (dataStr ? '\n' : '') + piece;
          }
        }
        if (!dataStr) continue;
        try {
          const payload = JSON.parse(dataStr);
          if (event === 'meta') {
            metaData = payload;
            const detectedEmotion = normalizeEmotion(payload.emotion || payload.expression);
            onMeta?.({
              id: payload.id,
              emotion: detectedEmotion,
              animation: payload.gesture || (detectedEmotion === 'excited' ? 'excited' : detectedEmotion === 'calm' ? 'gentle' : 'nod'),
              state_label: payload.state_label,
              stress_level: payload.stress_level,
              suggested_exercise: payload.suggested_exercise,
              suggest_tool: payload.suggest_tool,
              quick_replies: payload.quick_replies,
              risk_level: payload.risk_level,
              helplines: payload.helplines,
              isHighRisk: Boolean(payload.is_high_risk || payload.crisis || payload.risk_level === 'high'),
              crisis: Boolean(payload.crisis || payload.risk_level === 'high'),
              spoken_text: payload.spoken_text || payload.speech_text || payload.reply,
              isError: Boolean(payload.is_error),
            });
          } else if (event === 'token') {
            if (payload.token) {
              accumulatedText += payload.token;
              onToken?.(payload.token);
            }
          } else if (event === 'auto_save') {
            onAutoSave?.(payload);
          }
        } catch (_) {}
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || '';
      processBlocks(blocks);
    }

    // Flush any remaining bytes
    buffer += decoder.decode();
    if (buffer.trim()) {
      processBlocks([buffer]);
    }

    const clientFallback = generateClientAutonomousResponse(message, resolvedName, language);
    const finalEmotion = normalizeEmotion(metaData.emotion || metaData.expression || clientFallback.emotion);
    const finalReply = (metaData.reply && metaData.reply !== 'Connection hiccup, please try again.')
      ? metaData.reply
      : (accumulatedText && accumulatedText !== 'Connection hiccup, please try again.')
        ? accumulatedText
        : clientFallback.message;

    return {
      message: finalReply,
      emotion: finalEmotion,
      animation: metaData.gesture || clientFallback.animation,
      voice: true,
      spoken_text: metaData.spoken_text || finalReply,
      state_label: metaData.state_label || clientFallback.state_label,
      stress_level: metaData.stress_level ?? clientFallback.stress_level,
      helplines: metaData.helplines || [],
      suggested_exercise: metaData.suggested_exercise || clientFallback.suggested_exercise,
      suggest_tool: metaData.suggest_tool || clientFallback.suggest_tool,
      quick_replies: (metaData.quick_replies && metaData.quick_replies.length > 0) ? metaData.quick_replies : clientFallback.quick_replies,
      risk_level: metaData.risk_level || 'none',
      isHighRisk: Boolean(metaData.is_high_risk || metaData.crisis || metaData.risk_level === 'high'),
      crisis: Boolean(metaData.crisis || metaData.risk_level === 'high'),
      isError: false,
    };
  } catch (err) {
    console.warn('AI Chat API network notice, activating client autonomous companion:', err);
    const autonomousRes = generateClientAutonomousResponse(message, resolvedName, language);

    // Emit live metadata so avatar expression, quick replies, and states immediately update
    onMeta?.({
      id: `client_auto_${Date.now()}`,
      emotion: autonomousRes.emotion,
      animation: autonomousRes.animation,
      state_label: autonomousRes.state_label,
      stress_level: autonomousRes.stress_level,
      suggested_exercise: autonomousRes.suggested_exercise,
      suggest_tool: autonomousRes.suggest_tool,
      quick_replies: autonomousRes.quick_replies,
      risk_level: 'none',
      helplines: [],
      isHighRisk: false,
      crisis: false,
      spoken_text: autonomousRes.spoken_text,
      isError: false,
    });

    // Stream tokens smoothly for natural typewriter and TTS effects
    if (onToken) {
      const words = autonomousRes.message.split(' ');
      for (let i = 0; i < words.length; i += 3) {
        const chunk = words.slice(i, i + 3).join(' ') + (i + 3 < words.length ? ' ' : '');
        onToken(chunk);
        await new Promise((r) => setTimeout(r, 20));
      }
    }

    return autonomousRes;
  }
}

/**
 * High-quality client-side empathetic companion generator.
 * Guarantees MANAS always provides comforting, thoughtful responses even if
 * backend server is starting up or network temporarily drops.
 */
function generateClientAutonomousResponse(
  message: string,
  userName: string = 'Friend',
  language: string = 'en'
): StructuredAIResponse {
  const text = (message || '').toLowerCase();
  const cleanName = (userName && !['friend', 'user', 'anonymous'].includes(userName.toLowerCase()))
    ? `, ${userName}`
    : '';

  let reply = `I hear you${cleanName}, and it is completely okay to feel like this. Some days just take so much out of us, and carrying that weight inside can feel utterly exhausting. You do not have to explain anything or carry it all by yourself right now. Just drop your shoulders, take a slow, gentle breath with me, and know that I am sitting right here beside you.`;
  let emotion: MascotEmotion = 'empathetic';
  let suggestTool: StructuredAIResponse['suggest_tool'] = 'breathing';
  let suggestedExercise = 'breathing_4_7_8';
  let stateLabel = 'Attuned & Present';
  let quickReplies = ['Just sit quietly with me', 'Everything feels too heavy', 'Can we do breathing?'];

  if (/\b(drain|drained|heavy|exhausted|burnout|burned out|fatigue|weary|no energy|empty|draining)\b/.test(text)) {
    reply = `I hear how heavy things feel today${cleanName}. When your energy is down to zero, even getting through the hour feels overwhelming. Give yourself permission to just be, without fixing anything right now. Take a deep, quiet breath—I am holding this space for you.`;
    emotion = 'empathetic';
    suggestTool = 'breathing';
    suggestedExercise = 'breathing_4_7_8';
    stateLabel = 'Holding Space & Attuned';
    quickReplies = ['Just sit quietly with me', 'Everything feels too heavy', 'Can you help me relax?'];
  } else if (/\b(anxious|anxiety|panic|panicking|racing|scared|fear|shaking|heart racing|nervous|worry)\b/.test(text)) {
    reply = `I can feel how intense and unsettling this anxiety is right now${cleanName}. Even when your thoughts are racing, you are safe in this moment. Place a hand over your heart, feel your feet on the ground, and let out a long, slow breath with me. I'm staying right here with you.`;
    emotion = 'concerned';
    suggestTool = 'breathing';
    suggestedExercise = 'breathing_4_7_8';
    stateLabel = 'Gentle Grounding Active';
    quickReplies = ['Breathe with me', 'I feel scared', 'Talk to me gently'];
  } else if (/\b(sad|crying|tears|depressed|depression|hopeless|hurts|heartbroken|grief)\b/.test(text)) {
    reply = `I'm so sorry things are hurting so deeply right now${cleanName}. Whatever sorrow you are holding, it is completely valid, and you don't have to hide it from me. You don't need to put on a brave face. I am right beside you, listening with warmth.`;
    emotion = 'empathetic';
    suggestTool = 'none';
    suggestedExercise = 'none';
    stateLabel = 'Quiet Comfort';
    quickReplies = ['I just need comfort', 'Why does it hurt so much?', 'Stay with me'];
  } else if (/\b(alone|lonely|nobody cares|no one cares|isolated)\b/.test(text)) {
    reply = `Feeling lonely or disconnected cuts very deep${cleanName}, but I want you to know you are truly not alone in this moment. I am sitting right here with you, listening to every word and caring about how you feel. Take your time—I'm here for you.`;
    emotion = 'empathetic';
    suggestTool = 'none';
    suggestedExercise = 'none';
    stateLabel = 'Beside You & Present';
    quickReplies = ['Can you keep me company?', 'Nobody seems to care', 'Tell me something soothing'];
  } else if (/\b(overwhelm|overwhelmed|too much|stressed|stress|pressure)\b/.test(text)) {
    reply = `It sounds like everything has been piling up until it feels like too much to bear${cleanName}. When everything demands our attention at once, the brain goes into overload. Let's put everything on pause for just a minute. You don't have to solve any problems right now. What feels like the heaviest piece on your mind?`;
    emotion = 'empathetic';
    suggestTool = 'breathing';
    suggestedExercise = 'breathing_4_7_8';
    stateLabel = 'Holding Space & Attuned';
    quickReplies = ['Just sit quietly with me', 'Everything feels too heavy', 'Can we do breathing?'];
  } else if (/\b(exam|study|grades|marks|test|college|deadline)\b/.test(text)) {
    reply = `Academic pressure and expectations can feel so suffocating${cleanName}. Please remember: you are so much more than any score, grade, or exam. Your peace of mind comes first. Let's take a pause together to clear your thoughts.`;
    emotion = 'empathetic';
    suggestTool = 'breathing';
    suggestedExercise = 'breathing_4_7_8';
    stateLabel = 'Relieving Pressure';
    quickReplies = ['I feel overwhelmed', 'Everything is too much', 'Help me breathe'];
  } else if (/\b(good|happy|better|relieved|grateful|calm|peaceful)\b/.test(text)) {
    reply = `It brings such genuine warmth to hear that${cleanName}! Holding onto these lighter, brighter moments helps replenish our energy. I'm so glad to share this good feeling with you. What made things feel a little brighter today?`;
    emotion = 'excited';
    suggestTool = 'none';
    suggestedExercise = 'none';
    stateLabel = 'Joy & Warmth';
    quickReplies = ['I feel more hopeful', 'Thanks for being here', 'What should I try next?'];
  }

  // Multilingual Indian language support
  if (language.startsWith('ta')) {
    reply = `உங்கள் மனசு மிகவும் சோர்வாகவும் பாரமாகவும் இருப்பதை என்னால் உணர முடிகிறது${cleanName}. இந்த பாரத்தை நீங்கள் தனியாக சுமக்க வேண்டியதில்லை. சிறிது நேரம் கண்களை மூடி என்னுடன் ஆழமாக மூச்சு விடுங்கள். நான் எப்போதும் உங்களுடன் இருக்கிறேன்.`;
    quickReplies = ['என்னுடன் அமைதியாக இருங்கள்', 'சுவாசம் பயிற்சி செய்யலாம்', 'மனசு ரொம்ப பாரமாக இருக்கிறது'];
  } else if (language.startsWith('hi')) {
    reply = `मैं समझ सकता हूँ कि आज सब कुछ कितना थका देने वाला और भारी लग रहा है${cleanName}। आपको यह सारा बोझ अकेले उठाने की ज़रूरत नहीं है। आराम से बैठें, मेरे साथ एक गहरी सांस लें, मैं यहीं आपके साथ हूँ।`;
    quickReplies = ['बस यहीं साथ रहिए', 'गहरी सांस लेते हैं', 'सब बहुत भारी लग रहा है'];
  }

  return {
    message: reply,
    emotion,
    animation: emotion === 'excited' ? 'excited' : 'gentle',
    voice: true,
    spoken_text: reply,
    state_label: stateLabel,
    stress_level: suggestTool === 'breathing' ? 7 : 3,
    helplines: [],
    suggested_exercise: suggestedExercise,
    suggest_tool: suggestTool,
    quick_replies: quickReplies,
    risk_level: 'none',
    isHighRisk: false,
    crisis: false,
    isError: false,
  };
}

/**
 * Fetches chronological chat transcript from the database.
 */
export async function fetchChatHistory(userId: string): Promise<any[]> {
  try {
    const res = await fetch(`/api/chat/history/${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages || [];
  } catch (err) {
    console.warn('Failed to load chat history from DB:', err);
    return [];
  }
}

/**
 * Clears conversation transcript from database.
 */
export async function clearChatHistoryRemote(userId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/chat/history/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to clear remote chat history:', err);
    return false;
  }
}

/**
 * Session memory: stores a short summary (mood themes, what helped) in DB.
 */
export async function saveSessionSummaryRemote(
  userId: string,
  summaryData?: { mood_themes?: string; what_helped?: string; summary?: string; messages?: any[] } | any[]
): Promise<any> {
  try {
    const payload = Array.isArray(summaryData)
      ? { user_id: userId, messages: summaryData }
      : { user_id: userId, ...(summaryData || {}) };
    const res = await fetch('/api/session/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Failed to save session summary to DB:', err);
    return null;
  }
}

/**
 * Session memory: loads latest session summary from DB.
 */
export async function fetchSessionSummaryRemote(userId: string): Promise<{ mood_themes?: string; what_helped?: string; summary?: string } | null> {
  try {
    const res = await fetch(`/api/session/summary/${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.summary || null;
  } catch (err) {
    console.warn('Failed to fetch session summary from DB:', err);
    return null;
  }
}

/**
 * Session memory: deletes stored session summary from DB.
 */
export async function deleteSessionSummaryRemote(userId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/session/summary/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to delete session summary from DB:', err);
    return false;
  }
}
