import { NextResponse } from 'next/server';

const ROUTER_URL = 'http://127.0.0.1:3401';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(`${ROUTER_URL}/pipeline/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return NextResponse.json({ error: 'Router unavailable' }, { status: 502 });
    const health = await res.json();
    return NextResponse.json({ paused: health.paused ?? {} });
  } catch {
    return NextResponse.json({ error: 'Router unavailable' }, { status: 502 });
  }
}
