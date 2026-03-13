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
    const baseDir = path.join(process.cwd(), 'public', 'transcripts');
    const filePath = safePath(baseDir, filename);

    if (!filePath || !fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
    }

    const fileBuffer = await fs.promises.readFile(filePath);
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
