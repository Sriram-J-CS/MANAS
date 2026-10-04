import React from 'react';

interface NavbarProps {
  logo: string;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onOpenDemo: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  logo,
  isMenuOpen,
  onToggleMenu,
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

      {/* Right: MENU :: trigger */}
      <div className="flex items-center gap-4 pointer-events-auto">
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
