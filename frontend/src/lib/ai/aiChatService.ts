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
  isHighRisk?: boolean;
  crisis?: boolean;
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
 * Flow: User Message -> Chat API -> Structured Emotion & Animation -> Frontend Mascot Controller
 */
export async function sendChatMessage(options: SendMessageOptions): Promise<StructuredAIResponse> {
  const {
    message,
    userName = 'Friend',
    language = 'en',
    personality = 'friendly',
    role = 'student',
    stylePref = 'reflective',
    age = 20,
    typing_cps,
  } = options;

  // Map personality into prompt tone
  const toneMap: Record<MascotPersonality, string> = {
    friendly: 'gentle',
    calm: 'gentle',
    encouraging: 'motivating',
    playful: 'motivating',
    professional: 'straight-talking',
  };

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = typeof window !== 'undefined' ? localStorage.getItem('manas_access_token') : null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        user_name: userName,
        user_id: typeof window !== 'undefined' ? localStorage.getItem('manas_user_id') || undefined : undefined,
        language,
        tone: toneMap[personality] || 'gentle',
        persona: `mascot_${personality}`,
        role,
        style_pref: stylePref,
        age,
        typing_cps,
      }),
    });

    if (!res.ok) {
      throw new Error(`Chat API responded with status ${res.status}`);
    }

    const data = await res.json();
    const rawReply = data.reply || data.text || "I'm right here beside you. Tell me what's on your mind.";
    const detectedEmotion = normalizeEmotion(data.emotion || data.expression || data.detected_emotion);

    let animation: 'gentle' | 'talking' | 'nod' | 'listening' | 'excited' | 'waving' = 'talking';
    if (detectedEmotion === 'excited') animation = 'excited';
    else if (detectedEmotion === 'encouraging') animation = 'nod';
    else if (detectedEmotion === 'calm') animation = 'gentle';

    return {
      message: rawReply,
      emotion: detectedEmotion,
      animation,
      voice: true,
      spoken_text: data.spoken_text || rawReply,
      state_label: data.state_label || 'Mindful & Present',
      stress_level: typeof data.stress_level === 'number' ? data.stress_level : undefined,
      helplines: data.helplines || [],
      suggested_exercise: data.suggested_exercise || 'none',
      isHighRisk: Boolean(data.is_high_risk || data.crisis),
      crisis: Boolean(data.crisis),
    };
  } catch (err) {
    console.warn('AI Chat API fallback triggered:', err);
    // Friendly fallback response preserving MANAS wellness tone
    return {
      message: "I hear you, and I'm right here beside you. Even when things feel tangled or heavy, take a gentle breath with me. Let's take it one moment at a time.",
      emotion: 'empathetic',
      animation: 'gentle',
      voice: true,
      spoken_text: "I hear you, and I'm right here beside you. Even when things feel tangled or heavy, take a gentle breath with me. Let's take it one moment at a time.",
      state_label: 'Gentle Support',
      stress_level: undefined,
      helplines: [],
      suggested_exercise: 'breathing_4_7_8',
      isHighRisk: false,
      crisis: false,
    };
  }
}

export async function sendChatFeedback(options: {
  messageId: string;
  /** 1 = thumbs up, -1 = thumbs down; or legacy string values */
  rating: 'thumbs_up' | 'thumbs_down' | 'not_understood' | 1 | -1;
  /** 0 = didn't feel understood, 1 = felt understood (default) */
  feltUnderstood?: 0 | 1;
  userConsent: boolean | 0 | 1;
  userMessage?: string;
  botReply?: string;
  strategy?: string;
  notes?: string;
}): Promise<boolean> {
  try {
    // Normalize rating to the API-expected string format
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
        user_id: typeof window !== 'undefined' ? localStorage.getItem('manas_user_id') || 'default_user' : 'default_user',
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
 * Streams chat response token-by-token from /api/chat/stream.
 * Falls back to sendChatMessage if streaming encounters an error.
 */
export async function streamChatMessage(
  options: SendMessageOptions & {
    onMeta?: (meta: Partial<StructuredAIResponse> & { id: string }) => void;
    onToken?: (token: string) => void;
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
  } = options;

  const toneMap: Record<MascotPersonality, string> = {
    friendly: 'gentle',
    calm: 'gentle',
    encouraging: 'motivating',
    playful: 'motivating',
    professional: 'straight-talking',
  };

  try {
    const streamHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    const streamToken = typeof window !== 'undefined' ? localStorage.getItem('manas_access_token') : null;
    if (streamToken) {
      streamHeaders['Authorization'] = `Bearer ${streamToken}`;
    }

    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: streamHeaders,
      body: JSON.stringify({
        message,
        user_name: userName,
        user_id: typeof window !== 'undefined' ? localStorage.getItem('manas_user_id') || 'default_user' : 'default_user',
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
      // Fallback to standard endpoint
      return await sendChatMessage(options);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let metaData: any = {};
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const block of lines) {
        const eventMatch = block.match(/event:\s*(\w+)/);
        const dataMatch = block.match(/data:\s*(.+)/);
        if (!eventMatch || !dataMatch) continue;

        const event = eventMatch[1];
        try {
          const payload = JSON.parse(dataMatch[1]);
          if (event === 'meta') {
            metaData = payload;
            const detectedEmotion = normalizeEmotion(payload.emotion || payload.expression);
            onMeta?.({
              id: payload.id,
              emotion: detectedEmotion,
              animation: payload.gesture || 'nod',
              state_label: payload.state_label,
              stress_level: payload.stress_level,
              suggested_exercise: payload.suggested_exercise,
              helplines: payload.helplines,
              isHighRisk: Boolean(payload.is_high_risk || payload.crisis),
              crisis: Boolean(payload.crisis),
              spoken_text: payload.spoken_text,
            });
          } else if (event === 'token') {
            if (payload.token) {
              accumulatedText += payload.token;
              onToken?.(payload.token);
            }
          }
        } catch (_) {}
      }
    }

    const finalEmotion = normalizeEmotion(metaData.emotion || metaData.expression || 'calm');
    return {
      message: accumulatedText || metaData.reply || "I'm right here beside you. Tell me what's on your mind.",
      emotion: finalEmotion,
      animation: metaData.gesture || 'nod',
      voice: true,
      spoken_text: metaData.spoken_text || accumulatedText,
      state_label: metaData.state_label || 'Attuned & Present',
      stress_level: metaData.stress_level ?? 4,
      helplines: metaData.helplines || [],
      suggested_exercise: metaData.suggested_exercise || 'none',
      isHighRisk: Boolean(metaData.is_high_risk || metaData.crisis),
      crisis: Boolean(metaData.crisis),
    };
  } catch (err) {
    console.warn('Streaming failed, falling back to standard chat:', err);
    return await sendChatMessage(options);
  }
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
