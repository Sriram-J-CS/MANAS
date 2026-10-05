import { useState, useRef, useCallback, useEffect } from 'react';
import { speechGateway } from '../../lib/voice/speechGateway';

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

  // Main speech invocation: Routes via speechGateway
  const speakText = useCallback(
    async (text: string, language = 'en') => {
      if (isMuted || !text.trim()) return;

      setIsSpeaking(true);
      options.onSpeakingStateChange?.(true);

      try {
        await speechGateway.speak({
          text,
          lang: language,
          purpose: 'mascot_lipsync',
          onEnergy: (energy) => {
            setAudioEnergy(energy);
            options.onVisemeChange?.(energy);
          },
          onStart: () => {
            setIsSpeaking(true);
            options.onSpeakingStateChange?.(true);
          },
          onEnd: () => {
            setAudioEnergy(0);
            options.onVisemeChange?.(0);
            setIsSpeaking(false);
            options.onSpeakingStateChange?.(false);
          },
          onError: () => {
            setAudioEnergy(0);
            options.onVisemeChange?.(0);
            setIsSpeaking(false);
            options.onSpeakingStateChange?.(false);
          },
        });
      } catch (err) {
        console.warn('speakText error:', err);
        setAudioEnergy(0);
        options.onVisemeChange?.(0);
        setIsSpeaking(false);
        options.onSpeakingStateChange?.(false);
      }
    },
    [isMuted, options]
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        speechGateway.stopSpeaking();
        stopLipSyncLoop();
        setIsSpeaking(false);
        options.onSpeakingStateChange?.(false);
      }
      return next;
    });
  }, [options, stopLipSyncLoop]);

  useEffect(() => {
    return () => {
      stopLipSyncLoop();
      speechGateway.stopSpeaking();
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
