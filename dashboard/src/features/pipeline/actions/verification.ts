'use server';

import { getDb } from '@/lib/server/db';
import { revalidatePath } from 'next/cache';

type ActionResult = { ok: boolean; error?: string };

function revalidateArticlePaths(articleId: number) {
  revalidatePath('/pipeline');
  revalidatePath('/articles/' + articleId);
  revalidatePath('/process');
}

/**
 * Advance an article to the next pipeline phase.
 * Used for non-publish transitions (writing→review, review→ready_for_design, etc.)
 */
export async function advanceArticle(articleId: number, nextStatus: string): Promise<ActionResult> {
  try {
    const db = getDb();
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId) as { id: number; status: string } | undefined;

    if (!article) return { ok: false, error: 'Article not found' };

    const validStatuses = ['backlog', 'todo', 'writing', 'review', 'ready_for_design', 'ready', 'awaiting_approval', 'published', 'promoted', 'failed'];
    if (!validStatuses.includes(nextStatus)) {
      return { ok: false, error: `Invalid target status: ${nextStatus}` };
    }

    db.prepare("UPDATE articles SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(nextStatus, articleId);

    // Log the transition
    try {
      db.prepare(
        `INSERT INTO article_events (article_id, project, phase, event_type, agent, agent_type, detail, created_at)
         VALUES (?, (SELECT project FROM articles WHERE id = ?), ?, 'manual_advance', 'dashboard', 'human', ?, datetime('now'))`,
      ).run(articleId, articleId, nextStatus, `${article.status} → ${nextStatus}`);
    } catch {
      // non-critical
    }

    revalidateArticlePaths(articleId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Request changes: send article back to a previous phase with feedback.
 */
export async function requestChanges(articleId: number, targetStatus: string, feedback: string): Promise<ActionResult> {
  try {
    const db = getDb();
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId) as { id: number; status: string } | undefined;

    if (!article) return { ok: false, error: 'Article not found' };

    db.prepare("UPDATE articles SET status = ?, feedback = ?, updated_at = datetime('now') WHERE id = ?")
      .run(targetStatus, feedback, articleId);

    // Log the transition
    try {
      db.prepare(
        `INSERT INTO article_events (article_id, project, phase, event_type, agent, agent_type, detail, metadata, created_at)
         VALUES (?, (SELECT project FROM articles WHERE id = ?), ?, 'manual_reject', 'dashboard', 'human', ?, ?, datetime('now'))`,
      ).run(articleId, articleId, targetStatus, `${article.status} → ${targetStatus}`, JSON.stringify({ feedback: feedback.slice(0, 500) }));
    } catch {
      // non-critical
    }

    revalidateArticlePaths(articleId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
