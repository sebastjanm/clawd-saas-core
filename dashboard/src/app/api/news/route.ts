import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse } from '@/lib/errors';
import { getDb } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

function ensureTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS news_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project TEXT,
      title TEXT NOT NULL,
      summary TEXT,
      source TEXT,
      url TEXT,
      relevance TEXT DEFAULT 'medium' CHECK(relevance IN ('high', 'medium', 'low')),
      category TEXT DEFAULT 'general',
      read BOOLEAN DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  return db;
}

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const db = ensureTable();
    const items = db.prepare(
      'SELECT * FROM news_alerts ORDER BY read ASC, relevance = \'high\' DESC, created_at DESC LIMIT 100'
    ).all();
    return NextResponse.json({ items });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAuth(request);
    const { id, read } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const db = ensureTable();
    db.prepare('UPDATE news_alerts SET read = ? WHERE id = ?').run(read ? 1 : 0, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(request);
    const { project, title, summary, source, url, relevance, category } = await request.json();
    if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });

    const db = ensureTable();
    const result = db.prepare(
      'INSERT INTO news_alerts (project, title, summary, source, url, relevance, category) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(project || null, title, summary || null, source || null, url || null, relevance || 'medium', category || 'general');

    return NextResponse.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    return errorResponse(err);
  }
}
