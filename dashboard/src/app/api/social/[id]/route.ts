import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse, NotFoundError, ValidationError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['draft', 'awaiting_approval', 'approved', 'posted', 'rejected', 'failed'];

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = (await request.json()) as { status?: string; content?: string };

    const db = getDb();
    const existing = db
      .prepare('SELECT * FROM social_posts WHERE id = ?')
      .get(Number(id)) as any;
    if (!existing) throw new NotFoundError('Social post');

    if (body.status) {
      if (!VALID_STATUSES.includes(body.status)) {
        throw new ValidationError(`Invalid status: ${body.status}`);
      }
      db.prepare('UPDATE social_posts SET status = ? WHERE id = ?').run(
        body.status,
        Number(id),
      );
    }

    if (body.content !== undefined) {
      db.prepare('UPDATE social_posts SET content = ? WHERE id = ?').run(
        body.content,
        Number(id),
      );
    }

    const updated = db
      .prepare('SELECT * FROM social_posts WHERE id = ?')
      .get(Number(id));
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
}
