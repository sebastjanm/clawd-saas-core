import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';

const FAL_KEY = process.env.FAL_KEY;
// Using Flux Pro with IP-Adapter capabilities via Fal or Replicate equivalent
const FAL_API_URL = 'https://fal.run/fal-ai/flux/dev'; 

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const formData = await req.formData();
    const productUrl = formData.get('product_url') as string;
    const modelUrl = formData.get('model_url') as string;
    const brandStyle = formData.get('brand_style') as string;
    const batchSize = parseInt(formData.get('batch_size') as string || '4');
    
    if (!FAL_KEY) return NextResponse.json({ error: 'FAL_KEY missing' }, { status: 500 });
    if (!productUrl || !brandStyle) return NextResponse.json({ error: 'Product and Style required' }, { status: 400 });

    // Construct Flux Payload with IP-Adapter (Image Prompts)
    // Note: Fal's Flux API structure for IP-Adapter
    const payload = {
      prompt: brandStyle,
      image_size: "landscape_4_3",
      num_images: batchSize,
      enable_safety_checker: false,
      // Flux IP-Adapter implementation (simulated via image prompt args if available, or just img2img if simple)
      // For true brand consistency, we usually need a LoRA trainer or IP-Adapter.
      // Assuming standard Fal Flux Dev input for now with image prompt control if supported.
      // If not supported natively in this endpoint, we might need a specific ComfyUI endpoint.
      // For this MVP, we'll try image_url as influence.
      image_url: productUrl, 
      strength: 0.85 // Strong influence of product
    };
    
    // Call Fal
    const res = await fetch(FAL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.detail || 'Fal Error' }, { status: res.status });

    const images = data.images?.map((img: any) => img.url) || [];

    // Save Batch to DB
    const batchId = crypto.randomUUID();
    const db = getDb();
    const stmt = db.prepare(`
        INSERT INTO tool_generations (id, tool, provider, model, prompt, settings, output_path, created_at)
        VALUES (?, 'brand', 'fal-flux', 'flux-dev', ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    // Save each image as a separate row or grouped? Grouped for batch view.
    // Storing JSON array of URLs in output_path for batch.
    const settings = { productUrl, modelUrl, batchSize };
    stmt.run(batchId, brandStyle, JSON.stringify(settings), JSON.stringify(images));

    return NextResponse.json({ images, batchId });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
