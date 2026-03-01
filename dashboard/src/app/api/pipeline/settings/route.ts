import { requireAuth } from '@/lib/server/auth';
import { errorResponse } from '@/lib/errors';
import { NextResponse } from 'next/server';

const ROUTER_URL = process.env.PIPELINE_ROUTER_URL || 'http://127.0.0.1:4001';

export async function GET(request: Request) {
  try {
    requireAuth(request);
    const res = await fetch(`${ROUTER_URL}/pipeline/settings`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: 'Router error' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to connect to router' }, { status: 500 });
  }
}
