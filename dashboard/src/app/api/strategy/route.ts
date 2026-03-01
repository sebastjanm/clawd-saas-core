import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    requireAuth(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const project = searchParams.get('project');

    const db = getDb();
    let query = 'SELECT * FROM strategy_decisions WHERE 1=1';
    const params: any[] = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (project) {
      query += ' AND project = ?';
      params.push(project);
    }

    query += ' ORDER BY created_at DESC';
    const decisions = db.prepare(query).all(...params);

    const stats = db
      .prepare('SELECT status, COUNT(*) as count FROM strategy_decisions GROUP BY status')
      .all() as Array<{ status: string; count: number }>;

    return NextResponse.json({ decisions, stats });
  } catch (error) {
    return errorResponse(error);
  }
}
