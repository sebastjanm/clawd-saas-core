import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';

const ELEVEN_API_URL = 'https://api.elevenlabs.io/v1';

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const formData = await req.formData();
    const text = formData.get('text') as string;
    const voiceId = formData.get('voice_id') as string;
    const modelId = formData.get('model_id') as string || 'eleven_multilingual_v2';
    const type = formData.get('type') as string || 'speech'; // speech | sfx
    const outputFormat = formData.get('output_format') as string || 'mp3_44100_128';

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'ELEVENLABS_API_KEY missing' }, { status: 500 });

    if (!text) return NextResponse.json({ error: 'Text required' }, { status: 400 });

    let audioBuffer: ArrayBuffer;
    let endpoint = '';
    let body: any = {};
    let queryParams = '';

    if (type === 'sfx') {
        endpoint = `${ELEVEN_API_URL}/sound-generation`;
        body = { text, duration_seconds: undefined, prompt_influence: 0.3 };
    } else {
        endpoint = `${ELEVEN_API_URL}/text-to-speech/${voiceId}`;
        queryParams = `?output_format=${outputFormat}`;
        body = {
            text,
            model_id: modelId,
            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        };
    }

    // Call ElevenLabs
    const res = await fetch(endpoint + queryParams, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg' // Adjust based on format if needed, but audio/mpeg covers most
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `ElevenLabs Error: ${err}` }, { status: res.status });
    }

    audioBuffer = await res.arrayBuffer();

    // Determine extension
    let ext = 'mp3';
    if (outputFormat.includes('pcm')) ext = 'wav';
    if (outputFormat.includes('opus')) ext = 'opus'; // Browsers might need container, usually ogg/webm

    // Save to Disk
    const filename = `tts-${crypto.randomUUID()}.${ext}`;
    const publicDir = path.join(process.cwd(), 'public', 'audio');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    
    const filepath = path.join(publicDir, filename);
    await fs.promises.writeFile(filepath, Buffer.from(audioBuffer));
    const url = `/api/audio/${filename}`;

    // Save to DB
    try {
        const db = getDb();
        const settings = { voiceId, modelId, type, outputFormat };
        const stmt = db.prepare(`
            INSERT INTO tool_generations (id, tool, provider, model, prompt, settings, output_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        stmt.run(crypto.randomUUID(), 'tts', 'elevenlabs', modelId, text, JSON.stringify(settings), url);
    } catch (e) {
        console.error('DB Save Error:', e);
    }

    return NextResponse.json({ url, duration: 0 });

  } catch (error: any) {
    console.error('[TTS] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  await requireAuth(req);
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'No API Key' }, { status: 500 });

    try {
        const res = await fetch(`${ELEVEN_API_URL}/voices`, {
            headers: { 'xi-api-key': apiKey }
        });
        const data = await res.json();
        return NextResponse.json(data.voices);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
