import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const db = getDb();
    const article = db.prepare(`
      SELECT id, project, asset_type AS type, title, slug, abstract, status, final_md,
             published_at, created_at, updated_at
      FROM articles WHERE id = ?
    `).get(Number(id));

    if (!article) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ article });
  } catch (error) {
    return errorResponse(error);
  }
}
