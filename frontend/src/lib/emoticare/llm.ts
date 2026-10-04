/**
 * EmotiCare Client-Side LLM Adapter
 * Calls /api/chat with full variety engine and safety classifier support.
 */

import type { SupportedLanguage, LLMOutputJSON } from './types';

export interface SendChatMessageOptions {
  message: string;
  language: SupportedLanguage;
  recentBotOpeners?: string[];
  recentModes?: string[];
  userName?: string;
}

export async function sendChatMessage(
  options: SendChatMessageOptions
): Promise<LLMOutputJSON> {
  const {
    message,
    language = 'en-IN',
    recentBotOpeners = [],
    recentModes = [],
    userName = 'Friend'
  } = options;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        language,
        recentBotOpeners,
        recentModes,
        userName
      })
    });

    if (res.ok) {
      const data = await res.json();
      return data as LLMOutputJSON;
    }
  } catch (err) {
    console.warn('Chat request failed, using client fallback:', err);
  }

  // Graceful fallback
  return {
    display_text: 'I hear you, my friend. Let us take a gentle breath together; I am right here by your side.',
    speech_text: 'I hear you, my friend. Let us take a gentle breath together; I am right here by your side.',
    language,
    emotion: 'empathetic',
    safety_flag: false
  };
}
