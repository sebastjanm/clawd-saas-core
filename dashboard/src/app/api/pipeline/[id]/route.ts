import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse, NotFoundError, ValidationError } from '@/lib/errors';
import { UpdateArticleStatusSchema } from '@/lib/schemas';
import type { Article } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getDb();
    const article = db
      .prepare('SELECT * FROM articles WHERE id = ?')
      .get(Number(id)) as Article | undefined;
    if (!article) throw new NotFoundError('Article');
    return NextResponse.json(article);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = UpdateArticleStatusSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
    }

    const db = getDb();
    const existing = db
      .prepare('SELECT * FROM articles WHERE id = ?')
      .get(Number(id)) as Article | undefined;
    if (!existing) throw new NotFoundError('Article');

    db.prepare(
      "UPDATE articles SET status = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(parsed.data.status, Number(id));

    // Log the transition
    try {
      db.prepare(
        `INSERT INTO article_events (article_id, project, phase, event_type, agent, agent_type, detail, created_at)
         VALUES (?, ?, ?, 'status_change', 'dashboard', 'human', ?, datetime('now'))`,
      ).run(Number(id), existing.project, parsed.data.status, `${existing.status} → ${parsed.data.status}`);
    } catch {
      // Fallback to pipeline_log if article_events doesn't exist
      db.prepare(
        'INSERT INTO pipeline_log (article_id, agent, action, details) VALUES (?, ?, ?, ?)',
      ).run(Number(id), 'dashboard', 'status_change', `${existing.status} → ${parsed.data.status}`);
    }

    const updated = db
      .prepare('SELECT * FROM articles WHERE id = ?')
      .get(Number(id)) as Article;
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
}
