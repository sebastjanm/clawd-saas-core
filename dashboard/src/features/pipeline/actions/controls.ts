'use server';

import { getDb } from '@/lib/server/db';
import { revalidatePath } from 'next/cache';

type ActionResult = { ok: boolean; error?: string; articleId?: number };

const ROUTER_URL = process.env.PIPELINE_ROUTER_URL || 'http://127.0.0.1:4001';

function revalidateAll() {
  revalidatePath('/pipeline');
  revalidatePath('/process');
}

/**
 * Enqueue a new article into the pipeline
 */
export async function enqueueArticle(
  project: string,
  title: string,
  priority: 'normal' | 'high' | 'now',
  brief?: string,
): Promise<ActionResult> {
  try {
    const res = await fetch(`${ROUTER_URL}/pipeline/enqueue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, title, priority, brief: brief || undefined }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? 'Enqueue failed' };

    // Write event
    try {
      const db = getDb();
      db.prepare(
        `INSERT INTO article_events (article_id, project, phase, event_type, agent, agent_type, priority, detail, created_at)
         VALUES (?, ?, 'todo', 'enqueued', 'dashboard', 'human', ?, ?, datetime('now'))`,
      ).run(data.articleId, project, priority, title);
    } catch { /* non-critical */ }

    revalidateAll();
    return { ok: true, articleId: data.articleId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

/**
 * "Run now" — set priority=now and trigger agent
 */
export async function runArticleNow(articleId: number): Promise<ActionResult> {
  try {
    const db = getDb();
    const article = db.prepare('SELECT id, project, status FROM articles WHERE id = ?').get(articleId) as
      | { id: number; project: string; status: string }
      | undefined;
    if (!article) return { ok: false, error: 'Article not found' };

    // Set priority=now
    db.prepare("UPDATE articles SET priority = 'now', updated_at = datetime('now') WHERE id = ?").run(articleId);

    // Map status to agent
    const statusToAgent: Record<string, string> = {
      todo: 'pino',
      review: 'rada',
      ready_for_design: 'zala',
      ready: 'lana',
    };
    const agent = statusToAgent[article.status];
    if (!agent) return { ok: false, error: `Cannot trigger agent for status: ${article.status}` };

    // Trigger via Router
    const res = await fetch(`${ROUTER_URL}/pipeline/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent, project: article.project }),
      signal: AbortSignal.timeout(10000),
    });

    // Write event
    try {
      db.prepare(
        `INSERT INTO article_events (article_id, project, phase, event_type, agent, agent_type, detail, created_at)
         VALUES (?, ?, ?, 'priority_changed', 'dashboard', 'human', ?, datetime('now'))`,
      ).run(articleId, article.project, article.status, `Set to priority=now, triggered ${agent}`);
    } catch { /* */ }

    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

/**
 * Retry a failed article — reset to previous phase and trigger
 */
export async function retryArticle(articleId: number): Promise<ActionResult> {
  try {
    const db = getDb();
    const article = db.prepare('SELECT id, project, status FROM articles WHERE id = ?').get(articleId) as
      | { id: number; project: string; status: string }
      | undefined;
    if (!article) return { ok: false, error: 'Article not found' };

    // For failed status, reset to todo. For others, just re-trigger.
    const targetStatus = article.status === 'failed' ? 'todo' : article.status;
    if (article.status === 'failed') {
      db.prepare("UPDATE articles SET status = 'todo', updated_at = datetime('now') WHERE id = ?").run(articleId);
    } else {
      // Touch updated_at to reset the age timer
      db.prepare("UPDATE articles SET updated_at = datetime('now') WHERE id = ?").run(articleId);
    }

    // Write event
    try {
      db.prepare(
        `INSERT INTO article_events (article_id, project, phase, event_type, agent, agent_type, detail, created_at)
         VALUES (?, ?, ?, 'status_change', 'dashboard', 'human', ?, datetime('now'))`,
      ).run(articleId, article.project, targetStatus, `Retry: ${article.status} → ${targetStatus}`);
    } catch { /* */ }

    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

/**
 * Cancel article — move to backlog
 */
export async function cancelArticle(articleId: number): Promise<ActionResult> {
  try {
    const db = getDb();
    const article = db.prepare('SELECT id, project, status FROM articles WHERE id = ?').get(articleId) as
      | { id: number; project: string; status: string }
      | undefined;
    if (!article) return { ok: false, error: 'Article not found' };

    db.prepare("UPDATE articles SET status = 'backlog', updated_at = datetime('now') WHERE id = ?").run(articleId);

    // Write event
    try {
      db.prepare(
        `INSERT INTO article_events (article_id, project, phase, event_type, agent, agent_type, detail, created_at)
         VALUES (?, ?, 'backlog', 'cancelled', 'dashboard', 'human', ?, datetime('now'))`,
      ).run(articleId, article.project, `Cancelled from ${article.status}`);
    } catch { /* */ }

    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

/**
 * Set article priority
 */
export async function setArticlePriority(
  articleId: number,
  priority: 'normal' | 'high' | 'now',
): Promise<ActionResult> {
  try {
    const db = getDb();
    const article = db.prepare('SELECT id, project, status, priority FROM articles WHERE id = ?').get(articleId) as
      | { id: number; project: string; status: string; priority: string }
      | undefined;
    if (!article) return { ok: false, error: 'Article not found' };

    db.prepare("UPDATE articles SET priority = ?, updated_at = datetime('now') WHERE id = ?").run(priority, articleId);

    // Write event
    try {
      db.prepare(
        `INSERT INTO article_events (article_id, project, phase, event_type, agent, agent_type, priority, detail, created_at)
         VALUES (?, ?, ?, 'priority_changed', 'dashboard', 'human', ?, ?, datetime('now'))`,
      ).run(articleId, article.project, article.status, priority, `${article.priority ?? 'normal'} → ${priority}`);
    } catch { /* */ }

    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}
