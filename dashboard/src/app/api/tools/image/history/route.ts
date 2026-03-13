import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT output_path FROM tool_generations WHERE tool = \'image\' ORDER BY created_at DESC LIMIT 50').all();
    
    // Extract just the URLs for the frontend
    const images = rows.map((r: any) => r.output_path);
    
    return NextResponse.json(images);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
