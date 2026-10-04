import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Camera,
  Upload,
  Check,
  AlertCircle,
  ShieldCheck,
  Palette,
  X,
  RefreshCw,
} from 'lucide-react';
import { detectFaceAndAttributes } from '../../lib/avatar/faceLandmarkService';
import {
  avatar,
  pickModel,
  type AvatarConfig,
} from '../../lib/avatar/avatarConfigService';

export type OutfitType = 'hoodie' | 'formal' | 'kurta_saree' | 'sports' | 'pyjamas' | 'festive';

interface OutfitItem {
  id: OutfitType;
  label: string;
  category: string;
  description: string;
  accentColor: string;
}

const WARDROBE_OUTFITS: OutfitItem[] = [
  {
    id: 'hoodie',
    label: 'Cozy Hoodie',
    category: 'Casual Comfort',
    description: 'Relaxed fleece hoodie for calming, safe conversations.',
    accentColor: '#3b82f6',
  },
  {
    id: 'formal',
    label: 'Smart Blazer',
    category: 'Professional',
    description: 'Sharp tailored collar and blazer for career & exam guidance.',
    accentColor: '#475569',
  },
  {
    id: 'kurta_saree',
    label: 'Kurta / Saree',
    category: 'Traditional',
    description: 'Warm cultural grace with soft silk and embroidered borders.',
    accentColor: '#d97706',
  },
  {
    id: 'sports',
    label: 'Active Tracksuit',
    category: 'Vitality',
    description: 'Breathable sporty athletic gear to encourage walks and vitality.',
    accentColor: '#10b981',
  },
  {
    id: 'pyjamas',
    label: 'Cloud Pyjamas',
    category: 'Rest & Sleep',
    description: 'Ultra-soft nightwear to unwind before bed and ease insomnia.',
    accentColor: '#8b5cf6',
  },
  {
    id: 'festive',
    label: 'Festive Sparkle',
    category: 'Celebration',
    description: 'Luminous celebratory attire with shimmering accents.',
    accentColor: '#e11d48',
  },
];

interface OutfitsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentGender?: 'boy' | 'girl';
  onConfigChange?: (config: AvatarConfig) => void;
}

export const OutfitsPanel: React.FC<OutfitsPanelProps> = ({
  isOpen,
  onClose,
  currentGender = 'boy',
  onConfigChange,
}) => {
  const [currentConfig, setCurrentConfig] = useState<AvatarConfig>(avatar.getConfig());
  const [selectedOutfit, setSelectedOutfit] = useState<OutfitType>(
    (currentConfig.outfit as OutfitType) || 'hoodie'
  );

  // Uploaded photo state (preview without processing immediately)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Detection & Error states
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [detectionSuccess, setDetectionSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync config on mount
  useEffect(() => {
    const cfg = avatar.getConfig();
    setCurrentConfig(cfg);
    if (cfg.outfit) setSelectedOutfit(cfg.outfit as OutfitType);
  }, [isOpen]);

  if (!isOpen) return null;

  // Step 1: Upload Photo and show Preview with privacy note (Don't process anything yet)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset messages
    setDetectionError(null);
    setDetectionSuccess(null);

    // Create preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const url = URL.createObjectURL(file);
    setUploadedFile(file);
    setPreviewUrl(url);
  };

  // Step 2: MediaPipe Face Landmark Detection
  const handleDetectFace = async () => {
    if (!uploadedFile) return;

    setIsDetecting(true);
    setDetectionError(null);
    setDetectionSuccess(null);

    try {
      // 1. Detect face and sample colors
      const { detectedSkin, detectedHair, hairStyle, glasses } =
        await detectFaceAndAttributes(uploadedFile);

      // 2. Select closest model from /models/variants/
      const chosenModel = pickModel({
        hairStyle,
        gender: currentGender,
        glasses,
      });

      // 3. Apply config to global avatar service
      const updated = avatar.applyConfig({
        colors: {
          skin: detectedSkin,
          hair: detectedHair,
          outfit: WARDROBE_OUTFITS.find((o) => o.id === selectedOutfit)?.accentColor || '#3B82F6',
        },
        model: chosenModel,
        hairStyle,
        glasses,
        gender: currentGender,
        outfit: selectedOutfit,
      });

      setCurrentConfig(updated);
      onConfigChange?.(updated);

      setDetectionSuccess(
        `Face detected! Sampled Skin: ${detectedSkin}, Hair: ${detectedHair}. Variant: ${chosenModel.split('/').pop()}`
      );

      // 4. Delete photo from memory afterwards as required
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      setUploadedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.warn('Face detection error:', err);
      setDetectionError(
        err.message || 'No face found in the uploaded photo. Please upload a clear, front-facing portrait.'
      );
    } finally {
      setIsDetecting(false);
    }
  };

  // Step 3: Color picker adjustments
  const handleColorChange = (key: 'skin' | 'hair' | 'outfit', value: string) => {
    const updated = avatar.applyConfig({
      colors: {
        ...currentConfig.colors,
        [key]: value,
      },
    });
    setCurrentConfig(updated);
    onConfigChange?.(updated);
  };

  const handleSelectOutfit = (outfitId: OutfitType) => {
    setSelectedOutfit(outfitId);
    const item = WARDROBE_OUTFITS.find((o) => o.id === outfitId);
    const updated = avatar.applyConfig({
      outfit: outfitId,
      colors: {
        ...currentConfig.colors,
        outfit: item?.accentColor || currentConfig.colors.outfit,
      },
    });
    setCurrentConfig(updated);
    onConfigChange?.(updated);
  };

  const cancelUpload = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setUploadedFile(null);
    setDetectionError(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#0A0A0A]/60 backdrop-blur-sm animate-fade-in font-sans"
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-[#FFFFFF] rounded-3xl overflow-hidden shadow-2xl border border-[#0A0A0A]/10">
        {/* Top Header */}
        <div className="h-14 px-6 border-b border-[#0A0A0A]/10 flex items-center justify-between bg-[#FFFFFF] shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6] animate-pulse" />
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#0A0A0A] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
              OUTFITS & AI FACE PERSONALIZATION
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#0A0A0A]/60 hover:text-[#0A0A0A] hover:bg-[#F3F0E6] transition-colors cursor-pointer"
            title="Close Panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Panel Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SECTION 1: PHOTO PERSONALIZATION (MediaPipe Face Landmarker) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#FDFBF7] border border-[#0A0A0A]/12 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#0A0A0A] uppercase tracking-wider">
                <Camera className="w-4 h-4 text-[#8B5CF6]" />
                <span>AI Photo Personalization (On-Device)</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] font-semibold">
                MediaPipe Vision
              </span>
            </div>

            <p className="text-xs text-[#0A0A0A]/70 leading-relaxed">
              Upload a selfie to sample your exact skin tone and hair color, and automatically pair the closest 3D model variant.
            </p>

            {/* PRIVACY NOTE (MANDATORY REQUIREMENT) */}
            <div className="p-3 rounded-xl bg-[#FFFFFF] border border-[#0A0A0A]/10 flex items-start gap-2.5 text-[11px] text-[#0A0A0A]/70 shadow-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="leading-snug">
                <span className="font-bold text-[#0A0A0A]">Privacy Note: </span>
                Your photo is analyzed 100% in-browser using on-device MediaPipe machine learning. No images are ever uploaded to any server or cloud, and the photo is permanently erased from memory immediately after sampling.
              </div>
            </div>

            {/* Upload Button & Hidden Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              onChange={handleFileChange}
              className="hidden"
            />

            {!previewUrl ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-[#0A0A0A]/20 hover:border-[#8B5CF6] bg-[#FFFFFF] text-xs font-mono font-bold text-[#0A0A0A] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:bg-[#8B5CF6]/5"
              >
                <Upload className="w-4 h-4 text-[#8B5CF6]" />
                <span>Upload photo for face & hair match</span>
              </button>
            ) : (
              /* PHOTO PREVIEW (DON'T PROCESS ANYTHING YET UNTIL CONFIRMED) */
              <div className="p-3.5 rounded-2xl bg-[#FFFFFF] border border-[#0A0A0A]/15 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-[#0A0A0A]">Photo Preview (Ready to analyze)</span>
                  <button
                    type="button"
                    onClick={cancelUpload}
                    className="text-[#0A0A0A]/50 hover:text-rose-600 transition-colors"
                  >
                    Remove ✕
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <img
                    src={previewUrl}
                    alt="Upload Preview"
                    className="w-20 h-20 rounded-xl object-cover border border-[#0A0A0A]/10 shadow-xs"
                  />
                  <div className="flex-1 space-y-2">
                    <p className="text-[11px] text-[#0A0A0A]/70 leading-snug">
                      Click below to detect facial landmarks and sample colors using MediaPipe.
                    </p>
                    <button
                      type="button"
                      disabled={isDetecting}
                      onClick={handleDetectFace}
                      className="py-2 px-4 rounded-xl bg-[#0A0A0A] hover:bg-[#222222] text-white text-xs font-mono font-bold tracking-wider transition-colors flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      {isDetecting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Detecting Face in-browser...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
                          <span>Detect Face & Match Avatar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message when no face is found */}
            {detectionError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-sans flex items-start gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{detectionError}</div>
              </div>
            )}

            {/* Success Message */}
            {detectionSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono flex items-start gap-2 animate-fade-in">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">{detectionSuccess}</div>
              </div>
            )}

            {/* INTERACTIVE COLOR PICKERS (Skin, Hair, Outfit) */}
            <div className="pt-2 border-t border-[#0A0A0A]/10 space-y-2.5">
              <div className="text-xs font-mono font-bold text-[#0A0A0A] flex items-center gap-1.5 uppercase tracking-wider">
                <Palette className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>Adjust Avatar Colors</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                {/* Skin Tone */}
                <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#0A0A0A]/10 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-[#0A0A0A]/60">SKIN TONE</div>
                    <div className="font-bold">{currentConfig.colors.skin}</div>
                  </div>
                  <input
                    type="color"
                    value={currentConfig.colors.skin}
                    onChange={(e) => handleColorChange('skin', e.target.value)}
                    className="w-7 h-7 rounded-lg border border-[#0A0A0A]/20 cursor-pointer p-0 bg-transparent"
                  />
                </div>

                {/* Hair Color */}
                <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#0A0A0A]/10 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-[#0A0A0A]/60">HAIR COLOR</div>
                    <div className="font-bold">{currentConfig.colors.hair}</div>
                  </div>
                  <input
                    type="color"
                    value={currentConfig.colors.hair}
                    onChange={(e) => handleColorChange('hair', e.target.value)}
                    className="w-7 h-7 rounded-lg border border-[#0A0A0A]/20 cursor-pointer p-0 bg-transparent"
                  />
                </div>

                {/* Outfit Accent */}
                <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#0A0A0A]/10 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-[#0A0A0A]/60">OUTFIT ACCENT</div>
                    <div className="font-bold">{currentConfig.colors.outfit || '#3B82F6'}</div>
                  </div>
                  <input
                    type="color"
                    value={currentConfig.colors.outfit || '#3B82F6'}
                    onChange={(e) => handleColorChange('outfit', e.target.value)}
                    className="w-7 h-7 rounded-lg border border-[#0A0A0A]/20 cursor-pointer p-0 bg-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: WARDROBE OUTFITS SELECTOR */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-[#0A0A0A] uppercase tracking-wider">
                Select Mascot Outfit
              </label>
              <span className="text-[11px] font-mono text-[#0A0A0A]/50">
                {WARDROBE_OUTFITS.length} curated styles
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {WARDROBE_OUTFITS.map((item) => {
                const isSelected = selectedOutfit === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectOutfit(item.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 shadow-xs'
                        : 'border-[#0A0A0A]/10 bg-[#FDFBF7] hover:border-[#0A0A0A]/25'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full shadow-xs"
                        style={{ backgroundColor: item.accentColor }}
                      />
                      {isSelected && (
                        <span className="w-4 h-4 rounded-full bg-[#8B5CF6] text-white flex items-center justify-center text-[10px]">
                          ✓
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-xs font-sans text-[#0A0A0A]">
                        {item.label}
                      </div>
                      <div className="text-[10px] font-mono text-[#0A0A0A]/60">
                        {item.category}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 px-6 border-t border-[#0A0A0A]/10 bg-[#FFFFFF] flex justify-between items-center shrink-0">
          <div className="text-xs font-mono text-[#0A0A0A]/60">
            Model: <span className="font-bold text-[#0A0A0A]">{currentConfig.model.split('/').pop()}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-6 rounded-full bg-[#0A0A0A] hover:bg-[#222222] text-white text-xs font-mono font-bold tracking-wider transition-colors cursor-pointer shadow-sm"
          >
            Done & Apply
          </button>
        </div>
      </div>
    </div>
  );
};
