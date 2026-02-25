import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse, NotFoundError } from '@/lib/errors';
import { AGENT_META } from '@/lib/types';
import type { AgentRun } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    // requireAuth(request);
    const { name } = await params;
    if (!(name in AGENT_META)) throw new NotFoundError('Agent');

    const db = getDb();
    const runs = db
      .prepare(
        'SELECT * FROM agent_runs WHERE agent_name = ? ORDER BY started_at DESC LIMIT 50',
      )
      .all(name) as AgentRun[];

    return NextResponse.json({
      agent: { name, ...AGENT_META[name] },
      runs,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
