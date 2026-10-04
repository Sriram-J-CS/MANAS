import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { FX_ENABLED, HERO_FX_ENABLED, AUTO_MATERIAL } from '../config/uiEffects';

interface InkCanvasProps {
  brand: string;
}

interface MaterialDef {
  id: string;
  matcap: string;
  photo: string;
}

const MATERIAL_DEFS: MaterialDef[] = [
  { id: 'purple_foil', matcap: '/fx/purple_foil.webp', photo: '/assets/textures/foil_violet.jpg' },
  { id: 'magenta_foil', matcap: '/fx/magenta_rubber.webp', photo: '/assets/textures/foil_pink.jpg' },
  { id: 'white_cushion', matcap: '/fx/white_fabric.webp', photo: '/assets/textures/puffed_cushion.jpg' },
  { id: 'soap_foam', matcap: '/fx/pearl_foam.webp', photo: '/assets/textures/soap_foam.jpg' },
  { id: 'chrome', matcap: '/fx/chrome.webp', photo: '/assets/textures/foil_violet.jpg' },
  { id: 'pastel_pink', matcap: '/fx/pastel_pink.webp', photo: '/assets/textures/foil_pink.jpg' },
  { id: 'black_latex', matcap: '/fx/black_latex.webp', photo: '/assets/textures/puffed_cushion.jpg' },
  { id: 'glass', matcap: '/fx/glass.webp', photo: '/assets/textures/soap_foam.jpg' },
];

export const InkCanvas: React.FC<InkCanvasProps> = ({ brand }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check motion preference and WebGL availability
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isFxEnabled = FX_ENABLED && HERO_FX_ENABLED && !prefersReducedMotion;

    // 2D Fallback if reduced motion or FX disabled
    if (!isFxEnabled) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const render2DFallback = () => {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
        ctx.scale(dpr, dpr);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        let fs = Math.min(W * 0.20, H * 0.32);
        ctx.fillStyle = '#000000';
        ctx.font = `900 ${fs}px 'Inter Tight', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const brandText = brand.toUpperCase();
        const measured = ctx.measureText(brandText).width;
        if (measured > W * 0.85) {
          fs *= (W * 0.85) / measured;
          ctx.font = `900 ${fs}px 'Inter Tight', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        }

        ctx.fillText(brandText, W / 2, H * 0.50);
      };

      render2DFallback();
      window.addEventListener('resize', render2DFallback);
      return () => window.removeEventListener('resize', render2DFallback);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // WebGL Pipeline (Three.js with Half-Float Ping-Pong & Matcaps + Photo Textures)
    // ─────────────────────────────────────────────────────────────────────────
    let W = window.innerWidth;
    let H = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: false,
        antialias: false,
        powerPreference: 'high-performance',
      });
    } catch (_) {
      return;
    }

    renderer.setSize(W, H);
    renderer.setPixelRatio(dpr);

    const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeom = new THREE.PlaneGeometry(2, 2);

    // Preload textures
    const textureLoader = new THREE.TextureLoader();
    const matcapTextures: THREE.Texture[] = MATERIAL_DEFS.map((def) => {
      const tex = textureLoader.load(def.matcap);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      return tex;
    });

    const photoTextures: THREE.Texture[] = MATERIAL_DEFS.map((def) => {
      const tex = textureLoader.load(def.photo);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.generateMipmaps = false;
      return tex;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Offscreen Text & Pillow Dome Heightmap Generation (Multi-Pass GPU Blur)
    // ─────────────────────────────────────────────────────────────────────────
    const textCanvas = document.createElement('canvas');
    const textCtx = textCanvas.getContext('2d');
    let textTexture: THREE.CanvasTexture | null = null;

    let rtTextBlurH: THREE.WebGLRenderTarget;
    let rtTextHeightmap: THREE.WebGLRenderTarget;

    const createHeightmapTargets = () => {
      rtTextBlurH?.dispose();
      rtTextHeightmap?.dispose();

      const w = Math.floor(W * dpr);
      const h = Math.floor(H * dpr);
      const opts: THREE.RenderTargetOptions = {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
      };

      rtTextBlurH = new THREE.WebGLRenderTarget(w, h, opts);
      rtTextHeightmap = new THREE.WebGLRenderTarget(w, h, opts);
    };

    createHeightmapTargets();

    // Strong separable Gaussian blur with square-root pillow profile
    const blurHMat = new THREE.ShaderMaterial({
      uniforms: {
        tInput: { value: null },
        uResolution: { value: new THREE.Vector2(W * dpr, H * dpr) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tInput;
        uniform vec2 uResolution;
        varying vec2 vUv;
        void main() {
          vec2 texel = 1.0 / uResolution;
          float sum = 0.0;
          float weights[11] = float[](0.03, 0.06, 0.09, 0.12, 0.15, 0.18, 0.15, 0.12, 0.09, 0.06, 0.03);
          for (int i = -5; i <= 5; i++) {
            sum += texture2D(tInput, vUv + vec2(float(i) * 6.0 * texel.x, 0.0)).r * weights[i + 5];
          }
          gl_FragColor = vec4(vec3(sum), 1.0);
        }
      `,
    });

    const blurVMat = new THREE.ShaderMaterial({
      uniforms: {
        tInput: { value: null },
        uResolution: { value: new THREE.Vector2(W * dpr, H * dpr) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tInput;
        uniform vec2 uResolution;
        varying vec2 vUv;
        void main() {
          vec2 texel = 1.0 / uResolution;
          float sum = 0.0;
          float weights[11] = float[](0.03, 0.06, 0.09, 0.12, 0.15, 0.18, 0.15, 0.12, 0.09, 0.06, 0.03);
          for (int i = -5; i <= 5; i++) {
            sum += texture2D(tInput, vUv + vec2(0.0, float(i) * 6.0 * texel.y)).r * weights[i + 5];
          }
          // Square-root pillow profile: h = sqrt(clamp(d / R, 0, 1))
          float pillow = sqrt(clamp(sum * 1.20, 0.0, 1.0));
          gl_FragColor = vec4(vec3(pillow), 1.0);
        }
      `,
    });

    const blurQuad = new THREE.Mesh(quadGeom, blurHMat);
    const blurScene = new THREE.Scene();
    blurScene.add(blurQuad);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Controlled Liquid Paint Simulation (Organic Brush Bristles & Flow)
    // ─────────────────────────────────────────────────────────────────────────
    let fW = Math.floor(W / 2);
    let fH = Math.floor(H / 2);

    let rtPing: THREE.WebGLRenderTarget;
    let rtPong: THREE.WebGLRenderTarget;

    const createPingPongTargets = () => {
      rtPing?.dispose();
      rtPong?.dispose();

      fW = Math.floor(W / 2);
      fH = Math.floor(H / 2);

      const opts: THREE.RenderTargetOptions = {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
      };

      rtPing = new THREE.WebGLRenderTarget(fW, fH, opts);
      rtPong = new THREE.WebGLRenderTarget(fW, fH, opts);

      renderer.setRenderTarget(rtPing);
      renderer.clearColor();
      renderer.setRenderTarget(rtPong);
      renderer.clearColor();
      renderer.setRenderTarget(null);
    };

    createPingPongTargets();

    const pingPongMat = new THREE.ShaderMaterial({
      uniforms: {
        tPrev: { value: null },
        uMouse: { value: new THREE.Vector2(-999, -999) },
        uPrevMouse: { value: new THREE.Vector2(-999, -999) },
        uRadius: { value: 0.05 },
        uDecay: { value: 0.972 },
        uIsMoving: { value: 0.0 },
        uResolution: { value: new THREE.Vector2(fW, fH) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tPrev;
        uniform vec2 uMouse;
        uniform vec2 uPrevMouse;
        uniform float uRadius;
        uniform float uDecay;
        uniform float uIsMoving;
        uniform vec2 uResolution;
        varying vec2 vUv;

        float distToSegment(vec2 p, vec2 a, vec2 b, vec2 aspect) {
            vec2 pa = (p - a) * aspect;
            vec2 ba = (b - a) * aspect;
            float lenSq = dot(ba, ba);
            if (lenSq < 0.000001) return length(pa);
            float h = clamp(dot(pa, ba) / lenSq, 0.0, 1.0);
            return length(pa - ba * h);
        }

        void main() {
            vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
            vec2 texel = 1.0 / uResolution;

            // 4-tap diffusion blur for wet paint surface tension
            float prev = texture2D(tPrev, vUv).r;
            float blurred = (
                texture2D(tPrev, vUv + vec2(-texel.x, 0.0)).r +
                texture2D(tPrev, vUv + vec2(texel.x, 0.0)).r +
                texture2D(tPrev, vUv + vec2(0.0, -texel.y)).r +
                texture2D(tPrev, vUv + vec2(0.0, texel.y)).r
            ) * 0.25;

            // Viscous paint decay
            float density = mix(prev, blurred, 0.15) * uDecay;

            // Stamp organic paint brush stroke along motion vector
            if (uIsMoving > 0.5) {
                vec2 dir = (uMouse - uPrevMouse) * aspect;
                float strokeSpeed = length(dir);
                vec2 perp = strokeSpeed > 0.0001 ? normalize(vec2(-dir.y, dir.x)) : vec2(0.0, 1.0);
                
                // Subtle organic brush bristle variation along stroke edges
                float bristle = sin(dot(vUv * aspect, perp) * 75.0) * 0.035 * min(1.0, strokeSpeed * 30.0);
                
                float d = distToSegment(vUv, uPrevMouse, uMouse, aspect);
                float stamp = smoothstep(uRadius * (1.0 + bristle), uRadius * 0.22, d);
                density = max(density, stamp);
            }

            gl_FragColor = vec4(clamp(density, 0.0, 1.0), 0.0, 0.0, 1.0);
        }
      `,
    });

    const pingPongQuad = new THREE.Mesh(quadGeom, pingPongMat);
    const pingPongScene = new THREE.Scene();
    pingPongScene.add(pingPongQuad);

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Composite Shader: Crystal-Clear Letters & Wet Glossy Paint with 3D Balloon
    // ─────────────────────────────────────────────────────────────────────────
    const compositeMat = new THREE.ShaderMaterial({
      uniforms: {
        tInk: { value: null },
        tTextRaw: { value: null },
        tHeight: { value: null },
        tMatcapPrev: { value: matcapTextures[0] },
        tMatcapCurr: { value: matcapTextures[0] },
        tPhotoPrev: { value: photoTextures[0] },
        tPhotoCurr: { value: photoTextures[0] },
        uCrossfade: { value: 1.0 },
        uResolution: { value: new THREE.Vector2(W * dpr, H * dpr) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tInk;
        uniform sampler2D tTextRaw;
        uniform sampler2D tHeight;
        uniform sampler2D tMatcapPrev;
        uniform sampler2D tMatcapCurr;
        uniform sampler2D tPhotoPrev;
        uniform sampler2D tPhotoCurr;
        uniform float uCrossfade;
        uniform vec2 uResolution;
        varying vec2 vUv;

        void main() {
            // 1. Crystal-clear, razor-sharp letter mask directly from raw unblurred text canvas
            float rawText = texture2D(tTextRaw, vUv).r;
            float crispLetter = smoothstep(0.35, 0.65, rawText);

            // 2. Liquid Paint Surface Normal & Wet Gloss (Specular Paint Sheen)
            float density = texture2D(tInk, vUv).r;
            float inkMask = smoothstep(0.44, 0.52, density);

            // Calculate wet paint gradient normal for 3D liquid relief & gloss
            vec2 pTexel = 1.0 / uResolution;
            float pL = texture2D(tInk, vUv - vec2(pTexel.x * 3.0, 0.0)).r;
            float pR = texture2D(tInk, vUv + vec2(pTexel.x * 3.0, 0.0)).r;
            float pD = texture2D(tInk, vUv - vec2(0.0, pTexel.y * 3.0)).r;
            float pU = texture2D(tInk, vUv + vec2(0.0, pTexel.y * 3.0)).r;

            vec3 paintNormal = normalize(vec3(-(pR - pL) * 3.8, -(pU - pD) * 3.8, 1.0));

            // Overhead studio light reflecting on wet paint surface
            vec3 paintLightDir = normalize(vec3(0.35, 0.65, 0.85));
            float paintSpec = pow(max(0.0, dot(reflect(-paintLightDir, paintNormal), vec3(0.0, 0.0, 1.0))), 16.0) * 0.36;
            float paintFresnel = pow(1.0 - max(0.0, paintNormal.z), 2.5) * 0.22;

            // Wet black liquid enamel paint with glossy studio sheen
            vec3 wetBlackPaint = vec3(0.015, 0.015, 0.02) + (paintSpec + paintFresnel) * vec3(0.92, 0.95, 1.0);

            // 3. 3D Pillow Dome Normal from heightmap (used inside letters for 3D balloon lighting)
            vec2 eps = pTexel * 5.5;

            float hC = texture2D(tHeight, vUv).r;
            float hL = texture2D(tHeight, vUv - vec2(eps.x, 0.0)).r;
            float hR = texture2D(tHeight, vUv + vec2(eps.x, 0.0)).r;
            float hD = texture2D(tHeight, vUv - vec2(0.0, eps.y)).r;
            float hU = texture2D(tHeight, vUv + vec2(0.0, eps.y)).r;

            float dx = (hR - hL) * 3.8;
            float dy = (hU - hD) * 3.8;
            float nz = sqrt(max(0.04, 1.0 - min(0.96, dx * dx + dy * dy)));
            vec3 N = normalize(vec3(-dx, -dy, nz));

            // 4. Subtle pinched wrinkles/creases at joints and corners
            float wrinkle1 = sin(vUv.x * 85.0 + vUv.y * 65.0) * cos(vUv.x * 45.0 - vUv.y * 95.0);
            float wrinkle2 = sin(vUv.x * 140.0 - vUv.y * 110.0) * 0.5;
            float wrinkleMask = smoothstep(0.18, 0.55, hC) * (1.0 - smoothstep(0.65, 0.95, hC));
            vec3 perturbedN = normalize(N + vec3(wrinkle1 * 0.06, wrinkle2 * 0.05, 0.0) * wrinkleMask);

            // 5. Soft matcap lookup
            vec2 matcapUv = clamp(perturbedN.xy * 0.49 + 0.5, 0.005, 0.995);
            vec3 prevMat = texture2D(tMatcapPrev, matcapUv).rgb;
            vec3 currMat = texture2D(tMatcapCurr, matcapUv).rgb;

            // 6. Photographic Foil Texture mapping (distorted by balloon curvature)
            vec2 photoUv = vUv * vec2(uResolution.x / uResolution.y, 1.0) * 0.75 + perturbedN.xy * 0.05;
            vec3 photoPrev = texture2D(tPhotoPrev, fract(photoUv)).rgb;
            vec3 photoCurr = texture2D(tPhotoCurr, fract(photoUv)).rgb;

            // 800ms ease-in-out crossfade
            float t = smoothstep(0.0, 1.0, uCrossfade);
            vec3 blendedMat = mix(prevMat, currMat, t);
            vec3 blendedPhoto = mix(photoPrev, photoCurr, t);

            // Fuse photographic micro-crinkles with metallic matcap reflections
            vec3 baseBalloon = mix(blendedMat, blendedMat * (blendedPhoto * 1.45 + 0.15), 0.72);

            // 7. Broad soft highlights, gentle Fresnel rim, and subsurface-like glow
            vec3 lightDir = normalize(vec3(0.35, 0.65, 0.85));
            float broadHighlight = pow(max(0.0, dot(reflect(-lightDir, perturbedN), vec3(0.0, 0.0, 1.0))), 14.0) * 0.38;
            float softSpec = pow(max(0.0, dot(reflect(-lightDir, perturbedN), vec3(0.0, 0.0, 1.0))), 28.0) * 0.32;

            float F = pow(1.0 - max(0.0, perturbedN.z), 2.2);
            vec3 fresnelColor = mix(baseBalloon, vec3(1.0), 0.42);

            // Subsurface-like soft interior glow
            vec3 sss = baseBalloon * pow(clamp(1.0 - length(perturbedN.xy), 0.0, 1.0), 1.6) * 0.22;

            vec3 shadedBalloon = baseBalloon + (broadHighlight + softSpec) * vec3(1.0) + fresnelColor * F * 0.32 + sss;

            // 8. FINAL COMPOSITE:
            // Base cover page: Pure stark white (#FFFFFF) background, crisp solid black (#000000) letters
            vec3 baseColor = mix(vec3(1.0), vec3(0.0), crispLetter);

            // Inked: Luscious glossy wet black paint on background, 3D shiny inflated balloon on letters
            vec3 inkedColor = mix(wetBlackPaint, shadedBalloon, crispLetter);

            // Dynamically revealed smoothly by fluid paint
            vec3 finalColor = mix(baseColor, inkedColor, inkMask);

            gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });

    const compositeQuad = new THREE.Mesh(quadGeom, compositeMat);
    const compositeScene = new THREE.Scene();
    compositeScene.add(compositeQuad);

    // ─────────────────────────────────────────────────────────────────────────
    // Update Text & Heightmap with Crystal-Clear Centered Typography
    // ─────────────────────────────────────────────────────────────────────────
    const updateTextAndHeightmap = () => {
      if (!textCtx) return;
      const targetW = Math.floor(W * dpr);
      const targetH = Math.floor(H * dpr);
      textCanvas.width = targetW;
      textCanvas.height = targetH;

      textCtx.fillStyle = '#000000';
      textCtx.fillRect(0, 0, targetW, targetH);

      // Clean, centered, ultra-bold architectural grotesque typography
      let fs = Math.min(targetW * 0.22, targetH * 0.36);
      textCtx.font = `900 ${fs}px 'Inter Tight', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      textCtx.textAlign = 'center';
      textCtx.textBaseline = 'middle';

      const brandText = brand.toUpperCase();
      let measured = textCtx.measureText(brandText).width;
      const maxAllowedW = targetW * 0.88;
      if (measured > maxAllowedW) {
        fs *= (maxAllowedW / measured);
        textCtx.font = `900 ${fs}px 'Inter Tight', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      }

      // Draw crisp, bright white letters onto the offscreen canvas
      textCtx.fillStyle = '#ffffff';
      textCtx.fillText(brandText, targetW / 2, targetH * 0.50);

      if (textTexture) textTexture.dispose();
      textTexture = new THREE.CanvasTexture(textCanvas);
      textTexture.minFilter = THREE.LinearFilter;
      textTexture.magFilter = THREE.LinearFilter;

      // Update crisp raw text texture in composite shader
      compositeMat.uniforms.tTextRaw.value = textTexture;

      // Pass 1: Horizontal Gaussian blur for 3D pillow dome heightmap
      blurHMat.uniforms.tInput.value = textTexture;
      blurHMat.uniforms.uResolution.value.set(targetW, targetH);
      blurQuad.material = blurHMat;
      renderer.setRenderTarget(rtTextBlurH);
      renderer.render(blurScene, quadCamera);

      // Pass 2: Vertical Gaussian blur with sqrt pillow transformation
      blurVMat.uniforms.tInput.value = rtTextBlurH.texture;
      blurVMat.uniforms.uResolution.value.set(targetW, targetH);
      blurQuad.material = blurVMat;
      renderer.setRenderTarget(rtTextHeightmap);
      renderer.render(blurScene, quadCamera);

      renderer.setRenderTarget(null);

      // Immediately render base scene so cover page is instantly visible and crisp
      compositeMat.uniforms.tInk.value = rtPing.texture;
      compositeMat.uniforms.tHeight.value = rtTextHeightmap.texture;
      compositeMat.uniforms.uResolution.value.set(targetW, targetH);
      renderer.render(compositeScene, quadCamera);
    };

    updateTextAndHeightmap();

    // Re-render when fonts finish loading to ensure full 900 weight precision
    if (document.fonts) {
      document.fonts.ready.then(() => {
        updateTextAndHeightmap();
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Spring Physics & Invisible Background Material Shuffling
    // ─────────────────────────────────────────────────────────────────────────
    const pointer = {
      targetX: -999,
      targetY: -999,
      x: -999,
      y: -999,
      vx: 0,
      vy: 0,
      prevX: -999,
      prevY: -999,
      lastMoveTime: 0,
      smoothedSpeed: 0,
    };

    let playlist: number[] = [];
    const refillPlaylist = (exclude: number) => {
      const items = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => i !== exclude);
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    };

    let matCurr = 0; // Start with Purple Chrome Foil Balloon
    let matPrev = 0;
    let crossfadeStart = performance.now();
    let lastAutoChangeTime = performance.now();
    let isNewStroke = true;
    let recentStrokeLength = 0;

    const advanceMaterial = () => {
      matPrev = matCurr;
      if (playlist.length === 0) {
        playlist = refillPlaylist(matCurr);
      }
      matCurr = playlist.pop()!;
      crossfadeStart = performance.now();
      lastAutoChangeTime = performance.now();

      compositeMat.uniforms.tMatcapPrev.value = matcapTextures[matPrev];
      compositeMat.uniforms.tMatcapCurr.value = matcapTextures[matCurr];
      compositeMat.uniforms.tPhotoPrev.value = photoTextures[matPrev];
      compositeMat.uniforms.tPhotoCurr.value = photoTextures[matCurr];
    };

    // Coalesced pointer tracking
    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      const timeSinceLast = now - pointer.lastMoveTime;

      // Trigger material change on new stroke if idle > 400ms
      if (timeSinceLast > 400 || pointer.targetX < -900) {
        if (!isNewStroke) {
          advanceMaterial();
        }
        isNewStroke = true;
      }

      const events = typeof (e as any).getCoalescedEvents === 'function'
        ? (e as any).getCoalescedEvents()
        : [e];

      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        pointer.targetX = ev.clientX / W;
        pointer.targetY = 1.0 - ev.clientY / H;
      }

      pointer.lastMoveTime = now;

      if (pointer.x < -900) {
        pointer.x = pointer.targetX;
        pointer.y = pointer.targetY;
        pointer.prevX = pointer.targetX;
        pointer.prevY = pointer.targetY;
        pointer.vx = 0;
        pointer.vy = 0;
      }
    };

    // Holding or clicking does NOT grow the blob; simply arms stroke
    const onPointerDown = (e: PointerEvent) => {
      isNewStroke = true;
      onPointerMove(e);
    };

    const onPointerUp = () => {
      isNewStroke = false;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Shared RAF Loop (GSAP Ticker) with Delta-Time Physics & Paint Brush Flow
    // ─────────────────────────────────────────────────────────────────────────
    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      renderer.setSize(W, H);
      renderer.setPixelRatio(dpr);

      createHeightmapTargets();
      createPingPongTargets();
      updateTextAndHeightmap();
    };

    window.addEventListener('resize', onResize);

    const tick = (_time: number, deltaTime: number) => {
      if (document.hidden) return;

      const dt = Math.min(deltaTime / 1000, 0.05);
      const now = performance.now();

      const timeSinceMove = now - pointer.lastMoveTime;
      const isActivelyMoving = timeSinceMove < 260 && pointer.targetX > -900;
      const isInkVisible = timeSinceMove < 2800;

      // Automatic material change every 3.5s while ink is active
      if (AUTO_MATERIAL && isInkVisible) {
        if (now - lastAutoChangeTime > 3500) {
          advanceMaterial();
        }
      }

      // Pause rendering when idle to keep GPU at 0%
      if (!isInkVisible && !isActivelyMoving) {
        return;
      }

      // Viscous Paint Brush Physics:
      if (isActivelyMoving) {
        pointer.prevX = pointer.x;
        pointer.prevY = pointer.y;

        const omega = 24.0;
        const expTerm = Math.exp(-omega * dt);

        const diffX = pointer.x - pointer.targetX;
        const diffY = pointer.y - pointer.targetY;

        const newVx = (pointer.vx - omega * diffX) * expTerm;
        const newVy = (pointer.vy - omega * diffY) * expTerm;

        pointer.x = pointer.targetX + (diffX + (pointer.vx - omega * diffX) * dt) * expTerm;
        pointer.y = pointer.targetY + (diffY + (pointer.vy - omega * diffY) * dt) * expTerm;
        pointer.vx = newVx;
        pointer.vy = newVy;

        const currentSpeed = Math.hypot(pointer.vx * W, pointer.vy * H);
        pointer.smoothedSpeed += (currentSpeed - pointer.smoothedSpeed) * Math.min(1.0, dt * 12.0);

        // Dynamic Paint Brush Radius:
        // Slow move: 72px (viscous, rounded wet paint drop)
        // Fast sweep: 142px (expressive, broad calligraphy paint ribbon)
        const minDiameter = 72.0;
        const maxDiameter = 142.0;
        const speedFactor = Math.min(1.0, pointer.smoothedSpeed / 950.0);
        const pixelDiameter = minDiameter + speedFactor * (maxDiameter - minDiameter);
        const radiusUV = (pixelDiameter * 0.5) / H;

        // Track accumulated stroke length to prevent screen ink flooding
        const moveDist = Math.hypot((pointer.x - pointer.prevX) * W, (pointer.y - pointer.prevY) * H);
        if (moveDist > 0.8) {
          recentStrokeLength += moveDist;
        }

        pingPongMat.uniforms.uMouse.value.set(pointer.x, pointer.y);
        pingPongMat.uniforms.uPrevMouse.value.set(pointer.prevX, pointer.prevY);
        pingPongMat.uniforms.uRadius.value = radiusUV;
        pingPongMat.uniforms.uIsMoving.value = moveDist > 0.6 ? 1.0 : 0.0;
      } else {
        pingPongMat.uniforms.uIsMoving.value = 0.0;
        isNewStroke = false;
      }

      // Decay stroke length accumulation
      recentStrokeLength *= Math.pow(0.90, dt * 60.0);

      // Capped coverage: if ink accumulation exceeds ~35% of screen perimeter, accelerate decay
      const coveragePressure = Math.max(0.0, (recentStrokeLength - 1400.0) / 1800.0);
      const baseDecay = 0.972; // ~2.8s wet paint lifespan
      const dynamicDecay = Math.max(0.925, baseDecay - coveragePressure * 0.045);
      const frameDecay = Math.pow(dynamicDecay, dt * 60.0);

      pingPongMat.uniforms.uDecay.value = frameDecay;
      pingPongMat.uniforms.tPrev.value = rtPing.texture;
      pingPongMat.uniforms.uResolution.value.set(fW, fH);

      // Ping-pong render step
      renderer.setRenderTarget(rtPong);
      renderer.render(pingPongScene, quadCamera);

      const temp = rtPing;
      rtPing = rtPong;
      rtPong = temp;

      // 800ms ease-in-out crossfade
      const crossfadeProgress = Math.min(1.0, (now - crossfadeStart) / 800);

      compositeMat.uniforms.tInk.value = rtPing.texture;
      compositeMat.uniforms.tHeight.value = rtTextHeightmap.texture;
      compositeMat.uniforms.uResolution.value.set(W * dpr, H * dpr);
      compositeMat.uniforms.uCrossfade.value = crossfadeProgress;

      renderer.setRenderTarget(null);
      renderer.render(compositeScene, quadCamera);
    };

    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);

      renderer.dispose();
      textTexture?.dispose();
      rtPing?.dispose();
      rtPong?.dispose();
      rtTextBlurH?.dispose();
      rtTextHeightmap?.dispose();
    };
  }, [brand]);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none z-[1]">
      <canvas
        ref={canvasRef}
        id="stage"
        className="w-full h-full block select-none pointer-events-none"
        aria-label={`${brand} WebGL liquid ink trail and soft inflated balloon wordmark canvas`}
      />
    </div>
  );
};
