import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Sparkles,
  ShieldCheck,
  Disc3,
  Info,
  Clock,
  Heart,
} from 'lucide-react';
import {
  musicPlayer,
  type PlayerState,
  type RepeatMode,
} from '../../lib/music/musicPlayerService';
import type { MusicTrack } from '../../lib/music/musicTracks';

interface MusicDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MusicDrawer: React.FC<MusicDrawerProps> = ({ isOpen, onClose }) => {
  const [playerState, setPlayerState] = useState<PlayerState>(() => musicPlayer.getState());
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [inspectLicenseTrack, setInspectLicenseTrack] = useState<MusicTrack | null>(null);

  useEffect(() => {
    const unsub = musicPlayer.subscribe((s) => {
      setPlayerState(s);
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    userVolume,
    isMuted,
    isShuffle,
    repeatMode,
    isDucked,
    playlist,
  } = playerState;

  const categories = ['All', 'Calm', 'Sleep', 'Focus', 'Breathing', 'Nature'];

  const filteredPlaylist = selectedCategory === 'All'
    ? playlist
    : playlist.filter((t) => t.category.toLowerCase() === selectedCategory.toLowerCase());

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    musicPlayer.seek(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    musicPlayer.setVolume(newVol);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex justify-end animate-in fade-in duration-200 font-sans">
      <div className="w-full max-w-xl h-full bg-[#FFFFFF] flex flex-col shadow-2xl overflow-hidden border-l border-[#0A0A0A]/10 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#0A0A0A]/10 flex items-center justify-between bg-[#FDFBF7]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center shadow-xs">
              <Disc3 className="w-4 h-4 animate-[spin_8s_linear_infinite]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0A0A0A] tracking-tight">
                Therapeutic Soundscapes
              </h2>
              <p className="text-xs text-[#0A0A0A]/50">
                12 Royalty-Free Calming & Binaural Compositions
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#0A0A0A]/50 hover:text-black hover:bg-black/5 transition-colors cursor-pointer"
            title="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="px-6 py-2.5 border-b border-[#0A0A0A]/5 bg-[#FAF8F5] flex items-center gap-2 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition-all shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#0A0A0A] text-white shadow-xs'
                  : 'bg-[#FFFFFF] border border-[#0A0A0A]/12 text-[#0A0A0A]/70 hover:bg-[#F2EFE8]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Scrollable Main Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* NOW PLAYING HERO CARD (Spotify-style) */}
          <div className="relative rounded-3xl p-6 bg-gradient-to-br from-[#18181b] via-[#27272a] to-[#09090b] text-white shadow-xl overflow-hidden">
            {/* Ambient Background Glow matching Track */}
            <div
              className={`absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br ${currentTrack.coverGradient} opacity-30 blur-3xl pointer-events-none`}
            />

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-5">
              {/* Album Art Cover */}
              <div
                className={`w-28 h-28 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br ${currentTrack.coverGradient} shadow-2xl flex items-center justify-center shrink-0 border border-white/20`}
              >
                <Disc3 className="w-12 h-12 text-white/90" />
              </div>

              {/* Title & Artist */}
              <div className="flex-1 text-center md:text-left min-w-0">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider font-semibold uppercase bg-white/15 text-white/90">
                    {currentTrack.category}
                  </span>
                  {isDucked && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider font-semibold bg-amber-400 text-black animate-pulse">
                      Avatar Speaking (Ducked)
                    </span>
                  )}
                </div>

                <h3 className="text-lg md:text-xl font-bold truncate tracking-tight text-white">
                  {currentTrack.title}
                </h3>
                <p className="text-xs text-white/60 mb-2 truncate">
                  {currentTrack.artist}
                </p>
                <p className="text-[11px] text-white/40 line-clamp-2 leading-relaxed">
                  {currentTrack.description}
                </p>

                {/* License Note Trigger */}
                <button
                  type="button"
                  onClick={() => setInspectLicenseTrack(currentTrack)}
                  className="mt-2 text-[10px] font-mono text-white/50 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  View License Note
                </button>
              </div>
            </div>

            {/* Scrubbable Seek Bar */}
            <div className="relative z-10 mt-6 space-y-1">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
              />
              <div className="flex justify-between text-[10px] font-mono text-white/50">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Main Playback Controls */}
            <div className="relative z-10 mt-4 flex items-center justify-between">
              {/* Shuffle Button */}
              <button
                type="button"
                onClick={() => musicPlayer.toggleShuffle()}
                className={`p-2 rounded-full transition-colors cursor-pointer ${
                  isShuffle ? 'text-emerald-400' : 'text-white/40 hover:text-white'
                }`}
                title={isShuffle ? 'Shuffle: ON' : 'Shuffle: OFF'}
              >
                <Shuffle className="w-4 h-4" />
              </button>

              {/* Prev / Play / Next Cluster */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => musicPlayer.prevTrack()}
                  className="p-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Previous Track"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => musicPlayer.togglePlay()}
                  className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 transition-all cursor-pointer"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => musicPlayer.nextTrack()}
                  className="p-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Next Track"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              {/* Repeat Button */}
              <button
                type="button"
                onClick={() => musicPlayer.cycleRepeatMode()}
                className={`p-2 rounded-full transition-colors cursor-pointer ${
                  repeatMode !== 'off' ? 'text-emerald-400' : 'text-white/40 hover:text-white'
                }`}
                title={`Repeat: ${repeatMode.toUpperCase()}`}
              >
                {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              </button>
            </div>

            {/* Volume Slider & Ducking Notice */}
            <div className="relative z-10 mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 w-full max-w-[200px]">
                <button
                  type="button"
                  onClick={() => musicPlayer.toggleMute()}
                  className="text-white/60 hover:text-white cursor-pointer"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || userVolume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : userVolume}
                  onChange={handleVolumeChange}
                  className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>

              <span className="text-[10px] font-mono text-white/40 text-right">
                Auto-Ducking: Active
              </span>
            </div>
          </div>

          {/* PLAYLIST SECTION */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-[#0A0A0A]/50">
                Therapeutic Queue ({filteredPlaylist.length} tracks)
              </h4>
              <span className="text-[11px] text-[#0A0A0A]/40 font-mono">
                Click any track to listen
              </span>
            </div>

            <div className="space-y-1.5">
              {filteredPlaylist.map((track, idx) => {
                const isSelected = track.id === currentTrack.id;
                return (
                  <div
                    key={track.id}
                    onClick={() => musicPlayer.playTrack(track)}
                    className={`group flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#0A0A0A] text-white shadow-md'
                        : 'bg-[#FAF8F5] hover:bg-[#F2EFE8] text-[#0A0A0A]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Track Number or Animated Visualizer */}
                      <span className="w-5 text-center text-xs font-mono font-semibold opacity-50 shrink-0">
                        {isSelected && isPlaying ? (
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                        ) : (
                          idx + 1
                        )}
                      </span>

                      {/* Small Album Thumbnail */}
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${track.coverGradient} flex items-center justify-center shrink-0 shadow-xs`}
                      >
                        <Disc3 className="w-4 h-4 text-white/90" />
                      </div>

                      {/* Title & Artist */}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {track.title}
                        </p>
                        <p
                          className={`text-xs truncate ${
                            isSelected ? 'text-white/60' : 'text-[#0A0A0A]/50'
                          }`}
                        >
                          {track.artist} • {track.category}
                        </p>
                      </div>
                    </div>

                    {/* Duration & Info */}
                    <div className="flex items-center gap-2.5 shrink-0 ml-3">
                      <span
                        className={`text-xs font-mono ${
                          isSelected ? 'text-white/60' : 'text-[#0A0A0A]/40'
                        }`}
                      >
                        {formatTime(track.duration)}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectLicenseTrack(track);
                        }}
                        className={`p-1.5 rounded-full opacity-60 hover:opacity-100 transition-opacity cursor-pointer ${
                          isSelected ? 'hover:bg-white/10' : 'hover:bg-black/5'
                        }`}
                        title="View License"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* LICENSE MODAL / POPUP */}
        {inspectLicenseTrack && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#FFFFFF] rounded-3xl p-6 shadow-2xl space-y-4 border border-[#0A0A0A]/10 animate-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${inspectLicenseTrack.coverGradient} flex items-center justify-center`}
                  >
                    <Disc3 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#0A0A0A]">
                      {inspectLicenseTrack.title}
                    </h4>
                    <p className="text-xs text-[#0A0A0A]/50 font-mono">
                      {inspectLicenseTrack.artist}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectLicenseTrack(null)}
                  className="p-1 rounded-full text-[#0A0A0A]/40 hover:text-black cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#0A0A0A]/10 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold font-mono text-[11px]">
                  <ShieldCheck className="w-4 h-4" />
                  Royalty-Free Verified License
                </div>
                <p className="text-[#0A0A0A]/80 leading-relaxed">
                  {inspectLicenseTrack.licenseNote}
                </p>
                <p className="text-[#0A0A0A]/50 text-[11px] leading-relaxed pt-1 border-t border-[#0A0A0A]/5">
                  Acoustic Design: {inspectLicenseTrack.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setInspectLicenseTrack(null)}
                className="w-full py-2.5 rounded-xl bg-[#0A0A0A] text-white font-medium text-xs hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Close License Details
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
