import React from 'react';
import { X, PhoneCall, AlertTriangle, HeartHandshake, Compass } from 'lucide-react';
import type { Language } from '../types';
import { translations } from '../content/translations';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang: Language;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
  currentLang,
}) => {
  if (!isOpen) return null;
  const t = translations[currentLang].helpSafety;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="bg-[#000000] text-white border border-white/20 max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="p-6 border-b border-white/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HeartHandshake className="w-5 h-5 text-white" />
            <div>
              <span className="text-[10px] font-mono tracking-widest text-white/50 uppercase block">
                Safety Net
              </span>
              <h3 className="text-xl font-bold uppercase tracking-tight text-white">{t.title}</h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-white/60 hover:text-white transition-colors"
            aria-label="Close Help Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          <p className="text-sm text-white/80 leading-relaxed font-sans">
            {t.description}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tele-MANAS Hotline Card */}
            <div className="bg-[#0a0a0a] p-4 border border-white/20 text-center flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-white/60 uppercase tracking-widest">
                  {t.teleManasLabel}
                </span>
                <div className="text-4xl font-extrabold text-white my-2 font-mono">
                  {t.teleManasNumber}
                </div>
                <p className="text-[11px] text-white/50 mb-4 font-mono">
                  {t.teleManasSub}
                </p>
              </div>
              <a
                href={`tel:${t.teleManasNumber}`}
                className="pill-btn pill-btn-white justify-center w-full"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call 14416 Now</span>
              </a>
            </div>

            {/* Emergency Services 112 */}
            <div className="bg-[#0a0a0a] p-4 border border-white/20 text-center flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-white/60 uppercase tracking-widest">
                  {t.emergencyLabel}
                </span>
                <div className="text-4xl font-extrabold text-white my-2 font-mono">
                  {t.emergencyNumber}
                </div>
                <p className="text-[11px] text-white/50 mb-4 font-mono">
                  {t.emergencySub}
                </p>
              </div>
              <a
                href={`tel:${t.emergencyNumber}`}
                className="pill-btn pill-btn-outlined justify-center w-full"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call 112 Now</span>
              </a>
            </div>
          </div>

          {/* AI Disclaimer */}
          <div className="bg-[#0a0a0a] p-4 border border-white/20 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-white shrink-0 mt-0.5" />
            <p className="text-xs text-white/70 font-mono leading-relaxed">
              {t.disclaimer}
            </p>
          </div>

          {/* 5-4-3-2-1 Sensory Grounding */}
          <div className="bg-[#0a0a0a] p-4 border border-white/20">
            <div className="flex items-center gap-2 text-xs font-bold text-white mb-3 font-mono uppercase tracking-wider">
              <Compass className="w-4 h-4 text-white" />
              <span>{t.copingToolsTitle}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-white/70">
              {t.copingTools.map((tool: string, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-white shrink-0" />
                  <span>{tool}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/20 flex justify-end bg-black">
          <button
            onClick={onClose}
            className="pill-btn pill-btn-outlined"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
