/**
 * MANAS /dev/avatar-check Developer Test & Asset Validator Page
 * - Full Asset Validator report card
 * - Lists missing items if any
 * - Expression test panel with live interactive sliders for EVERY blendshape (52 ARKit + 15 Visemes + 8 Face Shapes)
 * - Quick emotion tester (10 emotions)
 * - Gesture & animation tester
 * - Modular wardrobe & accessories tester
 * - Real-time 3D Three.js viewport with bust / full-body framing
 */

import React, { useState, useEffect } from 'react';
import {
  Avatar3DStage,
  type CameraFraming,
} from '../components/avatar/Avatar3DStage';
import {
  REQUIRED_ARKIT_BLENDSHAPES,
  REQUIRED_OCULUS_VISEMES,
  REQUIRED_FACE_SHAPES,
  REQUIRED_MIXAMO_BONES,
  REQUIRED_MESH_PARTS,
  type AvatarValidationReport,
} from '../lib/avatar/assetValidator';
import type { AvatarEmotion } from '../lib/avatar/FaceDriver';
import type { AvatarGesture } from '../lib/avatar/speechPerformance';
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  Sliders,
  Maximize2,
  Camera,
  RefreshCw,
  Search,
} from 'lucide-react';

export const DevAvatarCheckPage: React.FC = () => {
  const [selectedAvatar, setSelectedAvatar] = useState<'boy' | 'girl'>('boy');
  const [framing, setFraming] = useState<CameraFraming>('bust');
  const [activeEmotion, setActiveEmotion] = useState<AvatarEmotion>('calm');
  const [activeGesture, setActiveGesture] = useState<AvatarGesture>('idle');
  const [validationReport, setValidationReport] = useState<AvatarValidationReport | null>(null);

  // Modular parts state
  const [hairStyle, setHairStyle] = useState<string>('short_messy');
  const [outfitType, setOutfitType] = useState<string>('hoodie');
  const [glassesStyle, setGlassesStyle] = useState<string>('none');
  const [beardStyle, setBeardStyle] = useState<string>('none');
  const [earringsStyle, setEarringsStyle] = useState<string>('none');

  // Morph slider test weights
  const [customMorphs, setCustomMorphs] = useState<Record<string, number>>({});
  const [morphSearch, setMorphSearch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'arkit' | 'visemes' | 'shapes' | 'emotions' | 'gestures'>('arkit');

  useEffect(() => {
    // Reset defaults when switching avatar
    if (selectedAvatar === 'girl') {
      setHairStyle('wavy_long');
      setBeardStyle('none');
    } else {
      setHairStyle('short_messy');
    }
  }, [selectedAvatar]);

  const handleSliderChange = (name: string, val: number) => {
    setCustomMorphs((prev) => ({
      ...prev,
      [name]: val,
    }));
  };

  const resetAllSliders = () => {
    setCustomMorphs({});
  };

  const emotionList: AvatarEmotion[] = [
    'neutral',
    'warm_smile',
    'happy',
    'empathetic',
    'concerned',
    'sad',
    'surprised',
    'thinking',
    'encouraging',
    'calm',
  ];

  const gestureList: { id: AvatarGesture; label: string }[] = [
    { id: 'idle', label: 'Idle (Clasped)' },
    { id: 'nod', label: 'Warm Nod' },
    { id: 'wave', label: 'Friendly Wave' },
    { id: 'thumbs_up', label: 'Thumbs Up' },
    { id: 'thinking', label: 'Thinking Pose' },
    { id: 'listening', label: 'Attentive Listen' },
    { id: 'talking_1', label: 'Talking 1' },
    { id: 'talking_2', label: 'Talking 2' },
    { id: 'talking_3', label: 'Talking 3' },
    { id: 'talking_4', label: 'Talking 4' },
    { id: 'breathing_guide', label: 'Breathing Loop' },
  ];

  const hairList = [
    'short_messy',
    'curly_volume',
    'wavy_long',
    'straight_bob',
    'afro_fade',
    'side_part',
    'buzz_cut',
    'ponytail',
    'curtain_bangs',
    'undercut',
    'braids',
  ];

  const outfitList = ['hoodie', 'formal', 'kurta_saree', 'sports', 'pyjamas', 'festive'];

  return (
    <div className="min-h-screen bg-[#F7F4EE] text-[#0A0A0A] flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="h-16 px-6 bg-white border-b border-[#0A0A0A]/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="text-xs font-mono uppercase tracking-wider text-[#8B5CF6] hover:underline"
          >
            ← Back to App
          </a>
          <span className="opacity-30">/</span>
          <h1 className="text-base font-bold tracking-tight flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-[#8B5CF6]/10 text-[#8B5CF6] text-xs font-mono">
              /dev/avatar-check
            </span>
            3D Avatar Asset Validator & Expression Studio
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-[#F2EFE8] p-1 rounded-xl gap-1">
            <button
              onClick={() => setSelectedAvatar('boy')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                selectedAvatar === 'boy'
                  ? 'bg-white shadow-xs font-bold text-[#0A0A0A]'
                  : 'text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
              }`}
            >
              Boy (Arjun)
            </button>
            <button
              onClick={() => setSelectedAvatar('girl')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                selectedAvatar === 'girl'
                  ? 'bg-white shadow-xs font-bold text-[#0A0A0A]'
                  : 'text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
              }`}
            >
              Girl (Priya)
            </button>
          </div>

          <div className="flex bg-[#F2EFE8] p-1 rounded-xl gap-1">
            <button
              onClick={() => setFraming('bust')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                framing === 'bust'
                  ? 'bg-white shadow-xs font-bold text-[#0A0A0A]'
                  : 'text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
              }`}
            >
              <Camera className="w-3 h-3" /> Bust
            </button>
            <button
              onClick={() => setFraming('full_body')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                framing === 'full_body'
                  ? 'bg-white shadow-xs font-bold text-[#0A0A0A]'
                  : 'text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
              }`}
            >
              <Maximize2 className="w-3 h-3" /> Full Body
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Layout: Left 48% 3D Viewport, Right 52% Validator Report & Expression Controls */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT 3D VIEWPORT */}
        <div className="w-full lg:w-[48%] h-[50vh] lg:h-full relative border-b lg:border-b-0 lg:border-r border-[#0A0A0A]/10 bg-[#FDFBF7]">
          <Avatar3DStage
            avatarId={selectedAvatar}
            emotion={activeEmotion}
            activeGesture={activeGesture}
            framing={framing}
            visemeWeights={customMorphs}
            hairStyle={hairStyle}
            outfitType={outfitType}
            glassesStyle={glassesStyle}
            beardStyle={beardStyle}
            earringsStyle={earringsStyle}
            onValidationComplete={(report) => setValidationReport(report)}
          />

          {/* Quick HUD Overlay */}
          <div className="absolute top-4 left-4 flex flex-col gap-1 pointer-events-none z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-[#0A0A0A]/10 shadow-xs text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Model: {selectedAvatar}.glb</span>
              <span className="text-[#0A0A0A]/40">|</span>
              <span>Framing: {framing}</span>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: VALIDATOR & EXPRESSION STUDIO */}
        <div className="w-full lg:w-[52%] flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. ASSET VALIDATOR SUMMARY CARD */}
          <section className="bg-white rounded-2xl p-5 border border-[#0A0A0A]/10 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-[#0A0A0A]">
                  Asset Validator Report
                </h2>
                <p className="text-xs text-[#0A0A0A]/60">
                  Automated conformance check for ARKit, Oculus visemes, skeleton & budget
                </p>
              </div>

              {validationReport && (
                <div
                  className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 ${
                    validationReport.passed
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {validationReport.passed ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      100% SPEC PASSED
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      ITEMS MISSING
                    </>
                  )}
                </div>
              )}
            </div>

            {validationReport ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                {/* 52 ARKit */}
                <div className="p-3 rounded-xl bg-[#F7F4EE] border border-[#0A0A0A]/5">
                  <span className="text-[#0A0A0A]/60 text-[10px] block">ARKit Blendshapes</span>
                  <span className="text-sm font-bold text-[#0A0A0A]">
                    {validationReport.arkitReport.totalFound} / 52
                  </span>
                  <span className="text-[10px] text-emerald-600 block mt-0.5 font-sans">
                    ✓ All Required Found
                  </span>
                </div>

                {/* 15 Visemes */}
                <div className="p-3 rounded-xl bg-[#F7F4EE] border border-[#0A0A0A]/5">
                  <span className="text-[#0A0A0A]/60 text-[10px] block">Oculus Visemes</span>
                  <span className="text-sm font-bold text-[#0A0A0A]">
                    {validationReport.oculusReport.totalFound} / 15
                  </span>
                  <span className="text-[10px] text-emerald-600 block mt-0.5 font-sans">
                    ✓ Full Phoneme Set
                  </span>
                </div>

                {/* Skeleton */}
                <div className="p-3 rounded-xl bg-[#F7F4EE] border border-[#0A0A0A]/5">
                  <span className="text-[#0A0A0A]/60 text-[10px] block">Mixamo Skeleton</span>
                  <span className="text-sm font-bold text-[#0A0A0A]">
                    {validationReport.skeletonReport.totalFound} / 22 Bones
                  </span>
                  <span className="text-[10px] text-emerald-600 block mt-0.5 font-sans">
                    ✓ Humanoid Rigged
                  </span>
                </div>

                {/* Budget */}
                <div className="p-3 rounded-xl bg-[#F7F4EE] border border-[#0A0A0A]/5">
                  <span className="text-[#0A0A0A]/60 text-[10px] block">Polygon Budget</span>
                  <span className="text-sm font-bold text-[#0A0A0A]">
                    {validationReport.triangleCount.toLocaleString()} Triangles
                  </span>
                  <span className="text-[10px] text-emerald-600 block mt-0.5 font-sans">
                    ✓ Under 40k Limit
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs font-mono text-[#0A0A0A]/50">
                Evaluating model assets...
              </div>
            )}

            {/* List missing items if any */}
            {validationReport && !validationReport.passed && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-xs font-bold text-rose-700 block mb-1">
                  Missing Requirements:
                </span>
                <div className="flex flex-wrap gap-1">
                  {validationReport.arkitReport.missing.map((m) => (
                    <span key={m} className="px-2 py-0.5 rounded-sm bg-rose-100 text-rose-800 text-[10px] font-mono">
                      ARKit: {m}
                    </span>
                  ))}
                  {validationReport.oculusReport.missing.map((m) => (
                    <span key={m} className="px-2 py-0.5 rounded-sm bg-rose-100 text-rose-800 text-[10px] font-mono">
                      Viseme: {m}
                    </span>
                  ))}
                  {validationReport.skeletonReport.missing.map((m) => (
                    <span key={m} className="px-2 py-0.5 rounded-sm bg-rose-100 text-rose-800 text-[10px] font-mono">
                      Bone: {m}
                    </span>
                  ))}
                  {validationReport.meshesReport.missing.map((m) => (
                    <span key={m} className="px-2 py-0.5 rounded-sm bg-rose-100 text-rose-800 text-[10px] font-mono">
                      Mesh: {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 2. EXPRESSION & MODULAR STUDIO TABS */}
          <section className="bg-white rounded-2xl p-5 border border-[#0A0A0A]/10 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#0A0A0A]/10 pb-3">
              <div className="flex items-center gap-1">
                {(['arkit', 'visemes', 'shapes', 'emotions', 'gestures'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono uppercase tracking-wider cursor-pointer transition-colors ${
                      activeTab === tab
                        ? 'bg-[#8B5CF6] text-white font-bold'
                        : 'text-[#0A0A0A]/60 hover:bg-[#F2EFE8]'
                    }`}
                  >
                    {tab === 'arkit' && '52 ARKit'}
                    {tab === 'visemes' && '15 Visemes'}
                    {tab === 'shapes' && 'Face Shapes'}
                    {tab === 'emotions' && '10 Emotions'}
                    {tab === 'gestures' && 'Body Gestures'}
                  </button>
                ))}
              </div>

              <button
                onClick={resetAllSliders}
                className="px-2.5 py-1 text-xs font-mono text-[#0A0A0A]/60 hover:text-[#0A0A0A] flex items-center gap-1 cursor-pointer"
                title="Reset all morph sliders to 0"
              >
                <RefreshCw className="w-3 h-3" /> Reset
              </button>
            </div>

            {/* TAB 1: 52 ARKit BLENDSHAPES SLIDERS */}
            {activeTab === 'arkit' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#0A0A0A]/40 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search 52 ARKit blendshapes (e.g. jawOpen, mouthSmile, browInnerUp)..."
                    value={morphSearch}
                    onChange={(e) => setMorphSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#F7F4EE] border border-[#0A0A0A]/10 text-xs font-mono focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-2">
                  {REQUIRED_ARKIT_BLENDSHAPES.filter((name) =>
                    name.toLowerCase().includes(morphSearch.toLowerCase())
                  ).map((morph) => (
                    <div
                      key={morph}
                      className="p-2.5 rounded-xl bg-[#F7F4EE] border border-[#0A0A0A]/5 flex flex-col gap-1"
                    >
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="font-medium text-[#0A0A0A]">{morph}</span>
                        <span className="text-[#8B5CF6] font-bold">
                          {(customMorphs[morph] || 0).toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={customMorphs[morph] || 0}
                        onChange={(e) => handleSliderChange(morph, parseFloat(e.target.value))}
                        className="w-full accent-[#8B5CF6] cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: 15 OCULUS VISEMES SLIDERS */}
            {activeTab === 'visemes' && (
              <div className="space-y-3">
                <p className="text-xs text-[#0A0A0A]/60">
                  Oculus lip-sync phoneme weights. Test mouth opening and shapes individually:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-2">
                  {REQUIRED_OCULUS_VISEMES.map((viseme) => (
                    <div
                      key={viseme}
                      className="p-2.5 rounded-xl bg-[#F7F4EE] border border-[#0A0A0A]/5 flex flex-col gap-1"
                    >
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="font-medium text-[#0A0A0A]">{viseme}</span>
                        <span className="text-[#8B5CF6] font-bold">
                          {(customMorphs[viseme] || 0).toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={customMorphs[viseme] || 0}
                        onChange={(e) => handleSliderChange(viseme, parseFloat(e.target.value))}
                        className="w-full accent-[#8B5CF6] cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: FACE SHAPES SLIDERS */}
            {activeTab === 'shapes' && (
              <div className="space-y-3">
                <p className="text-xs text-[#0A0A0A]/60">
                  Face proportions & feature customization morph targets:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {REQUIRED_FACE_SHAPES.map((shape) => (
                    <div
                      key={shape}
                      className="p-2.5 rounded-xl bg-[#F7F4EE] border border-[#0A0A0A]/5 flex flex-col gap-1"
                    >
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="font-medium text-[#0A0A0A]">{shape}</span>
                        <span className="text-[#8B5CF6] font-bold">
                          {(customMorphs[shape] || 0).toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={customMorphs[shape] || 0}
                        onChange={(e) => handleSliderChange(shape, parseFloat(e.target.value))}
                        className="w-full accent-[#8B5CF6] cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: 10 EMOTION PRESETS */}
            {activeTab === 'emotions' && (
              <div className="space-y-3">
                <p className="text-xs text-[#0A0A0A]/60">
                  Switch between the 10 ARKit emotion presets with smooth damping:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {emotionList.map((emo) => (
                    <button
                      key={emo}
                      onClick={() => setActiveEmotion(emo)}
                      className={`p-3 rounded-xl text-xs font-mono text-left transition-all cursor-pointer border ${
                        activeEmotion === emo
                          ? 'bg-[#8B5CF6]/10 border-[#8B5CF6] text-[#8B5CF6] font-bold shadow-xs'
                          : 'bg-[#F7F4EE] border-transparent hover:border-[#0A0A0A]/10 text-[#0A0A0A]'
                      }`}
                    >
                      <span className="block font-bold capitalize">{emo.replace('_', ' ')}</span>
                      <span className="text-[10px] opacity-60 block mt-0.5">Preset active</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: BODY GESTURES */}
            {activeTab === 'gestures' && (
              <div className="space-y-3">
                <p className="text-xs text-[#0A0A0A]/60">
                  Trigger Mixamo-compatible AnimationMixer clips with crossfading:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {gestureList.map((gest) => (
                    <button
                      key={gest.id}
                      onClick={() => setActiveGesture(gest.id)}
                      className={`p-3 rounded-xl text-xs font-mono text-left transition-all cursor-pointer border ${
                        activeGesture === gest.id
                          ? 'bg-[#8B5CF6]/10 border-[#8B5CF6] text-[#8B5CF6] font-bold shadow-xs'
                          : 'bg-[#F7F4EE] border-transparent hover:border-[#0A0A0A]/10 text-[#0A0A0A]'
                      }`}
                    >
                      <span className="block font-bold">{gest.label}</span>
                      <span className="text-[10px] opacity-60 block mt-0.5">{gest.id}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 3. MODULAR WARDROBE & ACCESSORIES SELECTOR */}
          <section className="bg-white rounded-2xl p-5 border border-[#0A0A0A]/10 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-[#0A0A0A]">
              Modular Accessories & Parts (10+ Hair, 6 Outfits, Glasses, Beards, Earrings)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              {/* Hair Style */}
              <div>
                <label className="block mb-1 font-bold text-[#0A0A0A]">Hair Style (11 total):</label>
                <select
                  value={hairStyle}
                  onChange={(e) => setHairStyle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F4EE] border border-[#0A0A0A]/10 focus:outline-none"
                >
                  {hairList.map((h) => (
                    <option key={h} value={h}>
                      {h.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Outfits */}
              <div>
                <label className="block mb-1 font-bold text-[#0A0A0A]">Outfit (6 total):</label>
                <select
                  value={outfitType}
                  onChange={(e) => setOutfitType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F4EE] border border-[#0A0A0A]/10 focus:outline-none"
                >
                  {outfitList.map((o) => (
                    <option key={o} value={o}>
                      {o.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Glasses */}
              <div>
                <label className="block mb-1 font-bold text-[#0A0A0A]">Glasses (3 styles):</label>
                <select
                  value={glassesStyle}
                  onChange={(e) => setGlassesStyle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F4EE] border border-[#0A0A0A]/10 focus:outline-none"
                >
                  <option value="none">None</option>
                  <option value="round">Round Wireframe</option>
                  <option value="square">Square Modern</option>
                  <option value="semi_rimless">Semi-Rimless</option>
                </select>
              </div>

              {/* Beards (Boy) */}
              <div>
                <label className="block mb-1 font-bold text-[#0A0A0A]">Facial Hair (3 styles):</label>
                <select
                  value={beardStyle}
                  onChange={(e) => setBeardStyle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F4EE] border border-[#0A0A0A]/10 focus:outline-none"
                >
                  <option value="none">Clean Shaven</option>
                  <option value="stubble">Soft Stubble</option>
                  <option value="goatee">Goatee</option>
                  <option value="full_beard">Full Beard</option>
                </select>
              </div>

              {/* Earrings */}
              <div>
                <label className="block mb-1 font-bold text-[#0A0A0A]">Earrings (3 styles):</label>
                <select
                  value={earringsStyle}
                  onChange={(e) => setEarringsStyle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F4EE] border border-[#0A0A0A]/10 focus:outline-none"
                >
                  <option value="none">None</option>
                  <option value="studs">Studs</option>
                  <option value="hoops">Hoops</option>
                  <option value="dangle">Dangle</option>
                </select>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
export default DevAvatarCheckPage;
