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
    const streamHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
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
              spoken_text: payload.spoken_text || payload.reply,
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
    }

    const finalEmotion = normalizeEmotion(metaData.emotion || metaData.expression || 'calm');
    const finalReply = metaData.reply || accumulatedText || 'Connection hiccup, please try again.';

    return {
      message: finalReply,
      emotion: finalEmotion,
      animation: metaData.gesture || 'nod',
      voice: true,
      spoken_text: metaData.spoken_text || finalReply,
      state_label: metaData.state_label || 'Mindful & Present',
      stress_level: metaData.stress_level ?? 4,
      helplines: metaData.helplines || [],
      suggested_exercise: metaData.suggested_exercise || 'none',
      suggest_tool: metaData.suggest_tool || 'none',
      quick_replies: metaData.quick_replies || [],
      risk_level: metaData.risk_level || 'none',
      isHighRisk: Boolean(metaData.is_high_risk || metaData.crisis || metaData.risk_level === 'high'),
      crisis: Boolean(metaData.crisis || metaData.risk_level === 'high'),
      isError: Boolean(metaData.is_error),
    };
  } catch (err) {
    console.warn('AI Chat API error, friendly connection hiccup fallback:', err);
    return {
      message: 'Connection hiccup, please try again.',
      emotion: 'calm',
      animation: 'gentle',
      voice: false,
      spoken_text: 'Connection hiccup, please try again.',
      state_label: 'Connection Error',
      stress_level: undefined,
      helplines: [],
      suggested_exercise: 'none',
      suggest_tool: 'none',
      quick_replies: [],
      risk_level: 'none',
      isHighRisk: false,
      crisis: false,
      isError: true,
    };
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
