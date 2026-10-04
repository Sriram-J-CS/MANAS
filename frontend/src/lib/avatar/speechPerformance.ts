/**
 * MANAS Speech Performance & Gesture Orchestrator
 * Connects chat streaming and dialogue segments to:
 * - AnimationMixer body gesture crossfades
 * - FaceDriver emotions and brow expressions
 * - Eye contact dynamics with natural glances away
 * - State machine: idle, thinking, listening, speaking
 */

import type { AvatarEmotion } from './FaceDriver';

export type AvatarGesture =
  | 'idle'
  | 'nod'
  | 'wave'
  | 'thumbs_up'
  | 'thinking'
  | 'listening'
  | 'talking_1'
  | 'talking_2'
  | 'talking_3'
  | 'talking_4'
  | 'breathing_guide';

export type AvatarState = 'idle' | 'thinking' | 'speaking' | 'listening';

export interface SpeechSegment {
  spoken_text: string;
  emotion?: AvatarEmotion;
  gesture?: AvatarGesture;
}

export interface SpeechPerformanceCallbacks {
  onEmotionChange: (emotion: AvatarEmotion, intensity?: number) => void;
  onGestureChange: (gesture: AvatarGesture, duration?: number) => void;
  onStateChange: (state: AvatarState) => void;
  onBrowRaise?: (raise: boolean) => void;
  onGlanceShift?: (offset: { x: number; y: number }) => void;
}

export class SpeechPerformanceOrchestrator {
  private currentState: AvatarState = 'idle';
  private callbacks: SpeechPerformanceCallbacks;
  private currentSegmentIndex: number = 0;
  private segmentQueue: SpeechSegment[] = [];
  private isProcessingQueue: boolean = false;
  private glanceTimer: number = 0;
  private talkingGestureIndex: number = 1;

  constructor(callbacks: SpeechPerformanceCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Sets current high-level avatar state
   */
  public setState(state: AvatarState): void {
    if (this.currentState === state) return;
    this.currentState = state;
    this.callbacks.onStateChange(state);

    switch (state) {
      case 'thinking':
        this.callbacks.onEmotionChange('thinking', 0.9);
        this.callbacks.onGestureChange('thinking');
        break;

      case 'listening':
        this.callbacks.onEmotionChange('calm', 0.7);
        this.callbacks.onGestureChange('listening');
        break;

      case 'idle':
        this.callbacks.onEmotionChange('calm', 0.5);
        this.callbacks.onGestureChange('idle');
        break;

      case 'speaking':
        // Speaking is handled via sentence segments
        break;
    }
  }

  /**
   * Processes structured chat response or raw text
   */
  public playResponse(segmentsOrText: SpeechSegment[] | string): void {
    if (typeof segmentsOrText === 'string') {
      this.segmentQueue = this.parseTextIntoSegments(segmentsOrText);
    } else {
      this.segmentQueue = [...segmentsOrText];
    }

    this.currentSegmentIndex = 0;
    this.setState('speaking');
    this.processNextSegment();
  }

  /**
   * Automatically parses plain text into structured sentence segments
   */
  public parseTextIntoSegments(text: string): SpeechSegment[] {
    // Split text by punctuation (. ! ?)
    const rawSentences = text
      .replace(/([.?!])\s*(?=[A-Z0-9])/g, '$1|')
      .split('|')
      .map(s => s.trim())
      .filter(Boolean);

    if (rawSentences.length === 0) {
      return [{ spoken_text: text, emotion: 'calm', gesture: 'idle' }];
    }

    const segments: SpeechSegment[] = [];

    rawSentences.forEach((sentence, idx) => {
      const lower = sentence.toLowerCase();
      let emotion: AvatarEmotion = 'calm';
      let gesture: AvatarGesture = `talking_${(idx % 4) + 1}` as AvatarGesture;

      // Greeting detection
      if (idx === 0 && /\b(hello|hi|welcome|vanakkam|namaste|hey|good morning|good evening)\b/.test(lower)) {
        emotion = 'warm_smile';
        gesture = 'wave';
      }
      // Empathy detection
      else if (/\b(understand|hear you|here for you|must be hard|feel|empathy|valid|sense)\b/.test(lower)) {
        emotion = 'empathetic';
        gesture = 'nod';
      }
      // Encouragement detection
      else if (/\b(proud|strong|you can|well done|great|brave|step forward|together)\b/.test(lower)) {
        emotion = 'encouraging';
        gesture = 'thumbs_up';
      }
      // Concern detection
      else if (/\b(sorry|pain|sad|heavy|difficult|hurts|overwhelmed|anxious|afraid)\b/.test(lower)) {
        emotion = 'concerned';
        gesture = 'nod';
      }
      // Happiness / celebration
      else if (/\b(happy|glad|wonderful|awesome|peace|relief|smile)\b/.test(lower)) {
        emotion = 'happy';
        gesture = 'thumbs_up';
      }
      // Calming / breathing
      else if (/\b(breathe|slow down|calm|ground|take a moment|relax)\b/.test(lower)) {
        emotion = 'calm';
        gesture = 'breathing_guide';
      }

      segments.push({
        spoken_text: sentence,
        emotion,
        gesture,
      });
    });

    return segments;
  }

  private processNextSegment(): void {
    if (this.currentSegmentIndex >= this.segmentQueue.length) {
      // Completed speech
      this.setState('idle');
      return;
    }

    const segment = this.segmentQueue[this.currentSegmentIndex];
    this.currentSegmentIndex++;

    // 1. Set Emotion
    const emotion = segment.emotion || 'calm';
    this.callbacks.onEmotionChange(emotion, 1.0);

    // 2. Set Gesture
    const gesture = segment.gesture || `talking_${this.talkingGestureIndex}` as AvatarGesture;
    this.talkingGestureIndex = (this.talkingGestureIndex % 4) + 1;
    this.callbacks.onGestureChange(gesture);

    // 3. Question check: if sentence ends with '?', raise brows
    const isQuestion = segment.spoken_text.trim().endsWith('?');
    if (this.callbacks.onBrowRaise) {
      this.callbacks.onBrowRaise(isQuestion);
    }

    // 4. Estimate duration for this segment (approx 200ms per word, min 1.8s)
    const wordCount = segment.spoken_text.split(/\s+/).length;
    const durationMs = Math.max(1800, wordCount * 220);

    setTimeout(() => {
      if (this.currentState === 'speaking') {
        this.processNextSegment();
      }
    }, durationMs);
  }

  /**
   * Per-frame update for eye contact and glances away
   */
  public update(delta: number): void {
    this.glanceTimer += delta;

    // Every 3.5 seconds, natural brief glance away before returning to eye contact
    if (this.glanceTimer >= 3.5) {
      this.glanceTimer = 0;
      if (this.callbacks.onGlanceShift) {
        // 35% chance to glance briefly away
        if (Math.random() < 0.35) {
          const shift = {
            x: (Math.random() - 0.5) * 0.25,
            y: (Math.random() - 0.5) * 0.15,
          };
          this.callbacks.onGlanceShift(shift);
          setTimeout(() => {
            this.callbacks.onGlanceShift?.({ x: 0, y: 0 });
          }, 600);
        }
      }
    }
  }

  public stop(): void {
    this.segmentQueue = [];
    this.setState('idle');
  }
}
