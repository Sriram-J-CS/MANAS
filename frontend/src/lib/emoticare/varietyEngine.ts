/**
 * EmotiCare Variety Engine
 * Dynamic turn-by-turn conversational mode selector and anti-repetition guard.
 */

import type { ReplyMode } from './types';

export interface VarietyEngineConfig {
  temperature: number;
  topP: number;
  selectedMode: ReplyMode;
  modeDirective: string;
  forbiddenOpeners: string[];
}

export const REPLY_MODE_DEFINITIONS: Record<ReplyMode, { name: string; directive: string }> = {
  validate: {
    name: 'Validation & Normalization',
    directive: 'REPLY MODE: VALIDATE. Fully validate their pain or struggle. Tell them it makes complete sense that they feel this way and they are not broken for feeling it.'
  },
  curious_question: {
    name: 'Curious Open-Ended Reflection',
    directive: 'REPLY MODE: CURIOUS QUESTION. Gently ask one caring, curious question that helps them explore what part of this feels heaviest right now. Keep it pressure-free.'
  },
  reflect: {
    name: 'Empathetic Reflection',
    directive: 'REPLY MODE: REFLECT. Mirror back what they just shared in tender, empathetic words. Show them you truly hear the unspoken weight behind their words.'
  },
  tiny_tip: {
    name: 'Bite-Sized Actionable Micro-Tip',
    directive: 'REPLY MODE: TINY TIP. Suggest exactly ONE practical micro-step they can do in under 60 seconds (e.g. unclench their jaw, drink two sips of water, or step back for one breath).'
  },
  light_humor: {
    name: 'Tender Lightness & Warmth',
    directive: 'REPLY MODE: LIGHT HUMOR. Bring a soft, affectionate smile into your words. Reassure them with warm, gentle levity that life does not all have to be solved this very minute.'
  },
  just_listen: {
    name: 'Just Listen & Hold Space',
    directive: 'REPLY MODE: JUST LISTEN. Do not try to solve or teach. Offer simple, unconditional presence. Remind them that you are right here beside them, listening as long as they need.'
  }
};

const ALL_MODES: ReplyMode[] = [
  'validate',
  'curious_question',
  'reflect',
  'tiny_tip',
  'light_humor',
  'just_listen'
];

export function getVarietyEngineConfig(
  lastModes: ReplyMode[] = [],
  lastBotOpeners: string[] = []
): VarietyEngineConfig {
  const prevMode = lastModes[lastModes.length - 1];
  const eligibleModes = ALL_MODES.filter((m) => m !== prevMode);
  const selectedMode = eligibleModes[Math.floor(Math.random() * eligibleModes.length)] || 'validate';

  const forbiddenOpeners = lastBotOpeners
    .slice(-3)
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  return {
    temperature: 0.9,
    topP: 0.9,
    selectedMode,
    modeDirective: REPLY_MODE_DEFINITIONS[selectedMode].directive,
    forbiddenOpeners
  };
}

export function extractBotOpener(reply: string): string {
  const clean = reply.trim();
  const firstSentence = clean.split(/[.!?।\n]/)[0] || clean.slice(0, 40);
  return firstSentence.trim();
}
