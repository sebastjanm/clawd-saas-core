import { NextRequest, NextResponse } from 'next/server';

// Allow large video uploads (up to 2 minutes for slow connections)
export const maxDuration = 120;
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { requireAuth } from '@/lib/server/auth';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'subtitles');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const id = crypto.randomUUID();
    const ext = path.extname(file.name);
    const filename = `${id}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.promises.writeFile(filePath, buffer);

    return NextResponse.json({
      id,
      url: `/uploads/subtitles/${filename}`,
      name: file.name,
      size: file.size,
    });
  } catch (error: any) {
    console.error('[Subtitles Upload] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
