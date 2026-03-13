import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/server/auth';
import { safePath } from '@/lib/server/safePath';
import { AuthError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw e;
  }

  try {
    const { filename } = await params;
    const baseDir = path.join(process.cwd(), 'public', 'audio');
    const filePath = safePath(baseDir, filename);

    if (!filePath || !fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 });
    }

    const fileBuffer = await fs.promises.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    
    let contentType = 'application/octet-stream';
    if (ext === '.mp3') contentType = 'audio/mpeg';
    if (ext === '.wav') contentType = 'audio/wav';
    if (ext === '.opus') contentType = 'audio/ogg';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
