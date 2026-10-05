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

  // Friendly connection hiccup message on failure — never canned therapy reply
  return {
    display_text: 'Connection hiccup, please try again.',
    speech_text: 'Connection hiccup, please try again.',
    language,
    emotion: 'calm',
    safety_flag: false
  };

}
