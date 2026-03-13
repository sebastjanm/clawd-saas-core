import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';

// --- Configuration ---
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict';
// Fal.ai endpoints
const FAL_FLUX_PRO = 'fal-ai/flux-pro/v1.1';
const FAL_FLUX_DEV = 'fal-ai/flux/dev';
const FAL_FLUX_SCHNELL = 'fal-ai/flux/schnell';
const FAL_REMOVE_BG = 'fal-ai/imageutils/remove-background';
const FAL_UPSCALE = 'fal-ai/imageutils/upscale';

// Helper: Save Base64/Buffer to Public File
async function saveImage(buffer: Buffer, ext: string = 'png'): Promise<string> {
  const filename = `img-${crypto.randomUUID()}.${ext}`;
  const publicDir = path.join(process.cwd(), 'public', 'generated');
  
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  const filepath = path.join(publicDir, filename);
  await fs.promises.writeFile(filepath, buffer);
  
  return `/api/generated/${filename}`;
}

// Helper: Save to DB
function saveToDb(id: string, provider: string, model: string, prompt: string, settings: any, output: string) {
  try {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO tool_generations (id, tool, provider, model, prompt, settings, output_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(id, 'image', provider, model, prompt, JSON.stringify(settings), output);
  } catch (e) {
    console.error('DB Save Failed:', e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const formData = await req.formData();
    const provider = formData.get('provider') as string;
    const action = formData.get('action') as string;
    const prompt = formData.get('prompt') as string;
    const model = formData.get('model') as string;
    const aspectRatio = formData.get('aspect_ratio') as string;
    const count = parseInt(formData.get('count') as string || '1');
    const imageFile = formData.get('image') as File | null;
    const imageUrl = formData.get('image_url') as string | null;
    const format = formData.get('format') as string || 'png';

    const settings = { action, aspectRatio, count, format };

    // --- Gemini (Imagen 4.0) ---
    if (provider === 'gemini') {
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) return NextResponse.json({ error: 'Gemini API Key missing' }, { status: 500 });

      const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { aspectRatio: aspectRatio || '1:1', sampleCount: count }
        })
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('Gemini API Error:', err);
        return NextResponse.json({ error: `Gemini Error: ${err}` }, { status: res.status });
      }

      const data = await res.json();
      const savedUrls: string[] = [];

      if (data.predictions) {
        for (const p of data.predictions) {
          if (p.bytesBase64Encoded || p.bytes) {
            const buffer = Buffer.from(p.bytesBase64Encoded || p.bytes, 'base64');
            const url = await saveImage(buffer, 'png');
            savedUrls.push(url);
            saveToDb(crypto.randomUUID(), 'gemini', model, prompt, settings, url);
          }
        }
      }

      if (savedUrls.length === 0) return NextResponse.json({ error: 'No images generated (Safety Filter?)', raw: data }, { status: 400 });
      return NextResponse.json({ images: savedUrls });
    }

    // --- Fal.ai ---
    if (provider === 'fal') {
      const apiKey = process.env.FAL_KEY;
      if (!apiKey) return NextResponse.json({ error: 'Fal.ai Key missing' }, { status: 500 });

      let endpoint = FAL_FLUX_DEV; // Default
      let body: any = {};

      if (action === 'generate') {
        if (model === 'flux-schnell') endpoint = FAL_FLUX_SCHNELL;
        else if (model === 'flux-pro') endpoint = FAL_FLUX_PRO;
        else endpoint = FAL_FLUX_DEV;

        let image_size = 'square_hd';
        // Map Aspect Ratio
        if (aspectRatio === '16:9') image_size = 'landscape_16_9';
        else if (aspectRatio === '9:16') image_size = 'portrait_16_9';
        else if (aspectRatio === '4:3') image_size = 'landscape_4_3';
        else if (aspectRatio === '3:4') image_size = 'portrait_4_3';
        // Flux Pro supports raw aspect ratios? usually just specific enums.
        // Stick to fal-recommended enums for now or pass w/h if supported.

        body = { prompt, image_size, num_images: count, enable_safety_checker: false, output_format: format };
      } 
      // ... (Add other actions logic if needed, simplified for brevity but keeping existing paths)
      else if (action === 'remove-bg') {
        endpoint = FAL_REMOVE_BG;
        if (imageUrl) body = { image_url: imageUrl };
        else return NextResponse.json({ error: 'Image URL required' }, { status: 400 });
      } else if (action === 'upscale') {
        endpoint = FAL_UPSCALE;
        if (imageUrl) body = { image_url: imageUrl, scale: 2 };
        else return NextResponse.json({ error: 'Image URL required' }, { status: 400 });
      }

      const res = await fetch(`https://fal.run/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `Fal Error: ${err}` }, { status: res.status });
      }

      const data = await res.json();
      let images: string[] = [];
      
      if (data.images) images = data.images.map((img: any) => img.url);
      else if (data.image) images = [data.image.url];

      // Save Fal results to DB (URLs are remote, that's fine)
      images.forEach(url => {
        saveToDb(crypto.randomUUID(), 'fal', model, prompt, settings, url);
      });

      return NextResponse.json({ images, raw: data });
    }

    return NextResponse.json({ error: 'Provider not supported' }, { status: 400 });

  } catch (error: any) {
    console.error('[Image Tool] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
