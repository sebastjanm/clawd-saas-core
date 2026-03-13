import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter'); // 'baseman-alpha' | 'nakupsrebra' | null (all)

    const db = getDb();

    let query = `
      SELECT id, project, asset_type AS type, title, slug, abstract, status, final_md,
             published_at, created_at, updated_at
      FROM articles
      WHERE (project = 'baseman-alpha' OR asset_type = 'briefing')
    `;
    const params: any[] = [];

    if (filter === 'baseman-alpha') {
      query = `
        SELECT id, project, asset_type AS type, title, slug, abstract, status, final_md,
               published_at, created_at, updated_at
        FROM articles
        WHERE project = 'baseman-alpha'
      `;
    } else if (filter === 'nakupsrebra') {
      query = `
        SELECT id, project, asset_type AS type, title, slug, abstract, status, final_md,
               published_at, created_at, updated_at
        FROM articles
        WHERE project = 'nakupsrebra' AND asset_type = 'briefing'
      `;
    }

    query += ` ORDER BY COALESCE(published_at, updated_at, created_at) DESC LIMIT 100`;

    const articles = db.prepare(query).all(...params);
    return NextResponse.json({ articles });
  } catch (error) {
    return errorResponse(error);
  }
}
