import { useState, useRef, useCallback, useEffect } from 'react';

interface UseMascotAudioLipSyncOptions {
  onVisemeChange?: (energy: number) => void;
  onSpeakingStateChange?: (isSpeaking: boolean) => void;
}

export function useMascotAudioLipSync(options: UseMascotAudioLipSyncOptions = {}) {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [audioEnergy, setAudioEnergy] = useState<number>(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Initialize Web Audio analyzer
  const getOrCreateAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.6;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return { ctx: audioCtxRef.current, analyser: analyserRef.current };
  }, []);

  // Continuous frequency polling for mouth open visemes
  const startLipSyncLoop = useCallback(() => {
    const loop = () => {
      if (!analyserRef.current) return;
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Focus on human speech frequencies (approx bins 4 to 28)
      let sum = 0;
      const speechBins = 24;
      for (let i = 4; i < 4 + speechBins; i++) {
        sum += dataArray[i] || 0;
      }
      const rawEnergy = sum / (speechBins * 255);
      const normalizedEnergy = Math.min(1.0, rawEnergy * 1.8);

      setAudioEnergy(normalizedEnergy);
      options.onVisemeChange?.(normalizedEnergy);

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);
  }, [options]);

  const stopLipSyncLoop = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setAudioEnergy(0);
    options.onVisemeChange?.(0);
  }, [options]);

  // Main speech invocation: Calls /api/tts with fallback to Web SpeechSynthesis
  const speakText = useCallback(
    async (text: string, language = 'en') => {
      if (isMuted || !text.trim()) return;

      setIsSpeaking(true);
      options.onSpeakingStateChange?.(true);

      try {
        // 1. Attempt server /api/tts call
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, language }),
        });

        if (res.ok) {
          const data = await res.json();
          // If server provided streaming audio payload
          if (!data.fallback && data.audioUrl) {
            const { ctx, analyser } = getOrCreateAudioContext();
            const audio = new Audio(data.audioUrl);
            const source = ctx.createMediaElementSource(audio);
            source.connect(analyser!);
            analyser!.connect(ctx.destination);

            startLipSyncLoop();
            audio.onended = () => {
              stopLipSyncLoop();
              setIsSpeaking(false);
              options.onSpeakingStateChange?.(false);
            };
            await audio.play();
            return;
          }
        }
      } catch (err) {
        console.warn('/api/tts fetch error, falling back to browser SpeechSynthesis:', err);
      }

      // 2. Reliable Fallback: Browser Web SpeechSynthesis
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.05;
        utterance.lang = language === 'ta' ? 'ta-IN' : 'en-US';

        // Animate mouth using periodic synthetic energy while utterance is speaking
        let simInterval: number;
        utterance.onstart = () => {
          simInterval = window.setInterval(() => {
            const simulatedEnergy = 0.25 + Math.random() * 0.55;
            setAudioEnergy(simulatedEnergy);
            options.onVisemeChange?.(simulatedEnergy);
          }, 110);
        };

        utterance.onend = () => {
          clearInterval(simInterval);
          setAudioEnergy(0);
          setIsSpeaking(false);
          options.onSpeakingStateChange?.(false);
        };

        utterance.onerror = () => {
          clearInterval(simInterval);
          setAudioEnergy(0);
          setIsSpeaking(false);
          options.onSpeakingStateChange?.(false);
        };

        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
        options.onSpeakingStateChange?.(false);
      }
    },
    [isMuted, getOrCreateAudioContext, startLipSyncLoop, stopLipSyncLoop, options]
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        stopLipSyncLoop();
        setIsSpeaking(false);
      }
      return next;
    });
  }, [stopLipSyncLoop]);

  useEffect(() => {
    return () => {
      stopLipSyncLoop();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          audioCtxRef.current.close();
        } catch (_) {}
      }
    };
  }, [stopLipSyncLoop]);

  return {
    isSpeaking,
    isMuted,
    audioEnergy,
    speakText,
    toggleMute,
  };
}
