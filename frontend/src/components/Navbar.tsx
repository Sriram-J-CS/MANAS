import React from 'react';

interface NavbarProps {
  logo: string;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onOpenDemo: () => void;
  user?: { name: string; email?: string; phone?: string } | null;
  onOpenAuth?: () => void;
  onOpenVoiceRatingLab?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  logo,
  isMenuOpen,
  onToggleMenu,
  user,
  onOpenAuth,
  onOpenVoiceRatingLab,
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-[18px_22px] pointer-events-none mix-blend-difference select-none">
      {/* Logo Mark Top-Left */}
      <a
        href="#hero"
        className="pointer-events-auto text-[13px] font-extrabold tracking-[-0.02em] uppercase text-white hover:opacity-70 transition-opacity"
      >
        <span>{logo}</span>
      </a>

      {/* Right: Account & MENU triggers */}
      <div className="flex items-center gap-2.5 sm:gap-4 pointer-events-auto">
        {onOpenVoiceRatingLab && (
          <button
            onClick={onOpenVoiceRatingLab}
            className="text-[10px] sm:text-[11px] font-bold tracking-[0.05em] uppercase text-emerald-300 hover:text-white px-2.5 sm:px-3 py-1 rounded-full border border-emerald-400/40 hover:border-emerald-300 transition-all cursor-pointer font-mono bg-emerald-500/10"
            title="Google Cloud TTS Chirp 3 HD Voice Rating Lab"
          >
            Voice Lab (8 Langs)
          </button>
        )}
        {onOpenAuth && (
          <button
            onClick={onOpenAuth}
            className="text-[11px] font-bold tracking-[0.05em] uppercase text-white/90 hover:text-white px-3 py-1 rounded-full border border-white/30 hover:border-white transition-all cursor-pointer font-mono"
          >
            {user?.name ? `Hi, ${user.name.split(' ')[0]}` : 'Sign In'}
          </button>
        )}
        <button
          onClick={onToggleMenu}
          className="text-[12px] font-bold tracking-[0.08em] uppercase text-white hover:opacity-70 transition-opacity cursor-pointer font-mono"
          aria-label={isMenuOpen ? 'Close Menu' : 'Open Menu'}
        >
          {isMenuOpen ? 'CLOSE ::' : 'MENU ::'}
        </button>
      </div>
    </header>
  );
};
