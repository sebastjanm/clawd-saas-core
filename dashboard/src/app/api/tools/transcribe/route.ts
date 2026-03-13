import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import util from 'util';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';

const execAsync = util.promisify(exec);
const SONIOX_API_URL = 'https://api.soniox.com/v1';

// Ensure upload dir exists
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Ensure transcripts dir exists
const TRANSCRIPT_DIR = path.join(process.cwd(), 'public', 'transcripts');
if (!fs.existsSync(TRANSCRIPT_DIR)) fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true });

function saveJobToDb(id: string, provider: string, prompt: string, settings: any, outputPath: string | null) {
  try {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO tool_generations (id, tool, provider, model, prompt, settings, output_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(id, 'stt', provider, settings.model || 'default', prompt, JSON.stringify(settings), outputPath);
  } catch (e) {
    console.error('DB Save Error:', e);
  }
}

function updateJobOutput(id: string, outputPath: string) {
  try {
    const db = getDb();
    const stmt = db.prepare('UPDATE tool_generations SET output_path = ? WHERE id = ?');
    stmt.run(outputPath, id);
  } catch (e) {
    console.error('DB Update Error:', e);
  }
}

async function runWhisper(id: string, inputPath: string, lang: string) {
  try {
    const langArg = lang && lang !== 'auto' ? `--language ${lang}` : '';
    const cmd = `${process.env.WHISPER_CMD || '/home/clawdbot/.local/bin/whisper'} "${inputPath}" --model medium --output_dir "${TRANSCRIPT_DIR}" --output_format txt ${langArg}`;
    
    console.log('[Whisper] Running:', cmd);
    await execAsync(cmd);
    
    // Whisper outputs to {input_filename}.txt in output_dir
    // We need to rename/move it to {id}.txt to match our schema
    const originalName = path.basename(inputPath, path.extname(inputPath));
    const generatedFile = path.join(TRANSCRIPT_DIR, `${originalName}.txt`);
    const finalFile = path.join(TRANSCRIPT_DIR, `${id}.txt`);
    
    if (fs.existsSync(generatedFile)) {
      await fs.promises.rename(generatedFile, finalFile);
      updateJobOutput(id, `/api/transcripts/${id}.txt`);
      console.log('[Whisper] Completed:', id);
    } else {
      console.error('[Whisper] Output file missing:', generatedFile);
    }
    
    // Cleanup input
    fs.unlink(inputPath, () => {});
    
  } catch (e) {
    console.error('[Whisper] Failed:', e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const formData = await req.formData();
    const provider = formData.get('provider') as string || 'soniox';
    const file = formData.get('file') as File | null;
    const url = formData.get('url') as string | null;
    const lang = formData.get('lang') as string;
    const diarize = formData.get('diarize') === 'true';

    // --- WHISPER (Local) ---
    if (provider === 'whisper') {
      if (!file) return NextResponse.json({ error: 'Whisper requires a file upload' }, { status: 400 });
      
      const id = crypto.randomUUID();
      const ext = path.extname(file.name);
      const inputPath = path.join(UPLOAD_DIR, `${id}${ext}`);
      
      // Save file
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.promises.writeFile(inputPath, buffer);
      
      // Create Job in DB (Processing state implied by null output_path)
      saveJobToDb(id, 'whisper', file.name, { lang, diarize, model: 'medium' }, null);
      
      // Start background process
      runWhisper(id, inputPath, lang);
      
      return NextResponse.json({ id, status: 'queued', provider: 'whisper' });
    }

    // --- SONIOX (Cloud) ---
    const apiKey = process.env.SONIX_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'SONIX_API_KEY not configured' }, { status: 500 });

    let audioSource: { file_id?: string; audio_url?: string } = {};

    if (file) {
      const uploadForm = new FormData();
      uploadForm.append('file', file);
      const uploadRes = await fetch(`${SONIOX_API_URL}/files`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: uploadForm,
      });
      if (!uploadRes.ok) throw new Error(await uploadRes.text());
      const uploadData = await uploadRes.json();
      audioSource = { file_id: uploadData.id };
    } else if (url) {
      audioSource = { audio_url: url };
    }

    const transcribeBody = {
      model: 'stt-async-v4',
      ...audioSource,
      enable_speaker_diarization: diarize,
      enable_language_identification: true,
      language_hints: lang !== 'auto' ? [lang] : undefined,
    };

    const transcribeRes = await fetch(`${SONIOX_API_URL}/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transcribeBody),
    });

    if (!transcribeRes.ok) throw new Error(await transcribeRes.text());
    const transcribeData = await transcribeRes.json();
    
    // Note: We don't save Soniox job to DB here, we do it on completion in the GET route
    
    return NextResponse.json(transcribeData);

  } catch (error: any) {
    console.error('[Transcribe] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
