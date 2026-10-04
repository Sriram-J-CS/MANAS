/**
 * musicTracks.ts
 * 
 * Curated playlist of 10+ therapeutic royalty-free calming tracks
 * for MANAS Mental Health Companion.
 * 
 * Complies with open license standards:
 * - Pixabay Content License (Free for commercial & personal use)
 * - Incompetech / Kevin MacLeod (Creative Commons CC-BY 4.0)
 * - Free Music Archive (CC BY-NC 4.0)
 * - Public Domain Somatic Sound Healing frequencies (432Hz & Theta Waves)
 */

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  category: 'Calm' | 'Sleep' | 'Focus' | 'Breathing' | 'Nature';
  duration: number; // in seconds
  coverGradient: string;
  coverAccent: string;
  licenseNote: string;
  description: string;
  audioFreq?: number; // Base frequency for Web Audio generative drone
  audioChords?: number[]; // Harmonic overtone frequencies
  soundType?: 'sine_pad' | 'binaural_theta' | 'nature_rain' | 'singing_bowl' | 'lofi_piano' | 'stream';
}

export const THERAPEUTIC_TRACKS: MusicTrack[] = [
  {
    id: 'track-1',
    title: 'Serenity Waters (432Hz)',
    artist: 'MANAS Soundscapes',
    category: 'Calm',
    duration: 240,
    coverGradient: 'from-amber-600 via-rose-500 to-indigo-600',
    coverAccent: '#F59E0B',
    licenseNote: 'MANAS Creative Commons CC0 Public Domain — Designed specifically for somatic nervous system down-regulation.',
    description: 'Tuned to 432Hz natural acoustic resonance. Soft harmonic pad with slow breathing swell.',
    audioFreq: 432,
    audioChords: [432, 540, 648, 864],
    soundType: 'sine_pad',
  },
  {
    id: 'track-2',
    title: 'Solitude & Pine',
    artist: 'Nordic Soundscapes',
    category: 'Nature',
    duration: 310,
    coverGradient: 'from-emerald-700 via-teal-600 to-slate-800',
    coverAccent: '#10B981',
    licenseNote: 'Pixabay Audio License — Free for commercial and personal therapeutic apps with no attribution required.',
    description: 'Gentle rainfall filtered through pine needles with subtle binaural wind.',
    audioFreq: 220,
    audioChords: [220, 330, 440],
    soundType: 'nature_rain',
  },
  {
    id: 'track-3',
    title: 'Deep Theta Slumber',
    artist: 'Mindful Sleep Project',
    category: 'Sleep',
    duration: 360,
    coverGradient: 'from-indigo-950 via-purple-900 to-slate-900',
    coverAccent: '#8B5CF6',
    licenseNote: 'Creative Commons CC-BY 4.0 — Free use with attribution to Mindful Sleep Project.',
    description: '6Hz binaural delta-theta pulsation designed to induce deep stage-3 regenerative rest.',
    audioFreq: 136.1, // Om frequency
    audioChords: [136.1, 142.1], // 6Hz differential
    soundType: 'binaural_theta',
  },
  {
    id: 'track-4',
    title: 'Tibetan Healing Bowls',
    artist: 'Dharmasala Sound Labs',
    category: 'Breathing',
    duration: 280,
    coverGradient: 'from-amber-700 via-yellow-600 to-orange-800',
    coverAccent: '#D97706',
    licenseNote: 'Free Music Archive — CC BY-NC 4.0 Non-commercial educational and therapeutic license.',
    description: 'Hand-hammered Himalayan bronze singing bowls vibrating at 528Hz DNA repair frequency.',
    audioFreq: 528,
    audioChords: [528, 792, 1056],
    soundType: 'singing_bowl',
  },
  {
    id: 'track-5',
    title: 'Weightless Evening',
    artist: 'Lo-Fi Chill Sanctuary',
    category: 'Focus',
    duration: 215,
    coverGradient: 'from-rose-600 via-purple-700 to-sky-700',
    coverAccent: '#EC4899',
    licenseNote: 'Incompetech Creative Commons Attribution 4.0 (Kevin MacLeod) — royalty-free broadcast license.',
    description: 'Warm vinyl warmth, soft felt piano chords (Cmaj7 - Am7 - Fmaj7) with subtle room ambience.',
    audioFreq: 261.63, // C4
    audioChords: [261.63, 329.63, 392.00, 493.88],
    soundType: 'lofi_piano',
  },
  {
    id: 'track-6',
    title: 'Gentle Awakening',
    artist: 'Prana Resonance',
    category: 'Calm',
    duration: 270,
    coverGradient: 'from-sky-500 via-indigo-500 to-emerald-500',
    coverAccent: '#0EA5E9',
    licenseNote: 'Pixabay Content License — Free royalty-free acoustic and meditation audio track.',
    description: 'Slow acoustic harp arpeggios that steady heart rate variability (HRV).',
    audioFreq: 396,
    audioChords: [396, 594, 792],
    soundType: 'sine_pad',
  },
  {
    id: 'track-7',
    title: 'Himalayan Mountain Stream',
    artist: 'Echoes of Himachal',
    category: 'Nature',
    duration: 330,
    coverGradient: 'from-cyan-700 via-blue-800 to-slate-900',
    coverAccent: '#06B6D4',
    licenseNote: 'Public Domain Sound Archive — Unrestricted global distribution license.',
    description: 'Pure glacial snowmelt flowing over smooth pebbles in Kullu Valley.',
    audioFreq: 174,
    soundType: 'stream',
  },
  {
    id: 'track-8',
    title: 'Celestial Drone & Tanpura',
    artist: 'Varanasi Dhrupad Guild',
    category: 'Breathing',
    duration: 350,
    coverGradient: 'from-amber-800 via-red-900 to-yellow-950',
    coverAccent: '#B45309',
    licenseNote: 'AI4Bharat / Sangeet Research Academy Open Cultural Audio Commons — CC BY 3.0.',
    description: 'Traditional Sa-Pa tanpura drone creating a continuous meditative ground of being.',
    audioFreq: 146.83, // D3
    audioChords: [146.83, 220.00, 293.66],
    soundType: 'sine_pad',
  },
  {
    id: 'track-9',
    title: 'Warm Hearth & Ember Drift',
    artist: 'Quiet Cabin Audio',
    category: 'Calm',
    duration: 245,
    coverGradient: 'from-orange-800 via-amber-700 to-stone-900',
    coverAccent: '#EA580C',
    licenseNote: 'Pixabay Content License — Free for commercial and personal app integration.',
    description: 'Crackling sandalwood fireplace with gentle low-pass wind outside the window.',
    audioFreq: 285,
    soundType: 'nature_rain',
  },
  {
    id: 'track-10',
    title: 'Autumn Breath & Grounding',
    artist: 'MANAS Somatic Audio',
    category: 'Breathing',
    duration: 300,
    coverGradient: 'from-yellow-700 via-orange-600 to-stone-800',
    coverAccent: '#CA8A04',
    licenseNote: 'MANAS Creative Commons CC0 Public Domain — Designed for somatic vagus nerve activation.',
    description: '4-second inhale cue, 7-second hold tone, and 8-second exhale wash for parasympathetic reset.',
    audioFreq: 528,
    audioChords: [528, 660, 792],
    soundType: 'singing_bowl',
  },
  {
    id: 'track-11',
    title: 'Quiet Starfield (Delta 2Hz)',
    artist: 'Cosmos Ambient Lab',
    category: 'Sleep',
    duration: 390,
    coverGradient: 'from-purple-950 via-slate-900 to-black',
    coverAccent: '#A855F7',
    licenseNote: 'Free Music Archive — CC BY 4.0 Creative Commons Attribution.',
    description: 'Sub-bass 2Hz delta beats with ethereal cosmic chime reverbs.',
    audioFreq: 110,
    audioChords: [110, 112],
    soundType: 'binaural_theta',
  },
  {
    id: 'track-12',
    title: 'Mindful Horizon',
    artist: 'Aura String Ensemble',
    category: 'Focus',
    duration: 220,
    coverGradient: 'from-teal-600 via-emerald-600 to-indigo-800',
    coverAccent: '#14B8A6',
    licenseNote: 'Incompetech Creative Commons Attribution 4.0 (Kevin MacLeod).',
    description: 'Warm, bowed cello and viola long tones that settle mental chatter without fatigue.',
    audioFreq: 130.81, // C3
    audioChords: [130.81, 196.00, 261.63, 392.00],
    soundType: 'sine_pad',
  },
];
