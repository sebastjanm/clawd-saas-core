import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'all';
    
    // Convert 'type' filter: 'tts' -> 'tts', 'image' -> 'image', 'stt' -> 'stt'
    
    let query = 'SELECT * FROM tool_generations';
    const params: any[] = [];

    if (type !== 'all') {
      query += ' WHERE tool = ?';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const db = getDb();
    const rows = db.prepare(query).all(...params);
    const count = db.prepare('SELECT COUNT(*) as count FROM tool_generations').get() as { count: number };

    return NextResponse.json({
      data: rows,
      total: count.count,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
