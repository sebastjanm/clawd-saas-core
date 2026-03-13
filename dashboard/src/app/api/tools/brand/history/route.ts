import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM tool_generations WHERE tool = 'brand' ORDER BY created_at DESC LIMIT 20").all();
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
