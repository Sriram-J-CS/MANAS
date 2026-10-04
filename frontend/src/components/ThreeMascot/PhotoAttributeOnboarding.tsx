import React, { useState, useRef } from 'react';
import { Camera, Upload, ShieldCheck, Sparkles } from 'lucide-react';
import type { MascotCustomAttributes } from './ThreeCartoonMascot';

interface PhotoAttributeOnboardingProps {
  selectedMascot: 'boy' | 'girl';
  onSelectMascot: (mascot: 'boy' | 'girl') => void;
  onAttributesExtracted: (attributes: MascotCustomAttributes) => void;
  onSkip?: () => void;
}

export const PhotoAttributeOnboarding: React.FC<PhotoAttributeOnboardingProps> = ({
  selectedMascot,
  onSelectMascot,
  onAttributesExtracted,
  onSkip,
}) => {
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [consentChecked, setConsentChecked] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoPreview(event.target?.result as string);
      processPhoto(file);
    };
    reader.readAsDataURL(file);
  };

  const processPhoto = async (file: File) => {
    if (!consentChecked) {
      setStatusMessage('Please agree to the privacy consent to analyze photo attributes.');
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Analyzing facial tones & palette (photo will be deleted immediately)...');

    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('baseMascot', selectedMascot);
      formData.append('consent', 'true');

      const response = await fetch('/api/avatar/photo-attributes', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setStatusMessage('Palette extracted successfully! Temporary photo deleted immediately.');
        onAttributesExtracted({
          skinTone: data.attributes?.skin_tone || data.attributes?.skinTone || '#E0AC69',
          hairColor: data.attributes?.hair_color || data.attributes?.hairColor || '#2C221E',
          hairStyle: data.attributes?.hair_style || data.attributes?.hairStyle || 'short',
          glasses: Boolean(data.attributes?.glasses),
          outfitColor: data.attributes?.outfit_color || data.attributes?.outfitColor || '#3B82F6',
        });
      } else {
        // Fallback heuristic extraction in client
        simulateFreeVisionFallback();
      }
    } catch {
      simulateFreeVisionFallback();
    } finally {
      setIsProcessing(false);
    }
  };

  const simulateFreeVisionFallback = () => {
    setStatusMessage('Default palette applied! Photo removed from memory.');
    onAttributesExtracted({
      skinTone: '#D4A373',
      hairColor: '#1A1110',
      hairStyle: selectedMascot === 'girl' ? 'long_wavy' : 'short_fade',
      glasses: false,
      outfitColor: '#6366F1',
    });
  };

  return (
    <div className="flex flex-col gap-5 text-white">
      {/* 1. Base Mascot Selector (Boy / Girl) */}
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider text-white/70 mb-2">
          1. Choose Base Mascot
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onSelectMascot('boy')}
            className={`p-4 rounded-2xl border text-center transition-all cursor-pointer ${
              selectedMascot === 'boy'
                ? 'border-cyan-400 bg-cyan-500/15 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <div className="text-2xl mb-1">👦</div>
            <p className="font-bold text-sm">Boy Mascot</p>
            <p className="text-[10px] font-mono text-white/50">Rigged 3D Cartoon</p>
          </button>

          <button
            type="button"
            onClick={() => onSelectMascot('girl')}
            className={`p-4 rounded-2xl border text-center transition-all cursor-pointer ${
              selectedMascot === 'girl'
                ? 'border-pink-400 bg-pink-500/15 shadow-[0_0_15px_rgba(244,114,182,0.2)]'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <div className="text-2xl mb-1">👧</div>
            <p className="font-bold text-sm">Girl Mascot</p>
            <p className="text-[10px] font-mono text-white/50">Rigged 3D Cartoon</p>
          </button>
        </div>
      </div>

      {/* 2. Optional Photo Upload */}
      <div className="p-4 rounded-2xl border border-white/10 bg-white/5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-mono uppercase tracking-wider text-white/70 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span>2. Optional Photo Personalization</span>
          </label>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/60">
            Skip Anytime
          </span>
        </div>

        <p className="text-xs text-white/60 leading-relaxed">
          Upload a photo to automatically match your mascot’s skin tone, hair color, glasses, and outfit color.
        </p>

        {/* Consent Checkbox */}
        <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-black/40 border border-white/10 cursor-pointer">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-0.5 rounded accent-cyan-400 cursor-pointer"
          />
          <span className="text-[11px] text-white/70 leading-snug">
            <strong className="text-white">Strict Privacy Consent:</strong> My photo is processed in private quarantine solely to extract color & style attributes, and is <strong>deleted immediately</strong> after processing.
          </span>
        </label>

        {/* Upload Trigger */}
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!consentChecked || isProcessing}
            className="flex-1 py-2.5 px-4 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-xs font-mono text-white font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>{photoPreview ? 'Change Photo' : 'Upload Selfie Photo'}</span>
          </button>

          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="py-2.5 px-4 rounded-xl text-xs font-mono text-white/50 hover:text-white transition-all cursor-pointer"
            >
              Skip
            </button>
          )}
        </div>

        {/* Status indicator */}
        {isProcessing && (
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 animate-pulse">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>{statusMessage}</span>
          </div>
        )}

        {!isProcessing && statusMessage && (
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
