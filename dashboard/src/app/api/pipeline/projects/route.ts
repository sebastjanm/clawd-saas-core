import { requireAuth } from '@/lib/server/auth';
import { errorResponse } from '@/lib/errors';
import { NextResponse } from 'next/server';

const ROUTER_URL = process.env.PIPELINE_ROUTER_URL || 'http://127.0.0.1:4001';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  console.log('📢 API CALL: /api/pipeline/projects');
  console.log('📢 ROUTER URL:', ROUTER_URL);
  
  try {
    requireAuth(request);
    const res = await fetch(`${ROUTER_URL}/pipeline/health`, {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store', // Force no cache
    });
    if (!res.ok) return NextResponse.json({ error: 'Router unavailable' }, { status: 502 });
    const health = await res.json();
    return NextResponse.json({ paused: health.paused ?? {} });
  } catch {
    return NextResponse.json({ error: 'Router unavailable' }, { status: 502 });
  }
}
