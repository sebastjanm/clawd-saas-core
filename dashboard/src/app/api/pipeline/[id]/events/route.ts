import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse, NotFoundError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAuth(request);
    const { id } = await params;
    const db = getDb();

    const article = db.prepare('SELECT id FROM articles WHERE id = ?').get(Number(id));
    if (!article) throw new NotFoundError('Article');

    const events = db
      .prepare(
        `SELECT id, article_id, project, phase, event_type, agent, agent_type, status, priority,
                blocked_reason, error_message, detail, metadata, created_at
         FROM article_events
         WHERE article_id = ?
         ORDER BY created_at DESC
         LIMIT 50`,
      )
      .all(Number(id));

    return NextResponse.json({ events });
  } catch (error) {
    return errorResponse(error);
  }
}
