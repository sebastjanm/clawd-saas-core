import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/server/auth';

const SONIOX_API_URL = 'https://api.soniox.com/v1';
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'subtitles');

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const { videoId, lang } = await req.json();

    if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 });

    const apiKey = process.env.SONIX_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'SONIX_API_KEY not configured' }, { status: 500 });

    // Find the video file
    const files = await fs.promises.readdir(UPLOAD_DIR);
    const videoFile = files.find(f => f.startsWith(videoId));
    if (!videoFile) return NextResponse.json({ error: 'Video not found' }, { status: 404 });

    const videoPath = path.join(UPLOAD_DIR, videoFile);

    // Upload file to Soniox
    const fileBuffer = await fs.promises.readFile(videoPath);
    const blob = new Blob([fileBuffer], { type: 'video/mp4' });
    const uploadForm = new FormData();
    uploadForm.append('file', blob, videoFile);

    const uploadRes = await fetch(`${SONIOX_API_URL}/files`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: uploadForm,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Soniox upload failed: ${err}`);
    }

    const uploadData = await uploadRes.json();

    // Start transcription with timestamps
    const transcribeBody: any = {
      model: 'stt-async-v4',
      file_id: uploadData.id,
      enable_language_identification: true,
      enable_endpoint_detection: true,
    };

    if (lang) {
      transcribeBody.language_hints = [lang];
    }

    const transcribeRes = await fetch(`${SONIOX_API_URL}/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transcribeBody),
    });

    if (!transcribeRes.ok) {
      const err = await transcribeRes.text();
      throw new Error(`Soniox transcription failed: ${err}`);
    }

    const transcribeData = await transcribeRes.json();

    return NextResponse.json({ id: transcribeData.id, status: 'queued' });

  } catch (error: any) {
    console.error('[Subtitles Transcribe] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
