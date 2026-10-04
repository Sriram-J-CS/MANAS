import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { FX_ENABLED, HERO_FX_ENABLED, AUTO_MATERIAL } from '../config/uiEffects';

interface InkCanvasProps {
  brand: string;
}

const MATERIAL_DEFS = [
  { id: 'glass', name: 'CLEAR GLASS', file: '/fx/glass.webp' },
  { id: 'purple_foil', name: 'PURPLE FOIL BALLOON', file: '/fx/purple_foil.webp' },
  { id: 'magenta_rubber', name: 'MAGENTA RUBBER', file: '/fx/magenta_rubber.webp' },
  { id: 'black_latex', name: 'BLACK LATEX', file: '/fx/black_latex.webp' },
  { id: 'white_fabric', name: 'SOFT WHITE FABRIC', file: '/fx/white_fabric.webp' },
  { id: 'pearl_foam', name: 'PEARL FOAM BUBBLES', file: '/fx/pearl_foam.webp' },
  { id: 'chrome', name: 'CHROME SILVER', file: '/fx/chrome.webp' },
  { id: 'pastel_pink', name: 'PINK SPRINKLES', file: '/fx/pastel_pink.webp' },
];

export const InkCanvas: React.FC<InkCanvasProps> = ({ brand }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const materialBadgeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check motion preference and WebGL availability
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isFxEnabled = FX_ENABLED && HERO_FX_ENABLED && !prefersReducedMotion;

    // Fallback if reduced motion or FX disabled
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

        const fs = Math.min(W * 0.23, H * 0.38);
        ctx.fillStyle = '#000000';
        ctx.font = `900 ${fs}px 'Inter Tight', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(brand, W / 2, H * 0.5);
      };

      render2DFallback();
      window.addEventListener('resize', render2DFallback);
      return () => window.removeEventListener('resize', render2DFallback);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // WebGL Pipeline (Three.js with Half-Float Ping-Pong & Matcaps)
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

    // Load 8 Matcap Textures from /public/fx/
    const textureLoader = new THREE.TextureLoader();
    const matcapTextures: THREE.Texture[] = MATERIAL_DEFS.map((def) => {
      const tex = textureLoader.load(def.file);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      return tex;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Offscreen Text & Heightmap Generation (GPU separable Gaussian blur)
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
      const opts = {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
      };

      rtTextBlurH = new THREE.WebGLRenderTarget(w, h, opts);
      rtTextHeightmap = new THREE.WebGLRenderTarget(w, h, opts);
    };

    createHeightmapTargets();

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
          float weights[9] = float[](0.05, 0.09, 0.12, 0.15, 0.18, 0.15, 0.12, 0.09, 0.05);
          for (int i = -4; i <= 4; i++) {
            sum += texture2D(tInput, vUv + vec2(float(i) * 5.5 * texel.x, 0.0)).r * weights[i + 4];
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
          float weights[9] = float[](0.05, 0.09, 0.12, 0.15, 0.18, 0.15, 0.12, 0.09, 0.05);
          for (int i = -4; i <= 4; i++) {
            sum += texture2D(tInput, vUv + vec2(0.0, float(i) * 5.5 * texel.y)).r * weights[i + 4];
          }
          gl_FragColor = vec4(vec3(sum), 1.0);
        }
      `,
    });

    const blurQuad = new THREE.Mesh(quadGeom, blurHMat);
    const blurScene = new THREE.Scene();
    blurScene.add(blurQuad);

    const updateTextAndHeightmap = () => {
      if (!textCtx) return;
      textCanvas.width = Math.floor(W * dpr);
      textCanvas.height = Math.floor(H * dpr);

      textCtx.fillStyle = '#000000';
      textCtx.fillRect(0, 0, textCanvas.width, textCanvas.height);

      const fs = Math.min(W * 0.23, H * 0.38) * dpr;
      textCtx.fillStyle = '#ffffff';
      textCtx.font = `900 ${fs}px 'Inter Tight', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif`;
      textCtx.textAlign = 'center';
      textCtx.textBaseline = 'middle';
      textCtx.fillText(brand, textCanvas.width / 2, textCanvas.height * 0.5);

      if (textTexture) textTexture.dispose();
      textTexture = new THREE.CanvasTexture(textCanvas);
      textTexture.minFilter = THREE.LinearFilter;
      textTexture.magFilter = THREE.LinearFilter;

      // Pass 1: Horizontal Gaussian blur
      blurHMat.uniforms.tInput.value = textTexture;
      blurHMat.uniforms.uResolution.value.set(W * dpr, H * dpr);
      blurQuad.material = blurHMat;
      renderer.setRenderTarget(rtTextBlurH);
      renderer.render(blurScene, quadCamera);

      // Pass 2: Vertical Gaussian blur to complete 2D height dome
      blurVMat.uniforms.tInput.value = rtTextBlurH.texture;
      blurVMat.uniforms.uResolution.value.set(W * dpr, H * dpr);
      blurQuad.material = blurVMat;
      renderer.setRenderTarget(rtTextHeightmap);
      renderer.render(blurScene, quadCamera);

      renderer.setRenderTarget(null);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Half-Float Ping-Pong Framebuffer Fluid Metaball Trail
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
        type: THREE.HalfFloatType, // 16-bit half float for artifact-free liquid decay
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
        uRadius: { value: 0.1 },
        uDecay: { value: 0.974 },
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

        // Line segment distance formula for gapless fluid stamping
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

            // 4-tap slight diffusion blur
            float prev = texture2D(tPrev, vUv).r;
            float blurred = (
                texture2D(tPrev, vUv + vec2(-texel.x, 0.0)).r +
                texture2D(tPrev, vUv + vec2(texel.x, 0.0)).r +
                texture2D(tPrev, vUv + vec2(0.0, -texel.y)).r +
                texture2D(tPrev, vUv + vec2(0.0, texel.y)).r
            ) * 0.25;

            // Time-scaled exponential decay
            float density = mix(prev, blurred, 0.22) * uDecay;

            // Add smooth continuous stamp along segment
            if (uIsMoving > 0.5) {
                float d = distToSegment(vUv, uPrevMouse, uMouse, aspect);
                float stamp = smoothstep(uRadius, uRadius * 0.25, d);
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
    // 3. Composite Shader: Matcap + Fresnel + Specular + Inflated Normals
    // ─────────────────────────────────────────────────────────────────────────
    const compositeMat = new THREE.ShaderMaterial({
      uniforms: {
        tInk: { value: null },
        tText: { value: null },
        tHeight: { value: null },
        tMatcapPrev: { value: matcapTextures[1] },
        tMatcapCurr: { value: matcapTextures[1] },
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
        uniform sampler2D tText;
        uniform sampler2D tHeight;
        uniform sampler2D tMatcapPrev;
        uniform sampler2D tMatcapCurr;
        uniform float uCrossfade;
        uniform vec2 uResolution;
        varying vec2 vUv;

        void main() {
            // 1. Liquid threshold for organic metaball fluid edge
            float density = texture2D(tInk, vUv).r;
            float inkMask = smoothstep(0.24, 0.52, density);

            // 2. Text mask
            float letterMask = texture2D(tText, vUv).r;

            // 3. Compute surface normal from heightmap dome
            vec2 texel = 1.0 / uResolution;
            float hL = texture2D(tHeight, vUv - vec2(texel.x * 3.5, 0.0)).r;
            float hR = texture2D(tHeight, vUv + vec2(texel.x * 3.5, 0.0)).r;
            float hD = texture2D(tHeight, vUv - vec2(0.0, texel.y * 3.5)).r;
            float hU = texture2D(tHeight, vUv + vec2(0.0, texel.y * 3.5)).r;

            float dx = (hR - hL) * 14.0;
            float dy = (hU - hD) * 14.0;
            float nz = sqrt(max(0.02, 1.0 - min(0.98, dx * dx + dy * dy)));
            vec3 N = normalize(vec3(-dx, -dy, nz));

            // 4. Matcap texture lookup
            vec2 matcapUv = clamp(N.xy * 0.495 + 0.5, 0.005, 0.995);
            vec3 prevMat = texture2D(tMatcapPrev, matcapUv).rgb;
            vec3 currMat = texture2D(tMatcapCurr, matcapUv).rgb;

            // 800ms ease-in-out crossfade
            float t = smoothstep(0.0, 1.0, uCrossfade);
            vec3 baseMat = mix(prevMat, currMat, t);

            // 5. Fresnel + Specular lighting
            float F = pow(1.0 - max(0.0, N.z), 2.5);
            vec3 lightDir = normalize(vec3(0.45, 0.75, 0.8));
            float spec = pow(max(0.0, dot(reflect(-lightDir, N), vec3(0.0, 0.0, 1.0))), 36.0);
            vec3 shadedMaterial = baseMat + vec3(1.0) * spec * 0.45 + F * 0.18;

            // 6. Final composite:
            // Base state: pure white background (1,1,1), solid black letters (0,0,0)
            vec3 baseColor = mix(vec3(1.0), vec3(0.0), letterMask);
            // Inked state: solid black ink on background, 3D inflated balloon on letters
            vec3 inkedColor = mix(vec3(0.0), shadedMaterial, letterMask);
            // Reveal via inkMask
            vec3 finalColor = mix(baseColor, inkedColor, inkMask);

            gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });

    const compositeQuad = new THREE.Mesh(quadGeom, compositeMat);
    const compositeScene = new THREE.Scene();
    compositeScene.add(compositeQuad);

    updateTextAndHeightmap();

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Critically Damped Spring Physics & Shuffled Material Playlist
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

    // Material playlist shuffle (no immediate repeats)
    let playlist: number[] = [];
    const refillPlaylist = (exclude: number) => {
      const items = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => i !== exclude);
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    };

    let matCurr = 1; // Start with Purple Foil Balloon
    let matPrev = 1;
    let crossfadeStart = performance.now();
    let lastAutoChangeTime = performance.now();
    let userOverrideUntil = 0;
    let isNewStroke = true;

    const advanceMaterial = (nextIdx?: number) => {
      matPrev = matCurr;
      if (typeof nextIdx === 'number') {
        matCurr = nextIdx % 8;
      } else {
        if (playlist.length === 0) {
          playlist = refillPlaylist(matCurr);
        }
        matCurr = playlist.pop()!;
      }
      crossfadeStart = performance.now();
      lastAutoChangeTime = performance.now();

      compositeMat.uniforms.tMatcapPrev.value = matcapTextures[matPrev];
      compositeMat.uniforms.tMatcapCurr.value = matcapTextures[matCurr];

      if (materialBadgeRef.current) {
        materialBadgeRef.current.textContent = MATERIAL_DEFS[matCurr].name;
      }
    };

    // Chip click temporary override (10s before auto-cycle resumes)
    const handleChipClick = (e: MouseEvent) => {
      e.stopPropagation();
      userOverrideUntil = performance.now() + 10000;
      advanceMaterial((matCurr + 1) % 8);
    };

    const chipEl = materialBadgeRef.current?.parentElement;
    chipEl?.addEventListener('click', handleChipClick);

    // Read pointer events with getCoalescedEvents() for gapless fluid tracing
    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      const timeSinceLast = now - pointer.lastMoveTime;

      // Trigger material change on new stroke if idle > 400ms
      if (timeSinceLast > 400 || pointer.targetX < -900) {
        if (!isNewStroke && now > userOverrideUntil) {
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

    const onPointerDown = (e: PointerEvent) => {
      if (performance.now() > userOverrideUntil) {
        advanceMaterial();
      }
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
    // 5. Shared RAF Loop (GSAP Ticker) with Delta-Time Physics
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

      const dt = Math.min(deltaTime / 1000, 0.05); // Frame delta time in seconds
      const now = performance.now();

      const timeSinceMove = now - pointer.lastMoveTime;
      const isActivelyMoving = timeSinceMove < 280 && pointer.targetX > -900;
      const isInkVisible = timeSinceMove < 2600;

      // Automatic material change every 3.5s while ink is active (if auto active & not overridden)
      if (AUTO_MATERIAL && isInkVisible && now > userOverrideUntil) {
        if (now - lastAutoChangeTime > 3500) {
          advanceMaterial();
        }
      }

      // Pause rendering if completely idle to conserve GPU/battery
      if (!isInkVisible && !isActivelyMoving) {
        return;
      }

      // Critically Damped Spring Physics:
      // Exact analytical solution: zero oscillation, smooth inertia lag (~0.12s)
      if (isActivelyMoving) {
        pointer.prevX = pointer.x;
        pointer.prevY = pointer.y;

        const omega = 20.0; // Spring frequency (rad/s)
        const expTerm = Math.exp(-omega * dt);

        const diffX = pointer.x - pointer.targetX;
        const diffY = pointer.y - pointer.targetY;

        const newVx = (pointer.vx - omega * diffX) * expTerm;
        const newVy = (pointer.vy - omega * diffY) * expTerm;

        pointer.x = pointer.targetX + (diffX + (pointer.vx - omega * diffX) * dt) * expTerm;
        pointer.y = pointer.targetY + (diffY + (pointer.vy - omega * diffY) * dt) * expTerm;
        pointer.vx = newVx;
        pointer.vy = newVy;

        // Velocity-smoothed radius scaling between 150px and 260px
        const currentSpeed = Math.hypot(pointer.vx * W, pointer.vy * H);
        pointer.smoothedSpeed += (currentSpeed - pointer.smoothedSpeed) * Math.min(1.0, dt * 10.0);

        const pixelDiameter = 150.0 + Math.min(pointer.smoothedSpeed * 0.12, 110.0);
        const radiusUV = (pixelDiameter * 0.5) / H;

        pingPongMat.uniforms.uMouse.value.set(pointer.x, pointer.y);
        pingPongMat.uniforms.uPrevMouse.value.set(pointer.prevX, pointer.prevY);
        pingPongMat.uniforms.uRadius.value = radiusUV;
        pingPongMat.uniforms.uIsMoving.value = 1.0;
      } else {
        pingPongMat.uniforms.uIsMoving.value = 0.0;
        isNewStroke = false;
      }

      // Time-scaled liquid decay (feels identical at 60Hz or 120Hz)
      const frameDecay = Math.pow(0.974, dt * 60.0);
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
      compositeMat.uniforms.tText.value = textTexture;
      compositeMat.uniforms.tHeight.value = rtTextHeightmap.texture;
      compositeMat.uniforms.uResolution.value.set(W * dpr, H * dpr);
      compositeMat.uniforms.uCrossfade.value = crossfadeProgress;

      renderer.setRenderTarget(null);
      renderer.render(compositeScene, quadCamera);
    };

    // Shared single loop with Lenis and GSAP
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      chipEl?.removeEventListener('click', handleChipClick);

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
        aria-label={`${brand} WebGL liquid ink trail and 3D inflated balloon wordmark canvas`}
      />

      {/* 3D Material Live Chip: Auto updates, click overrides temporarily for 10s */}
      <div
        className="absolute top-[80px] right-[22px] z-20 pointer-events-auto flex items-center gap-1.5 bg-black/5 hover:bg-black/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-black/10 shadow-sm transition-all select-none cursor-pointer"
        title="Click to manually cycle material (resumes auto in 10s)"
      >
        <span className="text-[10px] font-mono uppercase tracking-wider text-black/50 font-bold hidden md:inline">
          3D MATERIAL:
        </span>
        <span
          ref={materialBadgeRef}
          className="text-[10px] font-mono font-bold uppercase tracking-wider text-black"
        >
          {MATERIAL_DEFS[1].name}
        </span>
      </div>
    </div>
  );
};
