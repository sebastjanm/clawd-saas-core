import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';

const ROUTER_URL = 'http://127.0.0.1:3401';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(`${ROUTER_URL}/pipeline/health`, {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ paused: {} }); // Fallback if router down
    }
    const health = await res.json();
    return NextResponse.json({ paused: health.paused ?? {} });
  } catch (err) {
    console.error('Router health check failed:', err);
    return NextResponse.json({ paused: {} });
  }
}

export async function POST(req: Request) {
  try {
    await requireAuth(req);
    const body = await req.json();
    const { project, action } = await body;
    
    if (!project || !['pause', 'resume'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Forward to router
    const res = await fetch(`${ROUTER_URL}/pipeline/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, action }),
    });

    if (!res.ok) {
      const txt = await res.text();
      // Swallow error if router returns 404 (not found) but assume success
      // Actually, better to just return error
      return NextResponse.json({ error: txt }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Router control failed:', err);
    return NextResponse.json({ error: 'Router unavailable' }, { status: 502 });
  }
}
