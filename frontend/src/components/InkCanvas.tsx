import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { HERO_FX_ENABLED, UI_EFFECTS } from '../config/uiEffects';

interface InkCanvasProps {
  brand: string;
}

/**
 * 8 Procedural Balloon / Tactile Materials:
 * 0: Clear Glass
 * 1: Iridescent Purple Foil Balloon
 * 2: Glossy Magenta Rubber
 * 3: Black Latex
 * 4: Soft White Fabric
 * 5: Pearl / Foam Bubbles
 * 6: Chrome Silver
 * 7: Pastel Pink with Tiny Sprinkles
 */
const MATERIAL_NAMES = [
  'CLEAR GLASS',
  'PURPLE FOIL BALLOON',
  'MAGENTA RUBBER',
  'BLACK LATEX',
  'WHITE FABRIC',
  'PEARL BUBBLES',
  'CHROME SILVER',
  'PINK SPRINKLES',
];

// GLSL fragment code for the 8 procedural materials
const MATERIALS_GLSL = `
vec3 shadeGlass(vec3 N, vec2 uv) {
    float F = pow(1.0 - max(0.0, N.z), 2.5);
    vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
    float spec = pow(max(0.0, dot(reflect(-lightDir, N), vec3(0.0, 0.0, 1.0))), 36.0);
    vec3 edgeColor = vec3(0.85, 0.94, 1.0);
    vec3 base = vec3(0.12, 0.15, 0.22);
    return base + edgeColor * F * 1.6 + vec3(1.0) * spec * 0.95;
}

vec3 shadePurpleFoil(vec3 N, vec2 uv) {
    float w = sin(uv.x * 140.0 + uv.y * 90.0) * cos(uv.x * 70.0 - uv.y * 150.0) * 0.10;
    vec3 pN = normalize(N + vec3(w, w * 0.7, 0.0));
    float F = pow(1.0 - max(0.0, pN.z), 2.0);
    float shift = pN.x * 0.6 + pN.y * 0.35 + F * 1.5;
    vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (shift + vec3(0.78, 0.18, 0.48)));
    vec3 foilViolet = vec3(0.42, 0.08, 0.72);
    vec3 lightDir = normalize(vec3(0.55, 0.75, 0.85));
    float spec = pow(max(0.0, dot(reflect(-lightDir, pN), vec3(0.0, 0.0, 1.0))), 45.0);
    return mix(foilViolet, rainbow, 0.52) + vec3(1.0, 0.96, 1.0) * spec * 1.15 + F * vec3(0.65, 0.22, 0.95);
}

vec3 shadeMagentaRubber(vec3 N, vec2 uv) {
    vec3 lightDir = normalize(vec3(0.4, 0.7, 0.8));
    float diff = max(0.0, dot(N, lightDir)) * 0.68 + 0.32;
    vec3 magenta = vec3(0.92, 0.06, 0.56);
    float spec = pow(max(0.0, dot(reflect(-lightDir, N), vec3(0.0, 0.0, 1.0))), 26.0);
    float F = pow(1.0 - max(0.0, N.z), 2.8);
    return magenta * diff + vec3(1.0, 0.65, 0.88) * spec * 0.85 + vec3(1.0, 0.35, 0.75) * F * 0.42;
}

vec3 shadeBlackLatex(vec3 N, vec2 uv) {
    vec3 lightDir1 = normalize(vec3(0.5, 0.8, 0.7));
    vec3 lightDir2 = normalize(vec3(-0.6, -0.4, 0.6));
    float spec1 = pow(max(0.0, dot(reflect(-lightDir1, N), vec3(0.0, 0.0, 1.0))), 80.0);
    float spec2 = pow(max(0.0, dot(reflect(-lightDir2, N), vec3(0.0, 0.0, 1.0))), 22.0);
    float F = pow(1.0 - max(0.0, N.z), 3.4);
    vec3 base = vec3(0.035, 0.035, 0.045);
    return base + vec3(1.0) * spec1 * 1.35 + vec3(0.6, 0.72, 0.9) * spec2 * 0.3 + vec3(0.55, 0.6, 0.72) * F * 0.55;
}

vec3 shadeWhiteFabric(vec3 N, vec2 uv) {
    vec3 lightDir = normalize(vec3(0.35, 0.65, 0.8));
    float diff = max(0.0, dot(N, lightDir)) * 0.62 + 0.38;
    float grain = sin(uv.x * 450.0) * cos(uv.y * 450.0) * 0.035;
    float F = pow(1.0 - max(0.0, N.z), 1.6);
    vec3 base = vec3(0.95, 0.95, 0.97) + grain;
    return base * diff + vec3(0.24) * F;
}

vec3 shadePearlBubbles(vec3 N, vec2 uv) {
    float F = pow(1.0 - max(0.0, N.z), 2.2);
    vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (F * 1.8 + vec3(0.0, 0.33, 0.67)));
    vec3 pearlBase = vec3(0.96, 0.96, 0.98);
    float bubbles = sin(uv.x * 240.0) * sin(uv.y * 240.0);
    float microSpec = pow(max(0.0, bubbles), 8.0) * 0.38;
    vec3 lightDir = normalize(vec3(0.4, 0.8, 0.7));
    float spec = pow(max(0.0, dot(reflect(-lightDir, N), vec3(0.0, 0.0, 1.0))), 40.0);
    return mix(pearlBase, rainbow, 0.36) * 0.92 + vec3(1.0) * (spec * 0.75 + microSpec);
}

vec3 shadeChromeSilver(vec3 N, vec2 uv) {
    float horiz = smoothstep(-0.06, 0.06, N.y);
    vec3 sky = vec3(0.96, 0.98, 1.0);
    vec3 ground = vec3(0.16, 0.18, 0.20);
    vec3 refl = mix(ground, sky, horiz);
    vec3 lightDir = normalize(vec3(0.5, 0.75, 0.8));
    float spec = pow(max(0.0, dot(reflect(-lightDir, N), vec3(0.0, 0.0, 1.0))), 72.0);
    float F = pow(1.0 - max(0.0, N.z), 2.0);
    return refl + vec3(1.0) * spec * 1.25 + vec3(0.85, 0.92, 1.0) * F * 0.45;
}

vec3 shadePastelSprinkles(vec3 N, vec2 uv) {
    vec3 lightDir = normalize(vec3(0.4, 0.7, 0.8));
    float diff = max(0.0, dot(N, lightDir)) * 0.65 + 0.35;
    vec3 pink = vec3(0.98, 0.74, 0.84);
    vec2 grid = fract(uv * 130.0) - 0.5;
    vec2 id = floor(uv * 130.0);
    float sprinkleHash = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
    float distToDot = length(grid);
    vec3 sprinkleColor = pink;
    if (distToDot < 0.22 && sprinkleHash > 0.6) {
        if (sprinkleHash > 0.9) sprinkleColor = vec3(0.28, 0.82, 0.92);
        else if (sprinkleHash > 0.8) sprinkleColor = vec3(1.0, 0.86, 0.22);
        else if (sprinkleHash > 0.7) sprinkleColor = vec3(0.72, 0.32, 0.92);
        else sprinkleColor = vec3(1.0, 0.42, 0.52);
    }
    float spec = pow(max(0.0, dot(reflect(-lightDir, N), vec3(0.0, 0.0, 1.0))), 32.0);
    return mix(pink * diff, sprinkleColor, distToDot < 0.22 && sprinkleHash > 0.6 ? 0.92 : 0.0) + vec3(1.0) * spec * 0.65;
}

vec3 getMaterial(int idx, vec3 N, vec2 uv) {
    if (idx == 0) return shadeGlass(N, uv);
    if (idx == 1) return shadePurpleFoil(N, uv);
    if (idx == 2) return shadeMagentaRubber(N, uv);
    if (idx == 3) return shadeBlackLatex(N, uv);
    if (idx == 4) return shadeWhiteFabric(N, uv);
    if (idx == 5) return shadePearlBubbles(N, uv);
    if (idx == 6) return shadeChromeSilver(N, uv);
    return shadePastelSprinkles(N, uv);
}
`;

export const InkCanvas: React.FC<InkCanvasProps> = ({ brand }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const materialBadgeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check motion preference and WebGL availability
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isFxEnabled = HERO_FX_ENABLED && UI_EFFECTS.enabled && !prefersReducedMotion;

    // 2D Fallback if WebGL or FX disabled
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
    // Three.js Fullscreen WebGL Pipeline
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
      return; // Fallback
    }

    renderer.setSize(W, H);
    renderer.setPixelRatio(dpr);

    // Fullscreen quad camera & geometry
    const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeom = new THREE.PlaneGeometry(2, 2);

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Offscreen Text & Heightmap Generation
    // ─────────────────────────────────────────────────────────────────────────
    const textCanvas = document.createElement('canvas');
    const textCtx = textCanvas.getContext('2d');
    let textTexture: THREE.CanvasTexture | null = null;

    // Render targets for GPU separable Gaussian blur (heightmap)
    let rtTextBlurH: THREE.WebGLRenderTarget;
    let rtTextHeightmap: THREE.WebGLRenderTarget;

    const createHeightmapTargets = () => {
      rtTextBlurH?.dispose();
      rtTextHeightmap?.dispose();

      rtTextBlurH = new THREE.WebGLRenderTarget(Math.floor(W * dpr), Math.floor(H * dpr), {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
      });

      rtTextHeightmap = new THREE.WebGLRenderTarget(Math.floor(W * dpr), Math.floor(H * dpr), {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
      });
    };

    createHeightmapTargets();

    // Blur shader uniforms & materials
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

      // Pass 1: Horizontal blur
      blurHMat.uniforms.tInput.value = textTexture;
      blurHMat.uniforms.uResolution.value.set(W * dpr, H * dpr);
      blurQuad.material = blurHMat;
      renderer.setRenderTarget(rtTextBlurH);
      renderer.render(blurScene, quadCamera);

      // Pass 2: Vertical blur to produce smooth dome heightmap
      blurVMat.uniforms.tInput.value = rtTextBlurH.texture;
      blurVMat.uniforms.uResolution.value.set(W * dpr, H * dpr);
      blurQuad.material = blurVMat;
      renderer.setRenderTarget(rtTextHeightmap);
      renderer.render(blurScene, quadCamera);

      renderer.setRenderTarget(null);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Ping-Pong Fluid Metaball Ink Trail
    // ─────────────────────────────────────────────────────────────────────────
    // Half resolution for buttery smooth fluid diffusion and high frame rates
    let fW = Math.floor(W / 2);
    let fH = Math.floor(H / 2);

    let rtPing: THREE.WebGLRenderTarget;
    let rtPong: THREE.WebGLRenderTarget;

    const createPingPongTargets = () => {
      rtPing?.dispose();
      rtPong?.dispose();

      fW = Math.floor(W / 2);
      fH = Math.floor(H / 2);

      const opts = {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
      };

      rtPing = new THREE.WebGLRenderTarget(fW, fH, opts);
      rtPong = new THREE.WebGLRenderTarget(fW, fH, opts);

      // Clear both buffers to zero
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
        uDecay: { value: 0.972 }, // Tuned for ~1.5 - 2.5s dissipation
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

            // Sample previous frame with 4-tap slight blur to diffuse metaballs
            float prev = texture2D(tPrev, vUv).r;
            float blurred = (
                texture2D(tPrev, vUv + vec2(-texel.x, 0.0)).r +
                texture2D(tPrev, vUv + vec2(texel.x, 0.0)).r +
                texture2D(tPrev, vUv + vec2(0.0, -texel.y)).r +
                texture2D(tPrev, vUv + vec2(0.0, texel.y)).r
            ) * 0.25;

            // Decay factor
            float density = mix(prev, blurred, 0.25) * uDecay;

            // Add continuous ink trail along segment if moving
            if (uIsMoving > 0.5) {
                float d = distToSegment(vUv, uPrevMouse, uMouse, aspect);
                // Soft smooth metaball stamp
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
    // 3. Composite & Shading Shader
    // ─────────────────────────────────────────────────────────────────────────
    const compositeMat = new THREE.ShaderMaterial({
      uniforms: {
        tInk: { value: null },
        tText: { value: null },
        tHeight: { value: null },
        uResolution: { value: new THREE.Vector2(W * dpr, H * dpr) },
        uMatPrev: { value: 0 },
        uMatCurr: { value: 1 },
        uCrossfade: { value: 1.0 },
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
        uniform vec2 uResolution;
        uniform int uMatPrev;
        uniform int uMatCurr;
        uniform float uCrossfade;
        varying vec2 vUv;

        ${MATERIALS_GLSL}

        void main() {
            // 1. Threshold ink density with smoothstep to get organic blobby metaball fluid edge
            float density = texture2D(tInk, vUv).r;
            float inkMask = smoothstep(0.24, 0.52, density);

            // 2. Text mask
            float letterMask = texture2D(tText, vUv).r;

            // 3. Compute surface normal from heightmap for 3D inflated balloon look
            vec2 texel = 1.0 / uResolution;
            float hL = texture2D(tHeight, vUv - vec2(texel.x * 3.0, 0.0)).r;
            float hR = texture2D(tHeight, vUv + vec2(texel.x * 3.0, 0.0)).r;
            float hD = texture2D(tHeight, vUv - vec2(0.0, texel.y * 3.0)).r;
            float hU = texture2D(tHeight, vUv + vec2(0.0, texel.y * 3.0)).r;

            float dx = (hR - hL) * 14.0;
            float dy = (hU - hD) * 14.0;
            float nz = sqrt(max(0.04, 1.0 - min(0.96, dx * dx + dy * dy)));
            vec3 N = normalize(vec3(-dx, -dy, nz));

            // 4. Shaded material with crossfade
            vec3 cPrev = getMaterial(uMatPrev, N, vUv);
            vec3 cCurr = getMaterial(uMatCurr, N, vUv);
            vec3 matColor = mix(cPrev, cCurr, smoothstep(0.0, 1.0, uCrossfade));

            // 5. Final composite:
            // Base state: white background (1,1,1), solid black letters (0,0,0)
            vec3 baseColor = mix(vec3(1.0), vec3(0.0), letterMask);
            // Inked state: solid black ink on background, 3D inflated material on letters
            vec3 inkedColor = mix(vec3(0.0), matColor, letterMask);
            // Crossfade base to inked state based on inkMask
            vec3 finalColor = mix(baseColor, inkedColor, inkMask);

            gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });

    const compositeQuad = new THREE.Mesh(quadGeom, compositeMat);
    const compositeScene = new THREE.Scene();
    compositeScene.add(compositeQuad);

    // Initial text render
    updateTextAndHeightmap();

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Interaction State & Easing Physics
    // ─────────────────────────────────────────────────────────────────────────
    const pointer = {
      targetX: -999,
      targetY: -999,
      easedX: -999,
      easedY: -999,
      prevEasedX: -999,
      prevEasedY: -999,
      lastMoveTime: 0,
      isDown: false,
    };

    // Material cycling state
    let matCurr = 1; // Start with Purple Foil Balloon
    let matPrev = 0;
    let crossfadeStart = performance.now();
    let isNewStroke = true;

    const advanceMaterial = () => {
      matPrev = matCurr;
      matCurr = (matCurr + 1) % 8;
      crossfadeStart = performance.now();
      if (materialBadgeRef.current) {
        materialBadgeRef.current.textContent = MATERIAL_NAMES[matCurr];
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      const timeSinceLast = now - pointer.lastMoveTime;

      // Start a new stroke if user was idle > 350ms
      if (timeSinceLast > 350 || pointer.targetX < -900) {
        if (!isNewStroke) {
          advanceMaterial();
        }
        isNewStroke = true;
      }

      pointer.targetX = e.clientX / W;
      pointer.targetY = 1.0 - e.clientY / H;
      pointer.lastMoveTime = now;

      if (pointer.easedX < -900) {
        pointer.easedX = pointer.targetX;
        pointer.easedY = pointer.targetY;
        pointer.prevEasedX = pointer.targetX;
        pointer.prevEasedY = pointer.targetY;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      pointer.isDown = true;
      advanceMaterial();
      isNewStroke = true;
      onPointerMove(e);
    };

    const onPointerUp = () => {
      pointer.isDown = false;
      isNewStroke = false;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Animation Loop with Pause Optimization
    // ─────────────────────────────────────────────────────────────────────────
    let animId: number;

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

    const renderFrame = () => {
      const now = performance.now();

      if (document.hidden) {
        animId = requestAnimationFrame(renderFrame);
        return;
      }

      const timeSinceMove = now - pointer.lastMoveTime;
      const isActivelyMoving = timeSinceMove < 280 && pointer.targetX > -900;

      // Easing physics: lag ~0.1-0.15s, spring-like response
      if (isActivelyMoving) {
        pointer.prevEasedX = pointer.easedX;
        pointer.prevEasedY = pointer.easedY;

        pointer.easedX += (pointer.targetX - pointer.easedX) * 0.18;
        pointer.easedY += (pointer.targetY - pointer.easedY) * 0.18;

        // Dynamic radius: 150px - 260px wide depending on mouse speed
        const speed = Math.hypot(
          (pointer.easedX - pointer.prevEasedX) * W,
          (pointer.easedY - pointer.prevEasedY) * H
        );
        const pixelRadius = (150 + Math.min(speed * 3.5, 110)) * 0.5;
        const radiusUV = pixelRadius / H;

        pingPongMat.uniforms.uMouse.value.set(pointer.easedX, pointer.easedY);
        pingPongMat.uniforms.uPrevMouse.value.set(pointer.prevEasedX, pointer.prevEasedY);
        pingPongMat.uniforms.uRadius.value = radiusUV;
        pingPongMat.uniforms.uIsMoving.value = 1.0;
      } else {
        pingPongMat.uniforms.uIsMoving.value = 0.0;
        isNewStroke = false;
      }

      // Step A: Ping-Pong fluid simulation pass
      pingPongMat.uniforms.tPrev.value = rtPing.texture;
      pingPongMat.uniforms.uResolution.value.set(fW, fH);

      renderer.setRenderTarget(rtPong);
      renderer.render(pingPongScene, quadCamera);

      // Swap ping-pong buffers
      const temp = rtPing;
      rtPing = rtPong;
      rtPong = temp;

      // Step B: Final composite pass
      const crossfadeProgress = Math.min(1.0, (now - crossfadeStart) / 300); // 300ms crossfade

      compositeMat.uniforms.tInk.value = rtPing.texture;
      compositeMat.uniforms.tText.value = textTexture;
      compositeMat.uniforms.tHeight.value = rtTextHeightmap.texture;
      compositeMat.uniforms.uResolution.value.set(W * dpr, H * dpr);
      compositeMat.uniforms.uMatPrev.value = matPrev;
      compositeMat.uniforms.uMatCurr.value = matCurr;
      compositeMat.uniforms.uCrossfade.value = crossfadeProgress;

      renderer.setRenderTarget(null);
      renderer.render(compositeScene, quadCamera);

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(animId);
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
        aria-label={`${brand} WebGL interactive liquid ink and 3D inflated balloon wordmark canvas`}
      />

      {/* Subtle Material Indicator at top right */}
      <div className="absolute top-[80px] right-[22px] z-20 pointer-events-auto flex items-center gap-1.5 bg-black/5 hover:bg-black/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-black/10 shadow-sm transition-all select-none">
        <span className="text-[10px] font-mono uppercase tracking-wider text-black/50 font-bold hidden md:inline">
          3D MATERIAL:
        </span>
        <span
          ref={materialBadgeRef}
          className="text-[10px] font-mono font-bold uppercase tracking-wider text-black"
        >
          {MATERIAL_NAMES[1]}
        </span>
      </div>
    </div>
  );
};
