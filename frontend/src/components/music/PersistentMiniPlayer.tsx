import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  ListMusic,
  Sparkles,
  Disc3,
  Info,
} from 'lucide-react';
import { musicPlayer, type PlayerState } from '../../lib/music/musicPlayerService';

interface PersistentMiniPlayerProps {
  onOpenDrawer: () => void;
  className?: string;
}

export const PersistentMiniPlayer: React.FC<PersistentMiniPlayerProps> = ({
  onOpenDrawer,
  className = '',
}) => {
  const [playerState, setPlayerState] = useState<PlayerState>(() => musicPlayer.getState());
  const [isHovered, setIsHovered] = useState<boolean>(false);

  useEffect(() => {
    const unsub = musicPlayer.subscribe((s) => {
      setPlayerState(s);
    });
    return () => unsub();
  }, []);

  const { currentTrack, isPlaying, isDucked, userVolume, isMuted } = playerState;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed bottom-4 left-4 z-40 max-w-sm transition-all duration-300 font-sans ${className}`}
    >
      <div className="flex items-center gap-3 px-3.5 py-2.5 bg-[#FFFFFF]/95 backdrop-blur-xl border border-[#0A0A0A]/12 rounded-2xl shadow-xl hover:shadow-2xl transition-all">
        {/* Album Art with Rotating Disc on Play */}
        <button
          type="button"
          onClick={onOpenDrawer}
          className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 shadow-md group cursor-pointer focus:outline-none"
          title="Open therapeutic playlist"
        >
          <div
            className={`w-full h-full bg-gradient-to-br ${currentTrack.coverGradient} flex items-center justify-center transition-transform ${
              isPlaying ? 'animate-[spin_10s_linear_infinite]' : ''
            }`}
          >
            <Disc3 className="w-5 h-5 text-white/90" />
          </div>

          {/* Equalizer Wave Overlay when Playing */}
          {isPlaying && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center gap-0.5">
              <span className="w-1 h-3 bg-white rounded-full animate-[bounce_0.6s_ease-in-out_infinite]" />
              <span className="w-1 h-4 bg-white rounded-full animate-[bounce_0.8s_ease-in-out_infinite_0.1s]" />
              <span className="w-1 h-2 bg-white rounded-full animate-[bounce_0.5s_ease-in-out_infinite_0.2s]" />
            </div>
          )}
        </button>

        {/* Track Metadata */}
        <div
          onClick={onOpenDrawer}
          className="flex-1 min-w-0 cursor-pointer text-left select-none"
        >
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-[#0A0A0A] truncate">
              {currentTrack.title}
            </p>
            {isDucked && (
              <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/15 text-amber-800 border border-amber-500/25 animate-pulse">
                Ducked
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#0A0A0A]/55 truncate">
            {currentTrack.artist} • {currentTrack.category}
          </p>
        </div>

        {/* Player Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Play / Pause Button */}
          <button
            type="button"
            onClick={() => musicPlayer.togglePlay()}
            className="p-2 rounded-full bg-[#0A0A0A] text-white hover:bg-neutral-800 transition-all cursor-pointer shadow-sm"
            title={isPlaying ? 'Pause' : 'Play therapeutic ambient audio'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
          </button>

          {/* Next Track Button */}
          <button
            type="button"
            onClick={() => musicPlayer.nextTrack()}
            className="p-2 rounded-full text-[#0A0A0A]/60 hover:text-black hover:bg-black/5 transition-all cursor-pointer"
            title="Next Track"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          {/* Open Playlist Drawer Button */}
          <button
            type="button"
            onClick={onOpenDrawer}
            className="p-2 rounded-full text-[#0A0A0A]/60 hover:text-black hover:bg-black/5 transition-all cursor-pointer"
            title="Open Playlist & Soundscape Drawer"
          >
            <ListMusic className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
