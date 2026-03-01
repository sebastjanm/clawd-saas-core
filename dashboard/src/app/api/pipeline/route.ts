import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse } from '@/lib/errors';
import { ARTICLE_STATUSES } from '@/lib/schemas';
import type { Article, PipelineColumn } from '@/lib/types';
import { COLUMN_LABELS } from '@/lib/types';
export const dynamic = 'force-dynamic';

// Check if Pipeline Router is healthy
async function isRouterHealthy(): Promise<boolean> {
  try {
    const res = await fetch('http://127.0.0.1:3401/pipeline/health', {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}

// Fetch per-article agent status from Router
type AgentStatus = {
  semaphore: 'idle' | 'queued' | 'running' | 'blocked' | 'failed' | 'done';
  agent: string;
  agentName: string;
  agentEmoji: string;
  detail: string;
  runId?: string;
  startedAt?: number;
  retryCount?: number;
  lastEvent?: { event_type: string; agent: string; detail: string; created_at: string } | null;
  lastAgentRun?: { agent: string; status: string; finishedAt: string; durationMs: number; error: string | null } | null;
  blockedDiagnostic?: { reason: string; detail: string; blockingArticleId: number; suggestion: string } | null;
};

async function getAgentStatuses(): Promise<Record<string, AgentStatus>> {
  try {
    const res = await fetch('http://127.0.0.1:3401/pipeline/agents', {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const project = searchParams.get('project');

    const db = getDb();
    let articles: Article[];

    // Fetch active articles (not published/promoted) + recent published ones
    const limitPublished = 10;
    
    let query = `
      SELECT * FROM articles 
      WHERE status NOT IN ('published', 'promoted')
    `;
    const params: any[] = [];

    if (project) {
      query += ` AND project = ?`;
      params.push(project);
    }
    
    query += ` ORDER BY updated_at DESC`;
    
    const activeArticles = db.prepare(query).all(...params) as Article[];

    // Fetch recent published/promoted separately
    let pubQuery = `SELECT * FROM articles WHERE status IN ('published', 'promoted')`;
    const pubParams: any[] = [];

    if (project) {
      pubQuery += ` AND project = ?`;
      pubParams.push(project);
    }

    pubQuery += ` ORDER BY published_at DESC LIMIT ?`;
    pubParams.push(limitPublished);

    const recentPublished = db.prepare(pubQuery).all(...pubParams) as Article[];
    
    // Sort combined by updated_at to maintain expected order? No, keep published separated later in mapping or sort all
    articles = [...activeArticles, ...recentPublished].sort((a, b) => {
        const dateA = a.updated_at || a.created_at || '';
        const dateB = b.updated_at || b.created_at || '';
        return dateB.localeCompare(dateA);
    });

    const [routerHealthy, agentStatuses] = await Promise.all([
      isRouterHealthy(),
      getAgentStatuses(),
    ]);

    const publishedTodayRows = db
      .prepare(
        `SELECT project, COUNT(*) as cnt
         FROM articles
         WHERE status IN ('published','promoted')
           AND date(COALESCE(published_at, updated_at)) = date('now')
         GROUP BY project`,
      )
      .all() as Array<{ project: string; cnt: number }>;

    const publishedToday = new Map<string, number>(publishedTodayRows.map((r) => [r.project, r.cnt]));

    // WIP check: is downstream blocked for this agent/project?
    const isWipBlocked = (status: string, proj: string): boolean => {
      const downstreamMap: Record<string, string[]> = {
        todo: ['review', 'ready_for_design', 'ready', 'awaiting_approval'],
        review: ['ready_for_design', 'ready', 'awaiting_approval'],
        ready_for_design: ['ready', 'awaiting_approval'],
      };
      const downstream = downstreamMap[status];
      if (!downstream) return false;
      const placeholders = downstream.map(() => '?').join(',');
      const row = db.prepare(
        `SELECT COUNT(*) as c FROM articles WHERE project = ? AND status IN (${placeholders})`,
      ).get(proj, ...downstream) as { c: number };
      return row.c > 0;
    };

    const withBlockers = articles.map((a) => {
      let blockedReason: string | null = null;

      if (!routerHealthy && ['todo', 'review', 'ready_for_design', 'ready'].includes(a.status)) {
        blockedReason = 'blocked: pipeline router offline';
      } else if (a.status === 'todo' && (publishedToday.get(a.project) ?? 0) > 0) {
        blockedReason = 'blocked: daily quota reached';
      } else if (['todo', 'review', 'ready_for_design'].includes(a.status) && isWipBlocked(a.status, a.project)) {
        blockedReason = 'waiting: downstream has articles';
      }

      // Merge agent status from Router
      const agentStatus = agentStatuses[String(a.id)] ?? null;
      const semaphore = a.status === 'published' || a.status === 'promoted'
        ? 'done'
        : a.status === 'failed'
          ? 'failed'
          : agentStatus?.semaphore ?? 'idle';

      return {
        ...a,
        blockedReason,
        semaphore,
        agentName: agentStatus?.agentName ?? null,
        agentEmoji: agentStatus?.agentEmoji ?? null,
        agentDetail: agentStatus?.detail ?? null,
        agentRunId: agentStatus?.runId ?? null,
        agentStartedAt: agentStatus?.startedAt ?? null,
        retryCount: a.revision_count ?? agentStatus?.retryCount ?? 0,
        lastEvent: agentStatus?.lastEvent ?? null,
        lastAgentRun: agentStatus?.lastAgentRun ?? null,
        blockedDiagnostic: agentStatus?.blockedDiagnostic ?? null,
      };
    });

    const columns: PipelineColumn[] = ARTICLE_STATUSES
      .filter((s) => s !== 'failed')
      .map((status) => ({
        status,
        label: COLUMN_LABELS[status],
        articles: withBlockers.filter((a) => a.status === status),
      }));

    return NextResponse.json({ columns });
  } catch (error) {
    return errorResponse(error);
  }
}
