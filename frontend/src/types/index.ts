export type Language = 'en' | 'ta' | 'hi' | 'te' | 'kn' | 'ml' | 'bn' | 'mr' | 'gu' | 'pa';

export type MascotExpression =
  | 'neutral'
  | 'calm'
  | 'happy'
  | 'concerned'
  | 'sad'
  | 'surprised'
  | 'empathetic'
  | 'excited'
  | 'confused'
  | 'thinking'
  | 'encouraging'
  | 'laughing';

export interface TeamMember {
  name: string;
  regNo: string;
  role: string;
  bio: string;
  avatarPlaceholder?: string;
}

export interface FeatureItem {
  id: string;
  monoLabel: string;
  title: string;
  oneLiner: string;
  tagline: string;
  pill: string;
  accentColor: string;
}

export interface HelplineCard {
  name: string;
  number: string;
  alt?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'mascot';
  text: string;
  time: string;
  expression?: MascotExpression;
  isHighRisk?: boolean;
  risk_level?: string;
  crisis?: boolean;
  stress_level?: number;
  detected_emotion?: string;
  helplines?: HelplineCard[];
  state_label?: string;
  suggested_exercise?: 'breathing_4_7_8' | 'grounding_54321' | 'telemanas_hotline' | 'none' | string;
  gesture?: string;
  spoken_text?: string;
  emotion?: string;
  isThinking?: boolean;
  isStreaming?: boolean;
  isError?: boolean;
  retryText?: string;
}
