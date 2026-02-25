import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { getSystemHealth } from '@/lib/server/system';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    requireAuth(request);
    const health = getSystemHealth();
    return NextResponse.json(health);
  } catch (error) {
    return errorResponse(error);
  }
}
