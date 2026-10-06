import React, { useState, useEffect } from 'react';
import {
  voiceDebugStore,
  type VoiceDebugEntry,
  NATIVE_6_LANGS
} from '../../lib/voice/speechGateway';
import {
  Activity,
  AlertTriangle,
  Copy,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  Volume2
} from 'lucide-react';

export const VoiceDebugHUD: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [entries, setEntries] = useState<VoiceDebugEntry[]>([]);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    // Check if ?voicedebug=1 or localStorage flag is present
    const params = new URLSearchParams(window.location.search);
    const active =
      params.get('voicedebug') === '1' ||
      params.get('voicedebug') === 'true' ||
      window.location.hash.includes('voicedebug=1') ||
      localStorage.getItem('manas_voice_debug') === 'true';

    setIsEnabled(active);
  }, []);

  useEffect(() => {
    if (!isEnabled) return;
    const unsub = voiceDebugStore.subscribe((newEntries) => {
      setEntries([...newEntries]);
    });
    return unsub;
  }, [isEnabled]);

  if (!isEnabled) return null;

  const handleCopyLogs = () => {
    const formatted = JSON.stringify(entries, null, 2);
    navigator.clipboard.writeText(formatted).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getEngineBadge = (engine: string) => {
    switch (engine) {
      case 'sarvam_bulbul_v3':
        return 'bg-purple-950/80 text-purple-300 border-purple-600/50';
      case 'pregenerated_mp3':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50';
      case 'google_chirp3_hd':
        return 'bg-blue-950/80 text-blue-300 border-blue-600/50';
      case 'web_speech':
        return 'bg-rose-950 text-rose-300 border-rose-600 animate-pulse font-bold';
      case 'banned_fallback':
        return 'bg-amber-950 text-amber-300 border-amber-600 font-bold';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div
      id="voice-debug-hud"
      className="fixed bottom-4 left-4 z-[9999] max-w-md w-full bg-[#0a0d14]/95 border border-white/20 rounded-2xl shadow-2xl backdrop-blur-xl text-xs font-mono text-slate-200 overflow-hidden select-none transition-all"
    >
      {/* Header */}
      <div className="px-3 py-2 bg-black/60 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="font-bold text-white tracking-wide text-[11px]">
            VOICE DEBUG HUD
          </span>
          <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-slate-400">
            {entries.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyLogs}
            className="p-1 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 flex items-center gap-1 text-[10px] transition-colors"
            title="Copy logs as JSON"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied!' : 'Copy Logs'}</span>
          </button>
          <button
            onClick={() => voiceDebugStore.clear()}
            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            {isMinimized ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Body Entries */}
      {!isMinimized && (
        <div className="max-h-64 overflow-y-auto p-2 space-y-2 divide-y divide-white/5">
          {entries.length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-[11px]">
              No voice events captured yet. Play voice or trigger chat to inspect.
            </div>
          ) : (
            entries.map((item) => {
              const isBrowser = item.engine === 'web_speech';
              const isNativeAndLatin = NATIVE_6_LANGS.has(item.lang) && item.hasLatin;
              const hasAlert = isBrowser || isNativeAndLatin || item.isWarning;

              return (
                <div
                  key={item.id}
                  className={`pt-2 first:pt-0 space-y-1.5 rounded-lg p-2 transition-all ${
                    hasAlert
                      ? 'bg-rose-950/20 border border-rose-500/30'
                      : 'bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-white px-1.5 py-0.5 rounded bg-white/10" title="Language">
                        lang:{item.lang.toUpperCase()}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[9px] uppercase tracking-wider ${getEngineBadge(
                          item.engine
                        )}`}
                      >
                        {item.engine}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-indigo-950/70 text-indigo-300 text-[9px]" title="Companion avatar">
                        comp:{item.companion || item.gender || 'girl'}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                          (item.voice_gender || item.gender) === 'boy' || (item.voice_gender || item.gender) === 'male'
                            ? 'bg-blue-950/70 text-blue-300'
                            : 'bg-pink-950/70 text-pink-300'
                        }`}
                        title="Voice gender"
                      >
                        voice:{(item.voice_gender || item.gender) === 'boy' || (item.voice_gender || item.gender) === 'male' ? 'male' : 'female'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-300 text-[9px]" title="Resolved speaker">
                        spk:{item.speaker}
                      </span>
                      {item.tone && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-violet-950/70 text-violet-300" title="Speaking tone">
                          tone:{item.tone}
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 text-[9px]">
                      {item.latencyMs}ms • {item.timestamp}
                    </span>
                  </div>

                  {/* Red Warning Banner if engine is browser or text has Latin letters */}
                  {hasAlert && (
                    <div className="px-2 py-1 rounded bg-rose-600/30 border border-rose-500/60 text-rose-200 text-[10px] flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>
                        {item.warningReason ||
                          (isBrowser
                            ? 'WARNING: Spoke via browser TTS fallback!'
                            : 'WARNING: Latin letters detected in native text!')}
                      </span>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-300 leading-relaxed font-sans line-clamp-2 hover:line-clamp-none transition-all">
                    "{item.text}"
                  </div>

                  {item.purpose && (
                    <div className="text-[9px] text-slate-500">
                      purpose: {item.purpose}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
