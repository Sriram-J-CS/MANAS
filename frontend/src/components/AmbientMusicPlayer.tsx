import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Sparkles, Feather, Wind } from 'lucide-react';

// Chords designed for deep emotional warmth, heart expansion, and a soaring weightless sensation
// Each chord defines frequencies (Hz) for multi-voice lush pads
const SOULFUL_CHORDS = [
  // 1. Fmaj9 - "The Uplift" (Heart expands, chest opens, floating upward)
  {
    name: 'Fmaj9',
    freqs: [87.31, 130.81, 174.61, 220.0, 329.63, 392.0], // F2, C3, F3, A3, E4, G4
    bass: 43.65, // F1
  },
  // 2. Cadd9 - "The Flight" (Pure serene clarity, soaring above clouds)
  {
    name: 'Cadd9',
    freqs: [130.81, 196.0, 261.63, 293.66, 329.63, 392.0], // C3, G3, C4, D4, E4, G4
    bass: 65.41, // C2
  },
  // 3. Am9 - "Deep Soulful Connection" (Emotional release, tender comforting warmth)
  {
    name: 'Am9',
    freqs: [110.0, 164.81, 220.0, 261.63, 329.63, 392.0], // A2, E3, A3, C4, E4, G4
    bass: 55.0, // A1
  },
  // 4. Dm11 - "Weightless Grace" (Feeling held and light as a feather)
  {
    name: 'Dm11',
    freqs: [146.83, 174.61, 220.0, 261.63, 349.23, 392.0], // D3, F3, A3, C4, F4, G4
    bass: 73.42, // D2
  },
  // 5. G6/B - "Endless Horizon" (Resolution, flying higher into warm golden light)
  {
    name: 'G6/B',
    freqs: [123.47, 196.0, 246.94, 293.66, 329.63, 392.0], // B2, G3, B3, D4, E4, G4
    bass: 49.0, // G1
  },
  // 6. Fadd9 / 528Hz Heart - "Soulful Serenity" (Deep peace, mind and heart feeling light)
  {
    name: 'Fadd9/528',
    freqs: [87.31, 130.81, 220.0, 264.0, 329.63, 528.0], // F2, C3, A3, C4, E4, 528Hz Love Tone
    bass: 43.65, // F1
  },
];

// Pentatonic & Lydian ethereal celestial notes for flying crystal harp / piano chimes
const CELESTIAL_NOTES = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  392.0,  // G4
  440.0,  // A4
  523.25, // C5
  528.0,  // 528Hz Miracles / Heart frequency
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.0,  // A5
  1046.5, // C6
];

export const AmbientMusicPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.42);
  const [userInteracted, setUserInteracted] = useState<boolean>(false);
  const [currentChordName, setCurrentChordName] = useState<string>('Fmaj9');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const padGainRef = useRef<GainNode | null>(null);
  const delayInputRef = useRef<GainNode | null>(null);

  // Active pad oscillators and gain nodes for smooth crossfades
  const padVoicesRef = useRef<
    Array<{
      osc: OscillatorNode;
      detuneOsc: OscillatorNode;
      gain: GainNode;
      panner?: StereoPannerNode;
    }>
  >([]);

  const timersRef = useRef<Array<number>>([]);
  const chordIndexRef = useRef<number>(0);

  // Initialize or resume AudioContext safely
  const getOrCreateAudioContext = async (): Promise<AudioContext | null> => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    } catch (err) {
      console.warn('AudioContext init error:', err);
      return null;
    }
  };

  // Trigger a delicate, weightless chime note that echoes in stereo space
  const playCelestialChime = (ctx: AudioContext, destination: AudioNode, delaySend: AudioNode) => {
    if (!ctx || ctx.state !== 'running') return;

    try {
      const now = ctx.currentTime;
      const noteFreq = CELESTIAL_NOTES[Math.floor(Math.random() * CELESTIAL_NOTES.length)];

      // Fundamental oscillator (Pure Sine)
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(noteFreq, now);

      // Shimmering octave harmonic overtone
      const overtone = ctx.createOscillator();
      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(noteFreq * 2.002, now); // subtle crystalline beat

      // 3rd harmonic (glitter)
      const glitter = ctx.createOscillator();
      glitter.type = 'triangle';
      glitter.frequency.setValueAtTime(noteFreq * 3, now);

      // Amplitude Envelope: Instant gentle attack, long floating exponential decay
      const env = ctx.createGain();
      const velocity = 0.05 + Math.random() * 0.07; // Soft, intimate touch
      const duration = 3.8 + Math.random() * 2.2; // Hangs in the air like a cloud

      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(velocity, now + 0.025);
      env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      const overtoneGain = ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.28, now);

      const glitterGain = ctx.createGain();
      glitterGain.gain.setValueAtTime(0.06, now);

      // Spatial Stereo Panner: chimes float left and right
      const panValue = (Math.random() - 0.5) * 1.3; // -0.65 to +0.65
      let pannerNode: AudioNode = env;
      if (ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(panValue, now);
        env.connect(panner);
        pannerNode = panner;
      }

      // Connect oscillators
      osc.connect(env);
      overtone.connect(overtoneGain);
      overtoneGain.connect(env);
      glitter.connect(glitterGain);
      glitterGain.connect(env);

      // Send to master and ethereal delay network
      pannerNode.connect(destination);
      pannerNode.connect(delaySend);

      osc.start(now);
      overtone.start(now);
      glitter.start(now);

      osc.stop(now + duration + 0.2);
      overtone.stop(now + duration + 0.2);
      glitter.stop(now + duration + 0.2);
    } catch (_) {}
  };

  // Start the Soulful "Light & Flying" generative music engine
  const startAudio = async () => {
    const ctx = await getOrCreateAudioContext();
    if (!ctx) return;

    try {
      stopCurrentNodes();
      const now = ctx.currentTime;

      // 1. Master Output Gain
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, now);
      masterGain.gain.linearRampToValueAtTime(volume, now + 2.0);
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;

      // 2. Ethereal Stereo Ping-Pong Delay Network (creates floating cathedral / open-sky space)
      const delayInput = ctx.createGain();
      delayInput.gain.setValueAtTime(0.48, now);
      delayInputRef.current = delayInput;

      const delayL = ctx.createDelay();
      delayL.delayTime.setValueAtTime(0.46, now); // 460ms

      const delayR = ctx.createDelay();
      delayR.delayTime.setValueAtTime(0.68, now); // 680ms

      const delayFeedbackL = ctx.createGain();
      delayFeedbackL.gain.setValueAtTime(0.42, now);

      const delayFeedbackR = ctx.createGain();
      delayFeedbackR.gain.setValueAtTime(0.38, now);

      // Warm damping filter for the delay echoes so they sound soft as morning mist
      const delayFilter = ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.setValueAtTime(1400, now);
      delayFilter.Q.setValueAtTime(0.6, now);

      // Cross-feedback ping-pong routing
      delayInput.connect(delayL);
      delayInput.connect(delayR);

      delayL.connect(delayFilter);
      delayFilter.connect(delayFeedbackL);
      delayFeedbackL.connect(delayR);

      delayR.connect(delayFeedbackR);
      delayFeedbackR.connect(delayL);

      const delayMaster = ctx.createGain();
      delayMaster.gain.setValueAtTime(0.55, now);
      delayL.connect(delayMaster);
      delayR.connect(delayMaster);
      delayMaster.connect(masterGain);

      // 3. Warm Analog Pad Subsystem (Soulful chords)
      const padMaster = ctx.createGain();
      padMaster.gain.setValueAtTime(0.32, now);
      padGainRef.current = padMaster;

      const padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.setValueAtTime(950, now);
      padFilter.Q.setValueAtTime(0.6, now);

      padMaster.connect(padFilter);
      padFilter.connect(masterGain);
      padFilter.connect(delayInput);

      // Create initial pad voice oscillators
      const initialChord = SOULFUL_CHORDS[chordIndexRef.current];
      setCurrentChordName(initialChord.name);

      const voices: typeof padVoicesRef.current = [];
      const allFreqs = [initialChord.bass, ...initialChord.freqs];

      allFreqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const detuneOsc = ctx.createOscillator();
        const vGain = ctx.createGain();

        // Warm pure sine + subtle detuned triangle for lush orchestral warmth
        osc.type = idx === 0 ? 'sine' : 'sine';
        detuneOsc.type = 'triangle';

        osc.frequency.setValueAtTime(freq, now);
        detuneOsc.frequency.setValueAtTime(freq * 1.0018, now); // +3 cents detune

        const voiceVol = idx === 0 ? 0.35 : 0.16 / Math.sqrt(allFreqs.length);
        vGain.gain.setValueAtTime(0.001, now);
        vGain.gain.linearRampToValueAtTime(voiceVol, now + 3.0);

        osc.connect(vGain);
        detuneOsc.connect(vGain);

        let outNode: AudioNode = vGain;
        if (ctx.createStereoPanner) {
          const panner = ctx.createStereoPanner();
          const spread = idx === 0 ? 0 : ((idx % 2 === 0 ? 1 : -1) * (0.15 + (idx * 0.08)));
          panner.pan.setValueAtTime(Math.max(-0.7, Math.min(0.7, spread)), now);
          vGain.connect(panner);
          outNode = panner;
        }

        outNode.connect(padMaster);

        osc.start(now);
        detuneOsc.start(now);

        voices.push({ osc, detuneOsc, gain: vGain });
      });

      padVoicesRef.current = voices;

      // 4. Silky "Flying Breeze" Layer (High-altitude soft air shimmer)
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(3200, now);
      noiseFilter.Q.setValueAtTime(1.8, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.016, now); // Very soft, gentle breeze

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(masterGain);
      noiseSource.start(now);

      // 5. Breathing LFO for pad filter & breeze (10-second respiratory cycle)
      let breathPhase = 0;
      const breathTimer = window.setInterval(() => {
        if (!audioCtxRef.current || audioCtxRef.current.state !== 'running') return;
        breathPhase += 0.08;
        const curTime = audioCtxRef.current.currentTime;
        // Sweeps filter gently from 700Hz (inward exhale) to 1400Hz (expanding chest / inhale)
        const filterCutoff = 1000 + Math.sin(breathPhase) * 450;
        padFilter.frequency.setTargetAtTime(filterCutoff, curTime, 0.8);
        noiseFilter.frequency.setTargetAtTime(3200 + Math.cos(breathPhase) * 900, curTime, 1.2);
      }, 300);
      timersRef.current.push(breathTimer);

      // 6. Soulful Chord Progression Sequencer (transitions every 7.5 seconds)
      const chordTimer = window.setInterval(() => {
        if (!audioCtxRef.current || audioCtxRef.current.state !== 'running') return;
        const cTime = audioCtxRef.current.currentTime;

        chordIndexRef.current = (chordIndexRef.current + 1) % SOULFUL_CHORDS.length;
        const nextChord = SOULFUL_CHORDS[chordIndexRef.current];
        setCurrentChordName(nextChord.name);

        const newFreqs = [nextChord.bass, ...nextChord.freqs];

        padVoicesRef.current.forEach((voice, i) => {
          if (i < newFreqs.length) {
            const targetFreq = newFreqs[i];
            // Smooth gliding portamento over 3.2 seconds
            voice.osc.frequency.setTargetAtTime(targetFreq, cTime, 1.4);
            voice.detuneOsc.frequency.setTargetAtTime(targetFreq * 1.0018, cTime, 1.4);
          }
        });
      }, 7500);
      timersRef.current.push(chordTimer);

      // 7. Celestial Chime Scheduler (Random soulful melody drops every 1.5 - 2.8s)
      const scheduleNextChime = () => {
        if (!audioCtxRef.current || audioCtxRef.current.state !== 'running') return;
        playCelestialChime(audioCtxRef.current, masterGain, delayInput);

        const nextDelay = 1400 + Math.random() * 1800; // 1.4s - 3.2s natural cadence
        const chimeTimer = window.setTimeout(scheduleNextChime, nextDelay);
        timersRef.current.push(chimeTimer);
      };

      // Initial chime after 1 second
      const initialChimeTimer = window.setTimeout(scheduleNextChime, 1000);
      timersRef.current.push(initialChimeTimer);

      setIsPlaying(true);
      try {
        localStorage.setItem('manas_music_pref', 'play');
      } catch (_) {}
    } catch (err) {
      console.error('Error starting soulful ambient music:', err);
      setIsPlaying(false);
    }
  };

  const stopCurrentNodes = () => {
    // Clear all interval/timeout timers
    timersRef.current.forEach((t) => {
      clearInterval(t);
      clearTimeout(t);
    });
    timersRef.current = [];

    // Stop and disconnect pad voices
    padVoicesRef.current.forEach(({ osc, detuneOsc, gain }) => {
      try {
        osc.stop();
        detuneOsc.stop();
        osc.disconnect();
        detuneOsc.disconnect();
        gain.disconnect();
      } catch (_) {}
    });
    padVoicesRef.current = [];
  };

  const stopAudio = () => {
    if (masterGainRef.current && audioCtxRef.current && audioCtxRef.current.state === 'running') {
      const now = audioCtxRef.current.currentTime;
      masterGainRef.current.gain.linearRampToValueAtTime(0.0001, now + 0.8);
      setTimeout(() => {
        stopCurrentNodes();
        setIsPlaying(false);
      }, 850);
    } else {
      stopCurrentNodes();
      setIsPlaying(false);
    }
    try {
      localStorage.setItem('manas_music_pref', 'paused');
    } catch (_) {}
  };

  const toggleMusic = async () => {
    if (isPlaying) {
      stopAudio();
    } else {
      await startAudio();
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (masterGainRef.current && audioCtxRef.current && audioCtxRef.current.state === 'running') {
      masterGainRef.current.gain.setTargetAtTime(newVol, audioCtxRef.current.currentTime, 0.08);
    }
  };

  // Auto-start audio on first user gesture anywhere on the page if not explicitly paused
  useEffect(() => {
    const handleFirstUserGesture = async () => {
      if (userInteracted) return;
      setUserInteracted(true);

      const pref = localStorage.getItem('manas_music_pref');
      if (pref !== 'paused') {
        await startAudio();
      }
    };

    window.addEventListener('click', handleFirstUserGesture, { once: true });
    window.addEventListener('keydown', handleFirstUserGesture, { once: true });
    window.addEventListener('touchstart', handleFirstUserGesture, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstUserGesture);
      window.removeEventListener('keydown', handleFirstUserGesture);
      window.removeEventListener('touchstart', handleFirstUserGesture);
    };
  }, [userInteracted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCurrentNodes();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          audioCtxRef.current.close();
        } catch (_) {}
      }
    };
  }, []);

  return (
    <div className="fixed bottom-5 left-5 z-50 flex items-center gap-2.5 bg-[#0D0E12]/95 border border-white/20 backdrop-blur-2xl px-4 py-2.5 rounded-full text-white shadow-[0_10px_35px_rgba(0,0,0,0.6)] select-none transition-all duration-300 hover:border-violet-400/50 hover:shadow-violet-950/30">
      <button
        onClick={toggleMusic}
        className="flex items-center gap-3 group cursor-pointer focus:outline-none"
        title={isPlaying ? 'Pause soulful soothing music' : 'Play soulful music • Mind & Heart feeling light and flying (528Hz & Chimes)'}
        aria-label="Soulful music player toggle"
      >
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            isPlaying
              ? 'bg-gradient-to-tr from-violet-600 to-indigo-400 text-white shadow-lg shadow-violet-500/40 scale-105'
              : 'bg-white/10 text-white group-hover:bg-white/20'
          }`}
        >
          {isPlaying ? <Volume2 className="w-4 h-4 animate-pulse" /> : <VolumeX className="w-4 h-4" />}
        </div>

        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-white font-bold flex items-center gap-1.5">
              <span>Soulful Serenade</span>
              <span className="text-[9px] px-1.5 py-0.2 bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-full font-mono font-medium flex items-center gap-1">
                <Feather className="w-2.5 h-2.5" />
                Light & Flying
              </span>
            </span>

            {isPlaying && (
              <span className="flex items-end gap-0.5 ml-1 h-3.5">
                <span className="w-1 h-3 bg-violet-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1 h-4 bg-cyan-300 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:300ms]" />
                <span className="w-1 h-3.5 bg-indigo-300 rounded-full animate-bounce [animation-delay:450ms]" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[9px] font-mono text-white/60">
            <Sparkles className="w-2.5 h-2.5 text-violet-400" />
            <span>
              {isPlaying
                ? `528Hz Heart Opening • Ethereal Chimes (${currentChordName})`
                : 'Click to feel your mind & heart fly'}
            </span>
          </div>
        </div>
      </button>

      {isPlaying && (
        <div className="flex items-center gap-2 ml-1 pl-3 border-l border-white/15">
          <span title="Breeze & Chimes Volume">
            <Wind className="w-3 h-3 text-white/40" />
          </span>
          <input
            type="range"
            min="0.05"
            max="0.85"
            step="0.02"
            value={volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-violet-400 hover:accent-violet-300"
            title="Music Volume"
          />
        </div>
      )}
    </div>
  );
};
