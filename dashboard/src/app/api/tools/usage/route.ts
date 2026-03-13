import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const provider = searchParams.get('provider') || 'all';

    const db = getDb();
    
    let query = 'SELECT * FROM tool_generations';
    const params: any[] = [];
    const conditions: string[] = [];

    if (from) {
       conditions.push('created_at >= ?');
       params.push(from);
    }
    if (to) {
       conditions.push('created_at <= ?');
       params.push(to);
    }
    if (provider !== 'all') {
       conditions.push('provider = ?');
       params.push(provider);
    }

    if (conditions.length > 0) {
       query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC';

    const rows = db.prepare(query).all(...params);

    return NextResponse.json({ data: rows });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
