import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse } from '@/lib/errors';
import { z } from 'zod';
import type { AgentRun } from '@/lib/types';

export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  agent: z.string().optional(),
  project: z.string().optional(),
  days: z.coerce.number().int().min(1).max(365).default(7),
});

// Cost per 1M tokens (approximate)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  opus: { input: 15, output: 75 },
  sonnet: { input: 3, output: 15 },
  haiku: { input: 0.25, output: 1.25 },
  kimi: { input: 0.5, output: 2 },
};

function getModelBucket(model?: string | null): keyof typeof MODEL_COSTS {
  const m = (model ?? '').toLowerCase();
  if (m.includes('opus')) return 'opus';
  if (m.includes('haiku') || m.includes('kimi')) return 'haiku';
  if (m.includes('sonnet') || m.includes('codex') || m.includes('gpt')) return 'sonnet';
  return 'sonnet';
}

function estimateCost(tokensIn: number, tokensOut: number, model?: string | null): number {
  const bucket = getModelBucket(model);
  const costs = MODEL_COSTS[bucket];
  return (tokensIn / 1_000_000) * costs.input + (tokensOut / 1_000_000) * costs.output;
}

export async function GET(request: Request) {
  try {
    requireAuth(request);

    const url = new URL(request.url);
    const parsed = QuerySchema.safeParse({
      agent: url.searchParams.get('agent') ?? undefined,
      project: url.searchParams.get('project') ?? undefined,
      days: url.searchParams.get('days') ?? 7,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(', '), code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    const { agent, project, days } = parsed.data;
    const db = getDb();

    const conditions: string[] = [`ar.started_at > datetime('now', '-${days} days')`];
    const params: string[] = [];

    if (agent) {
      conditions.push('ar.agent_name = ?');
      params.push(agent);
    }
    if (project) {
      conditions.push("COALESCE(ar.project, a.project) = ?");
      params.push(project);
    }

    const where = conditions.join(' AND ');

    const runs = db
      .prepare(`
        SELECT
          ar.id,
          ar.agent_name,
          ar.agent_type,
          ar.job_id,
          ar.session_key,
          ar.status,
          ar.task_summary,
          ar.article_id,
          COALESCE(ar.project, a.project) as project,
          ar.started_at,
          ar.finished_at,
          ar.duration_ms,
          ar.tokens_in,
          ar.tokens_out,
          ar.model,
          ar.error,
          ar.created_at
        FROM agent_runs ar
        LEFT JOIN articles a ON a.id = ar.article_id
        WHERE ${where}
        ORDER BY ar.started_at DESC
        LIMIT 500
      `)
      .all(...params) as AgentRun[];

    const summaryRow = db
      .prepare(
        `SELECT
          COUNT(*) as totalRuns,
          COALESCE(SUM(ar.tokens_in), 0) as totalTokensIn,
          COALESCE(SUM(ar.tokens_out), 0) as totalTokensOut,
          COALESCE(SUM(ar.duration_ms), 0) as totalDurationMs
        FROM agent_runs ar
        LEFT JOIN articles a ON a.id = ar.article_id
        WHERE ${where}`,
      )
      .get(...params) as {
        totalRuns: number;
        totalTokensIn: number;
        totalTokensOut: number;
        totalDurationMs: number;
      };

    const coverageRow = db
      .prepare(
        `SELECT MIN(ar.started_at) as firstRunAt, MAX(ar.started_at) as lastRunAt, COUNT(*) as totalRows
         FROM agent_runs ar`,
      )
      .get() as {
        firstRunAt: string | null;
        lastRunAt: string | null;
        totalRows: number;
      };

    const estimatedCost = runs.reduce((sum, run) => {
      return sum + estimateCost(run.tokens_in ?? 0, run.tokens_out ?? 0, run.model ?? null);
    }, 0);

    // Per-model breakdown
    const modelBreakdown = db
      .prepare(
        `SELECT
          ar.model,
          COUNT(*) as runs,
          COALESCE(SUM(ar.tokens_in), 0) as tokens_in,
          COALESCE(SUM(ar.tokens_out), 0) as tokens_out,
          COALESCE(SUM(ar.duration_ms), 0) as duration_ms
        FROM agent_runs ar
        LEFT JOIN articles a ON a.id = ar.article_id
        WHERE ${where}
        GROUP BY ar.model
        ORDER BY runs DESC`,
      )
      .all(...params) as {
        model: string | null;
        runs: number;
        tokens_in: number;
        tokens_out: number;
        duration_ms: number;
      }[];

    // Aggregate by normalized model bucket (opus/sonnet/haiku)
    const modelAgg: Record<string, { runs: number; tokens_in: number; tokens_out: number; duration_ms: number; estimatedCost: number }> = {};
    for (const row of modelBreakdown) {
      const bucket = getModelBucket(row.model);
      if (!modelAgg[bucket]) {
        modelAgg[bucket] = { runs: 0, tokens_in: 0, tokens_out: 0, duration_ms: 0, estimatedCost: 0 };
      }
      modelAgg[bucket].runs += row.runs;
      modelAgg[bucket].tokens_in += row.tokens_in;
      modelAgg[bucket].tokens_out += row.tokens_out;
      modelAgg[bucket].duration_ms += row.duration_ms;
      modelAgg[bucket].estimatedCost += estimateCost(row.tokens_in, row.tokens_out, row.model);
    }
    const modelCosts = Object.entries(modelAgg)
      .map(([model, stats]) => ({
        model,
        ...stats,
        estimatedCost: Math.round(stats.estimatedCost * 100) / 100,
      }))
      .sort((a, b) => b.estimatedCost - a.estimatedCost);

    // Unique projects from data
    const projectList = db
      .prepare(
        `SELECT DISTINCT COALESCE(ar.project, a.project) as project
         FROM agent_runs ar
         LEFT JOIN articles a ON a.id = ar.article_id
         WHERE COALESCE(ar.project, a.project) IS NOT NULL
         ORDER BY project`,
      )
      .all()
      .map((r) => (r as Record<string, unknown>).project as string);

    // Per-agent breakdown
    const agentBreakdown = db
      .prepare(
        `SELECT
          ar.agent_name as agent,
          COUNT(*) as runs,
          COALESCE(SUM(ar.tokens_in), 0) as tokens_in,
          COALESCE(SUM(ar.tokens_out), 0) as tokens_out,
          COALESCE(SUM(ar.duration_ms), 0) as duration_ms,
          ar.model
        FROM agent_runs ar
        WHERE ${where}
        GROUP BY ar.agent_name, ar.model
        ORDER BY runs DESC`,
      )
      .all(...params) as {
        agent: string;
        runs: number;
        tokens_in: number;
        tokens_out: number;
        duration_ms: number;
        model: string | null;
      }[];

    const agentCosts = agentBreakdown.reduce((acc, row) => {
      const cost = estimateCost(row.tokens_in, row.tokens_out, row.model);
      const key = row.agent;
      if (!acc[key]) {
        acc[key] = { runs: 0, tokens_in: 0, tokens_out: 0, duration_ms: 0, estimatedCost: 0 };
      }
      acc[key].runs += row.runs;
      acc[key].tokens_in += row.tokens_in;
      acc[key].tokens_out += row.tokens_out;
      acc[key].duration_ms += row.duration_ms;
      acc[key].estimatedCost += cost;
      return acc;
    }, {} as Record<string, { runs: number; tokens_in: number; tokens_out: number; duration_ms: number; estimatedCost: number }>);

    // Per-project breakdown
    const projectBreakdown = db
      .prepare(
        `SELECT
          COALESCE(ar.project, a.project) as project,
          COUNT(*) as runs,
          COALESCE(SUM(ar.tokens_in), 0) as tokens_in,
          COALESCE(SUM(ar.tokens_out), 0) as tokens_out,
          COALESCE(SUM(ar.duration_ms), 0) as duration_ms,
          ar.model
        FROM agent_runs ar
        LEFT JOIN articles a ON a.id = ar.article_id
        WHERE ${where}
        GROUP BY COALESCE(ar.project, a.project), ar.model
        ORDER BY runs DESC`,
      )
      .all(...params) as {
        project: string | null;
        runs: number;
        tokens_in: number;
        tokens_out: number;
        duration_ms: number;
        model: string | null;
      }[];

    const projectCosts = projectBreakdown.reduce((acc, row) => {
      const cost = estimateCost(row.tokens_in, row.tokens_out, row.model);
      const key = row.project || 'unknown';
      if (!acc[key]) {
        acc[key] = { runs: 0, tokens_in: 0, tokens_out: 0, duration_ms: 0, estimatedCost: 0 };
      }
      acc[key].runs += row.runs;
      acc[key].tokens_in += row.tokens_in;
      acc[key].tokens_out += row.tokens_out;
      acc[key].duration_ms += row.duration_ms;
      acc[key].estimatedCost += cost;
      return acc;
    }, {} as Record<string, { runs: number; tokens_in: number; tokens_out: number; duration_ms: number; estimatedCost: number }>);

    // Daily trend (cost + runs per day)
    const dailyTrend = db
      .prepare(
        `SELECT
          date(ar.started_at) as day,
          COUNT(*) as runs,
          COALESCE(SUM(ar.tokens_in), 0) as tokens_in,
          COALESCE(SUM(ar.tokens_out), 0) as tokens_out,
          ar.model
        FROM agent_runs ar
        LEFT JOIN articles a ON a.id = ar.article_id
        WHERE ${where}
        GROUP BY date(ar.started_at), ar.model
        ORDER BY day ASC`,
      )
      .all(...params) as {
        day: string;
        runs: number;
        tokens_in: number;
        tokens_out: number;
        model: string | null;
      }[];

    // Aggregate daily costs across models
    const dailyCosts = dailyTrend.reduce((acc, row) => {
      const cost = estimateCost(row.tokens_in, row.tokens_out, row.model);
      if (!acc[row.day]) {
        acc[row.day] = { day: row.day, runs: 0, cost: 0, tokens: 0 };
      }
      acc[row.day].runs += row.runs;
      acc[row.day].cost += cost;
      acc[row.day].tokens += row.tokens_in + row.tokens_out;
      return acc;
    }, {} as Record<string, { day: string; runs: number; cost: number; tokens: number }>);

    const trend = Object.values(dailyCosts)
      .sort((a, b) => a.day.localeCompare(b.day))
      .map(d => ({ ...d, cost: Math.round(d.cost * 100) / 100 }));

    // Period costs: today, 7d, 30d (always computed regardless of filter)
    function periodCost(daysBack: number): { cost: number; runs: number } {
      const since = new Date(Date.now() - daysBack * 86400000).toISOString();
      const rows = db
        .prepare(
          `SELECT COALESCE(SUM(tokens_in),0) as ti, COALESCE(SUM(tokens_out),0) as to2, model, COUNT(*) as cnt
           FROM agent_runs WHERE started_at >= ? GROUP BY model`,
        )
        .all(since) as { ti: number; to2: number; model: string | null; cnt: number }[];
      let cost = 0;
      let runs = 0;
      for (const r of rows) {
        cost += estimateCost(r.ti, r.to2, r.model);
        runs += r.cnt;
      }
      return { cost: Math.round(cost * 100) / 100, runs };
    }

    const periods = {
      today: periodCost(1),
      week: periodCost(7),
      month: periodCost(30),
    };

    return NextResponse.json({
      runs,
      summary: {
        ...summaryRow,
        estimatedCost: Math.round(estimatedCost * 100) / 100,
      },
      periods,
      modelCosts,
      agentCosts: Object.entries(agentCosts).map(([agent, stats]) => ({ agent, ...stats })).sort((a, b) => b.estimatedCost - a.estimatedCost),
      projectCosts: Object.entries(projectCosts).map(([project, stats]) => ({ project, ...stats })).sort((a, b) => b.estimatedCost - a.estimatedCost),
      trend,
      projects: projectList,
      coverage: coverageRow,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
