import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse } from '@/lib/errors';
import type { Article } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const project = searchParams.get('project');
    const limit = parseInt(searchParams.get('limit') || '50');

    const db = getDb();
    let query = `
      SELECT id, project, title, slug, published_at, updated_at, status, published_url, angle, why_now, abstract
      FROM articles 
      WHERE status IN ('published', 'promoted')
    `;
    const params: any[] = [];

    if (project) {
      query += ` AND project = ?`;
      params.push(project);
    }

    query += ` ORDER BY published_at DESC LIMIT ?`;
    params.push(limit);

    const rows = db.prepare(query).all(...params) as any[];

    // Fallback logic if abstract is somehow still missing but angle/why_now exists
    const articles = rows.map(a => ({
      ...a,
      abstract: a.abstract || a.angle || a.why_now || ''
    }));

    return NextResponse.json({ articles });
  } catch (error) {
    return errorResponse(error);
  }
}
