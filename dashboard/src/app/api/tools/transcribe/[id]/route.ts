import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';

const SONIOX_API_URL = 'https://api.soniox.com/v1';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    
    const apiKey = process.env.SONIX_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'SONIX_API_KEY not configured' }, { status: 500 });
    }

    // 1. Check Job Status
    const res = await fetch(`${SONIOX_API_URL}/transcriptions/${id}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      if (res.status === 404) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      const errText = await res.text();
      return NextResponse.json({ error: `Soniox check failed: ${errText}` }, { status: res.status });
    }

    const data = await res.json();
    console.log('[Soniox] Status check:', id, data.status);

    if (data.status === 'COMPLETED') {
      // 2. Fetch Transcript
      const transcriptRes = await fetch(`${SONIOX_API_URL}/transcriptions/${id}/transcript`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      
      let text = '';
      if (transcriptRes.ok) {
        const transcriptData = await transcriptRes.json();
        // Convert to text
        if (transcriptData.segments) {
          text = transcriptData.segments.map((s: any) => s.text).join(' ');
        } else if (transcriptData.words) {
           text = transcriptData.words.map((w: any) => w.text).join(' ');
        } else {
          text = JSON.stringify(transcriptData);
        }
      }

      // 3. Save to Disk
      const filename = `${id}.txt`;
      const publicDir = path.join(process.cwd(), 'public', 'transcripts');
      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
      
      const filepath = path.join(publicDir, filename);
      // Only write if not exists or update
      await fs.promises.writeFile(filepath, text);
      
      // 4. Save to DB (Idempotent)
      try {
        const db = getDb();
        // Check existence
        const exists = db.prepare('SELECT id FROM tool_generations WHERE id = ?').get(id);
        
        if (!exists) {
          const prompt = data.media_url || `File: ${data.media_id}` || 'Audio Transcription';
          const settings = { 
            duration: data.duration, 
            model: data.model,
            lang: data.language
          };
          
          const stmt = db.prepare(`
            INSERT INTO tool_generations (id, tool, provider, model, prompt, settings, output_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `);
          stmt.run(id, 'stt', 'soniox', data.model || 'stt-async-v4', prompt, JSON.stringify(settings), `/api/transcripts/${filename}`);
          console.log('[Soniox] Saved job to DB:', id);
        }
      } catch (e) {
        console.error('[Soniox] DB Save Error:', e);
      }

      return NextResponse.json({ status: 'completed', text: text, url: `/api/transcripts/${filename}` });
    }

    if (data.status === 'FAILED') {
      return NextResponse.json({ status: 'failed', error: data.error_message || 'Job Failed' });
    }

    return NextResponse.json({ status: 'processing' });

  } catch (error: any) {
    console.error('[Transcript] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
