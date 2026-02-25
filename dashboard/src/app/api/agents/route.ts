import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { getCronJobs } from '@/lib/server/cron';
import { errorResponse } from '@/lib/errors';
import { AGENT_META } from '@/lib/types';
import type { AgentRun, AgentStatus } from '@/lib/types';
import { findCronJobsForAgent, getMostRecentCronRun } from '@/lib/agentCron';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    requireAuth(request);
    const db = getDb();
    // In SaaS mode, we don't expose system cron jobs
    // const cronJobs = await getCronJobs();

    const agents: AgentStatus[] = Object.entries(AGENT_META).map(
      ([name, meta]) => {
        const lastRun = db
          .prepare(
            'SELECT * FROM agent_runs WHERE agent_name = ? ORDER BY started_at DESC LIMIT 1',
          )
          .get(name) as AgentRun | undefined;

        const stats = db
          .prepare(
            `SELECT 
              COUNT(*) as total,
              COALESCE(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END), 0) as errors
            FROM agent_runs 
            WHERE agent_name = ? AND started_at > datetime('now', '-1 day')`,
          )
          .get(name) as { total: number; errors: number };

        // Mock cron data for SaaS
        const agentCronJobs: any[] = []; 
        const mostRecentCron = null;

        const totalConsecutiveErrors = 0;

        return {
          name,
          emoji: meta.emoji,
          role: meta.role,
          desc: meta.desc,
          type: meta.type,
          lastRun: lastRun ?? null,
          cronJob: mostRecentCron,
          cronJobs: agentCronJobs,
          runCount24h: stats.total,
          errorCount24h: stats.errors,
          consecutiveErrors: totalConsecutiveErrors,
        };
      },
    );

    return NextResponse.json({ agents });
  } catch (error) {
    return errorResponse(error);
  }
}
