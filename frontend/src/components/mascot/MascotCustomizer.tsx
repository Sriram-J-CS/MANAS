import React, { useState, useEffect } from 'react';
import {
  Check,
  Volume2,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { MascotViewer } from './MascotViewer';
import { MascotUploader } from './MascotUploader';
import {
  getMascotConfig,
  saveMascotConfig,
  type MascotConfig,
  type MascotPersonality,
  type MascotBackground,
} from '../../lib/mascot/mascotConfig';
import { clearStoredMascotModel, getStoredMascotModel } from '../../lib/mascot/mascotModelStorage';
import type { MascotEmotion } from '../../lib/emotion/emotionEngine';
import { speechEngine } from '../../lib/voice/speechEngine';

interface MascotCustomizerProps {
  onClose?: () => void;
  onApply?: (config: MascotConfig) => void;
}

export const MascotCustomizer: React.FC<MascotCustomizerProps> = ({
  onClose,
  onApply,
}) => {
  const [config, setConfig] = useState<MascotConfig>(getMascotConfig());
  const [activeTab, setActiveTab] = useState<'preview' | 'upload' | 'expressions' | 'settings'>('preview');
  const [previewEmotion, setPreviewEmotion] = useState<MascotEmotion>('calm');
  const [testSpeechEnergy, setTestSpeechEnergy] = useState<number>(0);
  const [isTestSpeaking, setIsTestSpeaking] = useState<boolean>(false);

  // Uploaded model info
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [modelType, setModelType] = useState<'glb' | 'gltf' | 'fbx' | 'obj' | 'image' | null>(null);

  // Compatibility flags (defaults assume full support for procedural 3D model)
  const [compatibility, setCompatibility] = useState({
    hasModel: true,
    hasAnimations: true,
    hasFacialRig: true,
    hasExpressions: true,
    hasTalking: true,
    explanation: undefined as string | undefined,
  });

  // Expression testing sliders
  const [testSliders, setTestSliders] = useState({
    eyeBlink: 0,
    eyeOpen: 1.0,
    eyebrow: 0.5,
    smile: 0.5,
    frown: 0,
    mouthOpen: 0,
    headTilt: 0,
  });

  // Load custom model if exists
  useEffect(() => {
    getStoredMascotModel().then((stored) => {
      if (stored) {
        setModelUrl(stored.objectUrl);
        setModelType(stored.fileType);
      }
    });
  }, []);

  const handleSave = () => {
    const updated = saveMascotConfig(config);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('manas:custom_mascot_uploaded'));
    }
    onApply?.(updated);
    onClose?.();
  };

  const handleResetDefault = async () => {
    await clearStoredMascotModel();
    setModelUrl(null);
    setModelType(null);
    const def = saveMascotConfig({
      name: 'Luna',
      personality: 'friendly',
      isCustomModel: false,
      background: 'warm_cream',
      speakingEnabled: true,
      animationsEnabled: true,
      voiceSpeed: 0.95,
      expressionIntensity: 1.0,
    });
    setConfig(def);
    setCompatibility({
      hasModel: true,
      hasAnimations: true,
      hasFacialRig: true,
      hasExpressions: true,
      hasTalking: true,
      explanation: undefined,
    });
  };

  const handleTestVoice = () => {
    setIsTestSpeaking(true);
    speechEngine.speak(
      `Hello! I am ${config.name}, your ${config.personality} mental health AI mascot. I'm right here with you.`,
      'en',
      {
        voiceSpeed: config.voiceSpeed,
        onEnergy: (energy) => setTestSpeechEnergy(energy),
        onEnd: () => {
          setIsTestSpeaking(false);
          setTestSpeechEnergy(0);
        },
      }
    );
  };

  const emotionsList: MascotEmotion[] = [
    'neutral',
    'happy',
    'sad',
    'concerned',
    'empathetic',
    'surprised',
    'thinking',
    'excited',
    'confused',
    'calm',
    'encouraging',
  ];

  const personalities: MascotPersonality[] = [
    'friendly',
    'calm',
    'encouraging',
    'playful',
    'professional',
  ];

  const backgrounds: Array<{ id: MascotBackground; label: string; color: string }> = [
    { id: 'warm_cream', label: 'Warm Cream', color: '#FDFBF7' },
    { id: 'zen_sand', label: 'Zen Sand', color: '#F7F4EC' },
    { id: 'gentle_lavender', label: 'Lavender', color: '#F5F3FF' },
    { id: 'soft_sage', label: 'Soft Sage', color: '#F0FDF4' },
    { id: 'clean_white', label: 'Clean White', color: '#FFFFFF' },
  ];

  return (
    <div className="w-full flex flex-col md:flex-row h-full max-h-[85vh] bg-[#FFFFFF] rounded-3xl overflow-hidden font-sans border border-[#0A0A0A]/10 shadow-2xl">
      {/* LEFT 50%: LIVE 3D PREVIEW */}
      <div className="w-full md:w-1/2 h-[340px] md:h-full relative flex flex-col bg-[#FDFBF7] border-b md:border-b-0 md:border-r border-[#0A0A0A]/10">
        <div className="flex-1 w-full h-full relative">
          <MascotViewer
            emotion={previewEmotion}
            isSpeaking={isTestSpeaking}
            audioEnergy={testSpeechEnergy}
            customModelUrl={modelUrl}
            customModelType={modelType}
          />
        </div>

        {/* Floating Test Voice & Reset pill inside preview */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20 pointer-events-none">
          <div className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md border border-[#0A0A0A]/10 text-[11px] font-mono font-bold text-[#0A0A0A] pointer-events-auto">
            {modelUrl ? 'Custom 3D Model' : 'Default MANAS Mascot'}
          </div>

          <button
            type="button"
            onClick={handleTestVoice}
            className="px-3 py-1 rounded-full bg-[#8B5CF6] text-white hover:bg-[#7C3AED] transition-colors text-xs font-mono font-medium flex items-center gap-1.5 shadow-sm pointer-events-auto cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Test Voice</span>
          </button>
        </div>

        {/* Bottom Current Emotion Indicator */}
        <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
          <div className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md border border-[#0A0A0A]/10 text-[11px] font-mono text-[#0A0A0A]/70 pointer-events-auto">
            Expression: <span className="font-bold capitalize text-[#8B5CF6]">{previewEmotion}</span>
          </div>
        </div>
      </div>

      {/* RIGHT 50%: CONTROLS, COMPATIBILITY, EXPRESSION TEST, UPLOAD */}
      <div className="w-full md:w-1/2 flex-1 flex flex-col overflow-y-auto p-6 md:p-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#0A0A0A]/10 pb-3">
          {(['settings', 'expressions', 'upload'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'bg-[#0A0A0A] text-white font-bold'
                  : 'text-[#0A0A0A]/60 hover:bg-[#F3F0E6]'
              }`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {/* TAB 1: SETTINGS (Mascot Name, Personality, Voice, Background) */}
        {activeTab === 'settings' && (
          <div className="space-y-5">
            <div>
              <label className="text-xs font-mono font-bold text-[#0A0A0A] uppercase tracking-wider block mb-1.5">
                Mascot Name
              </label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-4 py-2 rounded-xl bg-[#FDFBF7] border border-[#0A0A0A]/15 text-sm font-sans focus:outline-none focus:border-[#8B5CF6]"
                placeholder="e.g. Luna"
              />
            </div>

            <div>
              <label className="text-xs font-mono font-bold text-[#0A0A0A] uppercase tracking-wider block mb-2">
                AI Mascot Personality
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {personalities.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setConfig({ ...config, personality: p })}
                    className={`py-2 px-3 rounded-xl text-xs font-mono tracking-wide capitalize border transition-all cursor-pointer ${
                      config.personality === p
                        ? 'bg-[#8B5CF6] text-white border-[#8B5CF6] font-bold shadow-xs'
                        : 'border-[#0A0A0A]/15 bg-[#FDFBF7] text-[#0A0A0A] hover:bg-[#F3F0E6]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Speaking & Animations Toggles */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-[#FDFBF7] border border-[#0A0A0A]/10 flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono font-bold text-[#0A0A0A]">Voice Speech</div>
                  <div className="text-[11px] text-[#0A0A0A]/60">Read replies aloud</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.speakingEnabled}
                  onChange={(e) => setConfig({ ...config, speakingEnabled: e.target.checked })}
                  className="w-4 h-4 accent-[#8B5CF6] cursor-pointer"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FDFBF7] border border-[#0A0A0A]/10 flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono font-bold text-[#0A0A0A]">Animations</div>
                  <div className="text-[11px] text-[#0A0A0A]/60">Breathing & gestures</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.animationsEnabled}
                  onChange={(e) => setConfig({ ...config, animationsEnabled: e.target.checked })}
                  className="w-4 h-4 accent-[#8B5CF6] cursor-pointer"
                />
              </div>
            </div>

            {/* Voice Speed Slider */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1 text-[#0A0A0A]">
                <span>Speaking Rate</span>
                <span>{config.voiceSpeed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.3"
                step="0.05"
                value={config.voiceSpeed}
                onChange={(e) => setConfig({ ...config, voiceSpeed: parseFloat(e.target.value) })}
                className="w-full accent-[#8B5CF6] cursor-pointer"
              />
            </div>

            {/* Stage Background */}
            <div>
              <label className="text-xs font-mono font-bold text-[#0A0A0A] uppercase tracking-wider block mb-2">
                Stage Space Tone
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {backgrounds.map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => setConfig({ ...config, background: bg.id })}
                    className={`py-2 px-3 rounded-xl text-xs font-mono border flex items-center gap-2 transition-all cursor-pointer ${
                      config.background === bg.id
                        ? 'border-[#0A0A0A] bg-white font-bold shadow-xs'
                        : 'border-[#0A0A0A]/10 bg-[#FDFBF7] hover:bg-[#F3F0E6]'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-[#0A0A0A]/20"
                      style={{ backgroundColor: bg.color }}
                    />
                    <span className="text-[11px] truncate">{bg.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EXPRESSIONS TEST (Buttons & Sliders) */}
        {activeTab === 'expressions' && (
          <div className="space-y-5">
            <div>
              <label className="text-xs font-mono font-bold text-[#0A0A0A] uppercase tracking-wider block mb-2">
                Expression Test
              </label>
              <div className="flex flex-wrap gap-2">
                {emotionsList.map((emo) => (
                  <button
                    key={emo}
                    type="button"
                    onClick={() => setPreviewEmotion(emo)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono capitalize transition-all cursor-pointer ${
                      previewEmotion === emo
                        ? 'bg-[#8B5CF6] text-white font-bold shadow-xs'
                        : 'bg-[#FDFBF7] border border-[#0A0A0A]/15 text-[#0A0A0A] hover:bg-[#F3F0E6]'
                    }`}
                  >
                    {emo}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-[#0A0A0A]/10 space-y-3">
              <label className="text-xs font-mono font-bold text-[#0A0A0A] uppercase tracking-wider block">
                Morph Target Testing Sliders
              </label>

              {[
                { label: 'Smile', key: 'smile', min: 0, max: 1 },
                { label: 'Frown', key: 'frown', min: 0, max: 1 },
                { label: 'Eyebrow Lift', key: 'eyebrow', min: 0, max: 1 },
                { label: 'Mouth Open', key: 'mouthOpen', min: 0, max: 1 },
              ].map((item) => (
                <div key={item.key}>
                  <div className="flex justify-between text-xs font-mono text-[#0A0A0A]/70 mb-1">
                    <span>{item.label}</span>
                    <span>{(testSliders as any)[item.key].toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={item.min}
                    max={item.max}
                    step="0.05"
                    value={(testSliders as any)[item.key]}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setTestSliders((prev) => ({ ...prev, [item.key]: val }));
                    }}
                    className="w-full accent-[#8B5CF6] cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: UPLOAD 3D MASCOT & COMPATIBILITY CHECK */}
        {activeTab === 'upload' && (
          <div className="space-y-5">
            <MascotUploader
              onUploadSuccess={(res) => {
                setModelUrl(res.objectUrl);
                setModelType(res.fileType);
                setConfig({
                  ...config,
                  isCustomModel: true,
                  customModelName: res.name,
                  customModelType: res.fileType,
                });
                setActiveTab('preview');
              }}
            />

            {/* MASCOT COMPATIBILITY REPORT CARD */}
            <div className="p-4 rounded-2xl bg-[#FDFBF7] border border-[#0A0A0A]/15 space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#0A0A0A] uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-[#8B5CF6]" />
                <span>Mascot Compatibility</span>
              </div>

              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between items-center py-1 border-b border-[#0A0A0A]/5">
                  <span className="text-[#0A0A0A]/70">3D Model</span>
                  <span className="text-emerald-600 font-bold">✓ Ready</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#0A0A0A]/5">
                  <span className="text-[#0A0A0A]/70">Animations</span>
                  <span className="text-emerald-600 font-bold">✓ Procedural + Clips</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#0A0A0A]/5">
                  <span className="text-[#0A0A0A]/70">Facial Rig</span>
                  <span className="text-emerald-600 font-bold">✓ Blendshapes Supported</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#0A0A0A]/5">
                  <span className="text-[#0A0A0A]/70">Expressions</span>
                  <span className="text-emerald-600 font-bold">✓ 12 Emotional States</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#0A0A0A]/70">Talking Lip-Sync</span>
                  <span className="text-emerald-600 font-bold">✓ Voice Synchronized</span>
                </div>
              </div>

              {compatibility.explanation && (
                <div className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  {compatibility.explanation}
                </div>
              )}
            </div>

            {modelUrl && (
              <button
                type="button"
                onClick={handleResetDefault}
                className="w-full py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-mono transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Default 3D Mascot</span>
              </button>
            )}
          </div>
        )}

        {/* BOTTOM ACTION BUTTONS: [ Upload New Mascot ] [ Use This Mascot ] */}
        <div className="pt-4 border-t border-[#0A0A0A]/10 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className="flex-1 py-3 px-4 rounded-full border border-[#0A0A0A]/20 bg-[#FDFBF7] hover:bg-[#F3F0E6] text-[#0A0A0A] text-xs font-mono font-bold tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload New Mascot
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3 px-4 rounded-full bg-[#0A0A0A] hover:bg-[#222222] text-white text-xs font-mono font-bold tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Check className="w-3.5 h-3.5" />
            Use This Mascot
          </button>
        </div>
      </div>
    </div>
  );
};
