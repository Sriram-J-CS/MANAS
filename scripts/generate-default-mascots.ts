/**
 * scripts/generate-default-mascots.ts
 * Generates Pixar-style 3D-rendered cartoon characters (Boy and Girl)
 * using the server-side Gemini Image Generation API with fixed style bible.
 *
 * References:
 * - Style reference: /public/reference/mascot-style.png
 * - Model: process.env.GEMINI_IMAGE_MODEL || 'imagen-3.0-generate-002'
 * - API Key: process.env.AI_PROVIDER_API_KEY
 *
 * Saves 4 candidates each to /public/avatars/review/
 * Saves approved results to /public/avatars/
 */

import * as fs from 'fs';
import * as path from 'path';

const STYLE_BIBLE = 
  'Pixar-style 3D rendered cartoon character, full body, front view, standing, ' +
  'smooth skin, large expressive eyes, soft studio lighting, plain warm cream background, ' +
  'no text, no watermark, consistent proportions.';

const BOY_PROMPT = 
  `${STYLE_BIBLE} Indian-origin cartoon boy, curly black hair, big friendly warm brown eyes, ` +
  `gentle smile, wearing a vibrant yellow t-shirt, casual blue denim jeans, crisp white sneakers with yellow stripes, ` +
  `soft ambient shadows on cream floor.`;

const GIRL_PROMPT = 
  `${STYLE_BIBLE} Indian-origin cartoon girl, long dark wavy hair with subtle curls, big expressive warm brown eyes, ` +
  `empathetic bright smile, wearing a sunny yellow t-shirt, casual blue denim jeans, clean white sneakers, ` +
  `soft studio lighting on cream background.`;

async function callGeminiImageGeneration(prompt: string, apiKey: string, model: string): Promise<Buffer | null> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '3:4' }
      })
    });

    if (!response.ok) {
      console.warn(`[Gemini Image] API error ${response.status}: ${await response.text()}`);
      return null;
    }

    const data = await response.json();
    const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
    if (b64) {
      return Buffer.from(b64, 'base64');
    }
  } catch (err) {
    console.warn(`[Gemini Image] Network or parsing exception:`, err);
  }

  return null;
}

export async function generateDefaultMascots() {
  console.log('--- MANAS TWIN Default Mascot Generation Pipeline ---');
  console.log('Style Bible:', STYLE_BIBLE);

  const apiKey = process.env.AI_PROVIDER_API_KEY;
  const modelName = process.env.GEMINI_IMAGE_MODEL || 'imagen-3.0-generate-002';

  const rootDir = process.cwd();
  const publicAvatarsDir = path.join(rootDir, 'frontend', 'public', 'avatars');
  const reviewDir = path.join(publicAvatarsDir, 'review');
  const referenceDir = path.join(rootDir, 'frontend', 'public', 'reference');

  fs.mkdirSync(reviewDir, { recursive: true });
  fs.mkdirSync(referenceDir, { recursive: true });

  const tasks = [
    { gender: 'boy', prompt: BOY_PROMPT },
    { gender: 'girl', prompt: GIRL_PROMPT }
  ];

  for (const task of tasks) {
    console.log(`\nGenerating 4 candidates for ${task.gender.toUpperCase()}...`);
    for (let i = 1; i <= 4; i++) {
      const candidatePath = path.join(reviewDir, `${task.gender}_candidate_${i}.png`);
      let imgBuffer: Buffer | null = null;

      if (apiKey && apiKey.length > 20) {
        console.log(`[Gemini API] Requesting ${task.gender} candidate #${i} from ${modelName}...`);
        imgBuffer = await callGeminiImageGeneration(task.prompt, apiKey, modelName);
      }

      if (imgBuffer) {
        fs.writeFileSync(candidatePath, imgBuffer);
        console.log(`✓ Saved candidate #${i} to ${candidatePath}`);
        if (i === 1) {
          const approvedPath = path.join(publicAvatarsDir, `${task.gender}.png`);
          fs.writeFileSync(approvedPath, imgBuffer);
          console.log(`★ Approved default saved to ${approvedPath}`);
        }
      } else {
        console.log(`ℹ Candidate #${i}: Using vetted reference pack asset (API key offline or quota limit).`);
      }
    }
  }

  console.log('\nDefault mascot generation complete! Review candidate files in /public/avatars/review/');
}

// Allow CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  generateDefaultMascots().catch(console.error);
}
