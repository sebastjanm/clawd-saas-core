import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import crypto from 'crypto';
import { requireAuth } from '@/lib/server/auth';

// Luma Dream Machine (via Fal)
const FAL_KEY = process.env.FAL_KEY;
const FAL_API_URL = 'https://fal.run/fal-ai/luma-dream-machine'; 

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const formData = await req.formData();
    const prompt = formData.get('prompt') as string;
    const mode = formData.get('mode') as string || 'text_to_video';
    const aspectRatio = formData.get('aspect_ratio') as string || '16:9';
    const loop = formData.get('loop') === 'true';

    // Image Input
    // If 'image_url' exists, use it for Img2Vid
    const imageUrl = formData.get('image_url') as string;

    if (!FAL_KEY) {
        return NextResponse.json({ error: 'FAL_KEY missing' }, { status: 500 });
    }

    if (!prompt && mode === 'text_to_video') {
        return NextResponse.json({ error: 'Prompt required' }, { status: 400 });
    }

    const payload: any = {
      prompt: prompt,
      aspect_ratio: aspectRatio,
      loop: loop
    };

    if (mode === 'image_to_video' && imageUrl) {
       payload.image_url = imageUrl;
    }

    // Call Fal.ai
    console.log('[VIDEO] Calling Fal Luma:', JSON.stringify(payload));
    
    const res = await fetch(FAL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    
    if (!res.ok) {
       console.error('[VIDEO] Fal Error:', data);
       return NextResponse.json({ error: data.detail || 'Fal.ai Error' }, { status: res.status });
    }

    // Luma response: { video: { url: "..." } }
    const videoUrl = data.video?.url || data.url;

    if (!videoUrl) {
       return NextResponse.json({ error: 'No video URL returned' }, { status: 500 });
    }

    // Save to DB
    const id = crypto.randomUUID();
    const settings = { mode, aspectRatio, loop };
    
    try {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO tool_generations (id, tool, provider, model, prompt, settings, output_path, created_at)
            VALUES (?, 'video', 'fal-luma', 'dream-machine', ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        stmt.run(id, prompt, JSON.stringify(settings), videoUrl);
    } catch (e) {
        console.error('DB Save Error:', e);
    }

    return NextResponse.json({ url: videoUrl, id });

  } catch (error: any) {
    console.error('[VIDEO] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
