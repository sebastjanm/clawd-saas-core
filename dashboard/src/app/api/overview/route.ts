import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const db = getDb();

    // Pipeline status
    const statusCounts = db.prepare(
      "SELECT status, COUNT(*) as count FROM articles GROUP BY status"
    ).all() as Array<{ status: string; count: number }>;

    // Published this week
    const publishedThisWeek = db.prepare(
      "SELECT COUNT(*) as count FROM articles WHERE status = 'published' AND published_at > datetime('now', '-7 days')"
    ).get() as { count: number };

    // Published by project (all time)
    const byProject = db.prepare(
      "SELECT project, COUNT(*) as count FROM articles WHERE status IN ('published','promoted') GROUP BY project ORDER BY count DESC"
    ).all() as Array<{ project: string; count: number }>;

    // Published by project this week
    const byProjectWeek = db.prepare(
      "SELECT project, COUNT(*) as count FROM articles WHERE status IN ('published','promoted') AND published_at > datetime('now', '-7 days') GROUP BY project"
    ).all() as Array<{ project: string; count: number }>;

    // Avg pipeline time (created → published, last 30 days)
    const avgPipelineTime = db.prepare(
      "SELECT project, ROUND(AVG(julianday(published_at) - julianday(created_at)), 1) as avg_days FROM articles WHERE status IN ('published','promoted') AND published_at > datetime('now', '-30 days') GROUP BY project"
    ).all() as Array<{ project: string; avg_days: number }>;

    // Failure rate (last 30 days)
    const totalRecent = db.prepare(
      "SELECT COUNT(*) as count FROM articles WHERE created_at > datetime('now', '-30 days')"
    ).get() as { count: number };
    const failedRecent = db.prepare(
      "SELECT COUNT(*) as count FROM articles WHERE status = 'failed' AND created_at > datetime('now', '-30 days')"
    ).get() as { count: number };

    // Social posts stats
    const socialStats = db.prepare(
      "SELECT status, COUNT(*) as count FROM social_posts GROUP BY status"
    ).all() as Array<{ status: string; count: number }>;

    // Strategy decisions
    const strategyStats = db.prepare(
      "SELECT status, COUNT(*) as count FROM strategy_decisions GROUP BY status"
    ).all() as Array<{ status: string; count: number }>;

    // Agent runs this week
    const agentRunsWeek = db.prepare(
      "SELECT agent_name, COUNT(*) as runs, SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) as ok, SUM(CASE WHEN status != 'ok' THEN 1 ELSE 0 END) as failed FROM agent_runs WHERE started_at > datetime('now', '-7 days') GROUP BY agent_name ORDER BY runs DESC"
    ).all() as Array<{ agent_name: string; runs: number; ok: number; failed: number }>;

    // Token usage this week
    const tokenUsage = db.prepare(
      `SELECT 
        SUM(COALESCE(tokens_in,0) + COALESCE(tokens_out,0)) as total_tokens,
        0 as total_cost
      FROM agent_runs WHERE started_at > datetime('now', '-7 days')`
    ).get() as { total_tokens: number; total_cost: number };

    // Recent publishes (last 5)
    const recentPublishes = db.prepare(
      "SELECT id, project, title, published_at, published_url FROM articles WHERE status IN ('published','promoted') AND published_at IS NOT NULL ORDER BY published_at DESC LIMIT 5"
    ).all();

    // In-flight (active pipeline work)
    const inFlight = db.prepare(
      "SELECT status, project, COUNT(*) as count FROM articles WHERE status IN ('todo','writing','review','ready_for_design','ready','awaiting_approval') GROUP BY status, project ORDER BY status"
    ).all();

    // Daily publish trend (last 14 days)
    const dailyTrend = db.prepare(
      `SELECT date(published_at) as day, COUNT(*) as count 
       FROM articles WHERE status IN ('published','promoted') 
       AND published_at > datetime('now', '-14 days')
       GROUP BY date(published_at) ORDER BY day`
    ).all();

    return NextResponse.json({
      statusCounts,
      publishedThisWeek: publishedThisWeek.count,
      byProject,
      byProjectWeek,
      avgPipelineTime,
      failureRate: totalRecent.count > 0 ? Math.round((failedRecent.count / totalRecent.count) * 100) : 0,
      socialStats,
      strategyStats,
      agentRunsWeek,
      tokenUsage,
      recentPublishes,
      inFlight,
      dailyTrend,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
