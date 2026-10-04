import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export interface FaceAttributesResult {
  detectedSkin: string; // e.g. '#F3D2B8'
  detectedHair: string; // e.g. '#2A1D1A'
  hairStyle: 'short' | 'wavy' | 'curly' | 'long';
  glasses: boolean;
  confidence: number;
}

let landmarkerInstance: FaceLandmarker | null = null;
let resolverInstance: any = null;

/**
 * Initializes and caches the MediaPipe Face Landmarker model.
 */
export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (landmarkerInstance) return landmarkerInstance;

  try {
    if (!resolverInstance) {
      resolverInstance = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/wasm'
      );
    }

    landmarkerInstance = await FaceLandmarker.createFromOptions(resolverInstance, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      outputFaceBlendshapes: true,
      runningMode: 'IMAGE',
      numFaces: 1,
    });

    return landmarkerInstance;
  } catch (err) {
    console.warn('MediaPipe GPU initialization failed, falling back to CPU delegate:', err);
    // Retry with CPU delegate
    landmarkerInstance = await FaceLandmarker.createFromOptions(resolverInstance, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'CPU',
      },
      outputFaceBlendshapes: true,
      runningMode: 'IMAGE',
      numFaces: 1,
    });
    return landmarkerInstance;
  }
}

/**
 * Helper to sample RGB patch from canvas and return median hex color.
 */
function samplePatchColor(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number = 3
): string {
  const x = Math.max(0, Math.floor(centerX - radius));
  const y = Math.max(0, Math.floor(centerY - radius));
  const size = radius * 2 + 1;

  try {
    const imgData = ctx.getImageData(x, y, size, size).data;
    let r = 0, g = 0, b = 0, count = 0;

    for (let i = 0; i < imgData.length; i += 4) {
      // Exclude overexposed highlights and extreme shadows
      const pr = imgData[i];
      const pg = imgData[i + 1];
      const pb = imgData[i + 2];
      const lum = 0.299 * pr + 0.587 * pg + 0.114 * pb;

      if (lum > 20 && lum < 245) {
        r += pr;
        g += pg;
        b += pb;
        count++;
      }
    }

    if (count === 0) return '#D4A373'; // Warm natural skin fallback

    const avgR = Math.round(r / count);
    const avgG = Math.round(g / count);
    const avgB = Math.round(b / count);

    return `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;
  } catch {
    return '#D4A373';
  }
}

/**
 * Detects face using MediaPipe Face Landmarker in-browser,
 * samples skin tone and hair color, logs them, and deletes the photo from memory.
 */
export async function detectFaceAndAttributes(
  imageSource: File | HTMLImageElement | string
): Promise<FaceAttributesResult> {
  let img: HTMLImageElement | null = null;
  let objectUrl: string | null = null;

  try {
    // 1. Prepare image element
    if (typeof imageSource === 'string') {
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageSource;
      await new Promise((res, rej) => {
        img!.onload = res;
        img!.onerror = () => rej(new Error('Failed to load image'));
      });
    } else if (imageSource instanceof File) {
      objectUrl = URL.createObjectURL(imageSource);
      img = new Image();
      img.src = objectUrl;
      await new Promise((res, rej) => {
        img!.onload = res;
        img!.onerror = () => rej(new Error('Failed to parse uploaded photo'));
      });
    } else {
      img = imageSource;
    }

    // 2. Initialize MediaPipe Face Landmarker
    const landmarker = await getFaceLandmarker();
    const result = landmarker.detect(img);

    // 3. Error handling: Show error if no face is found
    if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
      throw new Error('No face found in the uploaded photo. Please upload a clear, front-facing portrait.');
    }

    const landmarks = result.faceLandmarks[0];
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    // 4. Draw to offscreen canvas for color sampling
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      throw new Error('Unable to create canvas context for color sampling');
    }

    ctx.drawImage(img, 0, 0, width, height);

    // 5. Sample Skin Tone
    // Landmarks: 151 (forehead center), 234 (left cheek), 454 (right cheek), 1 (nose bridge)
    const forehead = landmarks[151] || landmarks[10];
    const leftCheek = landmarks[234] || landmarks[117];
    const rightCheek = landmarks[454] || landmarks[347];

    const skin1 = samplePatchColor(ctx, forehead.x * width, forehead.y * height, 4);
    const skin2 = samplePatchColor(ctx, leftCheek.x * width, leftCheek.y * height, 4);
    const skin3 = samplePatchColor(ctx, rightCheek.x * width, rightCheek.y * height, 4);

    // Pick cheek sample as primary skin tone
    const detectedSkin = skin2 || skin1 || skin3 || '#F3D2B8';

    // 6. Sample Hair Color
    // Sample above top of forehead (landmark 10)
    const topOfForehead = landmarks[10];
    const hairSampleX = topOfForehead.x * width;
    const hairSampleY = Math.max(4, (topOfForehead.y - 0.07) * height);
    const detectedHair = samplePatchColor(ctx, hairSampleX, hairSampleY, 5);

    // 7. Heuristic for Glasses & HairStyle
    // Landmark 168 is nose bridge; compare with eye inner corners 133 & 362
    const bridgeY = landmarks[168].y * height;
    const bridgeX = landmarks[168].x * width;
    const bridgeColor = samplePatchColor(ctx, bridgeX, bridgeY, 2);

    // Check if bridge color is significantly darker/distinct from skin
    const glasses = Boolean(
      result.faceBlendshapes && result.faceBlendshapes.length > 0 &&
      Math.abs(parseInt(bridgeColor.slice(1, 3), 16) - parseInt(detectedSkin.slice(1, 3), 16)) > 45
    );

    // Estimate hairStyle by face aspect ratio
    const chin = landmarks[152];
    const faceHeightRatio = (chin.y - topOfForehead.y);
    const hairStyle: 'short' | 'wavy' | 'curly' | 'long' = faceHeightRatio > 0.45 ? 'wavy' : 'short';

    // 8. Log the detected attributes as required
    console.log('====================================');
    console.log('🤖 MediaPipe Face Landmarker Detected:');
    console.log('Detected Skin:', detectedSkin);
    console.log('Detected Hair:', detectedHair);
    console.log('Detected HairStyle:', hairStyle);
    console.log('Detected Glasses:', glasses);
    console.log('====================================');

    // 9. Wipe and delete canvas & photo from memory immediately
    ctx.clearRect(0, 0, width, height);
    canvas.width = 0;
    canvas.height = 0;

    return {
      detectedSkin,
      detectedHair,
      hairStyle,
      glasses,
      confidence: 0.95,
    };
  } finally {
    // Zero-out photo from memory
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
    if (img) {
      img.src = '';
      img.onload = null;
      img.onerror = null;
      img = null;
    }
  }
}
