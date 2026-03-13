import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse, NotFoundError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// GET: Fetch media for an article
export async function GET(
  request: Request,
  { params }: { params: Promise<{ articleId: string }> },
) {
  try {
    const { articleId } = await params;
    
    const db = getDb();
    const media = db
      .prepare('SELECT * FROM article_media WHERE article_id = ? ORDER BY created_at DESC')
      .all(Number(articleId));

    return NextResponse.json({ media });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST: Hobi (or anyone) saves a new image
export async function POST(
  request: Request,
  { params }: { params: Promise<{ articleId: string }> },
) {
  try {
    const { articleId } = await params;
    const body = await request.json();
    const { url, prompt, agent = 'hobi' } = body;

    const db = getDb();
    
    // Insert new media
    const result = db
      .prepare('INSERT INTO article_media (article_id, url, prompt, agent) VALUES (?, ?, ?, ?)')
      .run(Number(articleId), url, prompt, agent);

    // If it's Hobi, maybe auto-set as featured image? (Optional logic later)
    // For now, just save it.

    return NextResponse.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    return errorResponse(error);
  }
}
