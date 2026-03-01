import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse } from '@/lib/errors';
import { getCronJobs } from '@/lib/server/cron';

export const dynamic = 'force-dynamic';

const DAILY_JOB_IDS = [
  'cf5262ea-bee8-498d-b615-c44d65488b3f', // Oti silver
  '119b883b-4844-48b9-b954-4f7edd98a66b', // Oti baseman
  '4fdb8605-2ff2-49c8-a300-8840c9e066fc', // Oti a2go
  '13d8409f-b873-415e-b16b-3fd25fb99ea3', // Liso
  'ff39b38f-b0e5-4eef-ba64-7d5e0a127909', // Pino silver
  'e1f3ff3a-eee1-4be9-8a74-a22ad0adf7ed', // Medo
  'ecc1585b-404d-4af1-88e8-b4ee660c9be2', // briefing
  '9d481c0e-6642-434f-81c7-a583599112ec', // Bea
  '6fc7c3cb-347d-4f26-af7b-8ac8f8806f07', // Maci
  '6967e68c-fbbe-4eb3-b379-94101e63e151', // backup
];

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const db = getDb();
    const cronJobs = getCronJobs();

    const nowMs = Date.now();
    const staleMs = 26 * 60 * 60 * 1000;

    const staleDaily = cronJobs
      .filter((j) => DAILY_JOB_IDS.includes(j.id))
      .filter((j) => {
        const last = j.state?.lastRunAtMs ?? 0;
        return last > 0 && nowMs - last > staleMs;
      })
      .map((j) => ({ id: j.id, name: j.name ?? j.label ?? j.id }));

    const errorJobs = cronJobs
      .filter((j) => (j.state?.consecutiveErrors ?? 0) > 0)
      .map((j) => ({ id: j.id, name: j.name ?? j.label ?? j.id, consecutiveErrors: j.state?.consecutiveErrors ?? 0 }));

    const usageIntegrity = db
      .prepare(
        `SELECT
          COUNT(*) as totalRows,
          SUM(CASE WHEN status='ok' AND (tokens_in IS NULL OR tokens_out IS NULL) THEN 1 ELSE 0 END) as missingTokens,
          SUM(CASE WHEN status='ok' AND (project IS NULL OR project='') THEN 1 ELSE 0 END) as missingProject,
          SUM(CASE WHEN duration_ms IS NULL OR duration_ms < 0 THEN 1 ELSE 0 END) as invalidDuration
        FROM agent_runs
        WHERE started_at > datetime('now', '-7 day')`,
      )
      .get() as {
      totalRows: number;
      missingTokens: number;
      missingProject: number;
      invalidDuration: number;
    };

    const articleFlow = db
      .prepare(
        `SELECT
          SUM(CASE WHEN status='review' THEN 1 ELSE 0 END) as review,
          SUM(CASE WHEN status='ready_for_design' THEN 1 ELSE 0 END) as readyForDesign,
          SUM(CASE WHEN status='ready' THEN 1 ELSE 0 END) as ready,
          SUM(CASE WHEN status='awaiting_approval' THEN 1 ELSE 0 END) as awaitingApproval
        FROM articles`,
      )
      .get() as {
      review: number;
      readyForDesign: number;
      ready: number;
      awaitingApproval: number;
    };

    const issues: string[] = [];
    if (staleDaily.length > 0) issues.push(`${staleDaily.length} daily cron jobs stale`);
    if (errorJobs.length > 0) issues.push(`${errorJobs.length} cron jobs with consecutive errors`);
    if ((usageIntegrity.missingProject ?? 0) > 0) issues.push(`${usageIntegrity.missingProject} recent runs missing project`);
    if ((usageIntegrity.invalidDuration ?? 0) > 0) issues.push(`${usageIntegrity.invalidDuration} runs with invalid duration`);

    return NextResponse.json({
      status: issues.length === 0 ? 'ok' : 'degraded',
      checkedAt: new Date().toISOString(),
      issues,
      checks: {
        staleDaily,
        errorJobs,
        usageIntegrity,
        articleFlow,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
