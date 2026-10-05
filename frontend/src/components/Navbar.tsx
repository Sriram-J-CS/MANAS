import React from 'react';
import { Bell } from 'lucide-react';

interface NavbarProps {
  logo: string;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onOpenDemo: () => void;
  user?: { name: string; email?: string; phone?: string } | null;
  onOpenAuth?: () => void;
  onOpenVoiceRatingLab?: () => void;
  onOpenNotifications?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  logo,
  isMenuOpen,
  onToggleMenu,
  user,
  onOpenAuth,
  onOpenVoiceRatingLab,
  onOpenNotifications,
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

      {/* Right: Account, Notifications & MENU triggers */}
      <div className="flex items-center gap-2.5 sm:gap-4 pointer-events-auto">
        {onOpenNotifications && (
          <button
            onClick={onOpenNotifications}
            className="p-1.5 rounded-full border border-white/30 hover:border-white text-white/90 hover:text-white transition-all cursor-pointer flex items-center justify-center"
            title="Notification Center"
            aria-label="Notification Center"
          >
            <Bell className="w-3.5 h-3.5" />
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
