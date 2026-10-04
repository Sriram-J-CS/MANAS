import React from 'react';
import { Sparkles, Check } from 'lucide-react';
import type { OutfitType } from './ThreeCartoonMascot';

interface WardrobeItem {
  id: OutfitType;
  label: string;
  category: string;
  description: string;
  accentColor: string;
  previewGradient: string;
}

const WARDROBE_OUTFITS: WardrobeItem[] = [
  {
    id: 'hoodie',
    label: 'Cozy Hoodie',
    category: 'Casual Comfort',
    description: 'Relaxed fleece hoodie for calming, safe conversations.',
    accentColor: '#3b82f6',
    previewGradient: 'from-blue-600 to-indigo-800',
  },
  {
    id: 'formal',
    label: 'Smart Blazer',
    category: 'Professional',
    description: 'Sharp tailored collar and blazer for career & exam guidance.',
    accentColor: '#475569',
    previewGradient: 'from-slate-700 to-zinc-900',
  },
  {
    id: 'kurta_saree',
    label: 'Kurta / Saree',
    category: 'Traditional',
    description: 'Warm cultural grace with soft silk and embroidered borders.',
    accentColor: '#d97706',
    previewGradient: 'from-amber-600 to-orange-800',
  },
  {
    id: 'sports',
    label: 'Active Tracksuit',
    category: 'Energy',
    description: 'Breathable sporty athletic gear to encourage walks and vitality.',
    accentColor: '#10b981',
    previewGradient: 'from-emerald-500 to-teal-800',
  },
  {
    id: 'pyjamas',
    label: 'Cloud Pyjamas',
    category: 'Rest & Sleep',
    description: 'Ultra-soft nightwear to unwind before bed and ease insomnia.',
    accentColor: '#8b5cf6',
    previewGradient: 'from-purple-500 to-violet-900',
  },
  {
    id: 'festive',
    label: 'Festive Sparkle',
    category: 'Celebration',
    description: 'Luminous celebratory attire with shimmering accents.',
    accentColor: '#e11d48',
    previewGradient: 'from-rose-500 to-pink-900',
  },
];

interface WardrobeDrawerProps {
  currentOutfit: OutfitType;
  onSelectOutfit: (outfit: OutfitType) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const WardrobeDrawer: React.FC<WardrobeDrawerProps> = ({
  currentOutfit,
  onSelectOutfit,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 bg-black/90 backdrop-blur-xl border-t border-white/20 p-5 rounded-t-3xl shadow-2xl transition-all animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-mono uppercase tracking-wider text-white font-bold">
            Mascot Wardrobe Drawer
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/70">
            6 Styles
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-xs font-mono text-white/50 hover:text-white transition-colors cursor-pointer px-2 py-1"
        >
          DONE ✕
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[260px] overflow-y-auto pr-1">
        {WARDROBE_OUTFITS.map((item) => {
          const isSelected = currentOutfit === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectOutfit(item.id)}
              className={`relative p-3 rounded-2xl border text-left transition-all cursor-pointer group flex flex-col justify-between ${
                isSelected
                  ? 'border-cyan-400 bg-white/15 shadow-[0_0_16px_rgba(34,211,238,0.25)]'
                  : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
              }`}
            >
              {/* Color swatch accent header */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className="w-3.5 h-3.5 rounded-full shadow-sm"
                  style={{ backgroundColor: item.accentColor }}
                />
                {isSelected && (
                  <span className="w-5 h-5 rounded-full bg-cyan-400 text-black flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-white font-sans">{item.label}</p>
                <p className="text-[10px] font-mono text-white/60 tracking-wider uppercase mt-0.5">
                  {item.category}
                </p>
                <p className="text-[9px] text-white/40 line-clamp-1 mt-1">{item.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
