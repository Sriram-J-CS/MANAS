import React from 'react';
import { X, Sparkles } from 'lucide-react';
import { MascotCustomizer } from '../mascot/MascotCustomizer';
import type { MascotConfig } from '../../lib/mascot/mascotConfig';

interface MascotSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply?: (config: MascotConfig) => void;
}

export const MascotSettingsModal: React.FC<MascotSettingsModalProps> = ({
  isOpen,
  onClose,
  onApply,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#0A0A0A]/60 backdrop-blur-sm animate-fade-in font-sans"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#FFFFFF] rounded-3xl overflow-hidden shadow-2xl border border-[#0A0A0A]/10">
        {/* Modal Top Header */}
        <div className="h-14 px-6 border-b border-[#0A0A0A]/10 flex items-center justify-between bg-[#FFFFFF] shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6] animate-pulse" />
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#0A0A0A] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
              3D AI Mascot Studio & Customizer
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#0A0A0A]/60 hover:text-[#0A0A0A] hover:bg-[#F3F0E6] transition-colors cursor-pointer"
            title="Close Customizer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Customizer Body */}
        <div className="flex-1 overflow-hidden">
          <MascotCustomizer
            onClose={onClose}
            onApply={onApply}
          />
        </div>
      </div>
    </div>
  );
};
