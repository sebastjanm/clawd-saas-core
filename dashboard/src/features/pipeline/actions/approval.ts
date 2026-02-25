'use server';

import { getDb } from '@/lib/server/db';
import { revalidatePath } from 'next/cache';
import { execSync } from 'child_process';

type ActionResult = { ok: boolean; error?: string; publishedUrl?: string };

function revalidateArticlePaths(articleId: number) {
  revalidatePath('/pipeline');
  revalidatePath('/articles/' + articleId);
  revalidatePath('/process');
}

function runPipelineCli(command: string, articleId: number): ActionResult & { url?: string } {
  const output = execSync(
    `node /home/clawdbot/clawd/content-pipeline/scripts/pipeline-cli.js ${command} ${articleId}`,
    { encoding: 'utf8', timeout: 90_000 },
  );

  const parsed = JSON.parse(output);
  if (!parsed?.ok) {
    return { ok: false, error: parsed?.error || `${command} failed` };
  }
  return { ok: true, url: parsed?.url as string | undefined };
}

export async function approveArticle(articleId: number): Promise<ActionResult> {
  try {
    const db = getDb();
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId) as { id: number; status: string; published_url?: string } | undefined;

    if (!article) return { ok: false, error: 'Article not found' };
    if (article.status !== 'awaiting_approval' && article.status !== 'ready') {
      return { ok: false, error: `Cannot approve article in status: ${article.status}` };
    }

    const cli = runPipelineCli('publish', articleId);
    if (!cli.ok) return cli;

    const refreshed = db.prepare('SELECT published_url FROM articles WHERE id = ?').get(articleId) as { published_url?: string } | undefined;
    revalidateArticlePaths(articleId);
    return { ok: true, publishedUrl: refreshed?.published_url || cli.url || article.published_url || undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

export async function rejectArticle(articleId: number, feedback?: string): Promise<ActionResult> {
  try {
    const db = getDb();
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId) as { id: number } | undefined;

    if (!article) return { ok: false, error: 'Article not found' };

    // G1: Reject sends back to 'todo' (Pino rewrites), not 'review' (Rada re-reviews same content)
    db.prepare("UPDATE articles SET status = 'todo', feedback = COALESCE(?, feedback), updated_at = datetime('now') WHERE id = ?")
      .run(feedback || null, articleId);

    revalidateArticlePaths(articleId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

export async function unpublishArticle(articleId: number): Promise<ActionResult> {
  try {
    const db = getDb();
    const article = db.prepare('SELECT status FROM articles WHERE id = ?').get(articleId) as { status: string } | undefined;
    if (!article) return { ok: false, error: 'Article not found' };
    if (article.status !== 'published' && article.status !== 'promoted') {
      return { ok: false, error: `Cannot unpublish article in status: ${article.status}` };
    }

    const cli = runPipelineCli('unpublish', articleId);
    if (!cli.ok) return cli;

    revalidateArticlePaths(articleId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

export async function deleteArticle(articleId: number, reason?: string): Promise<ActionResult> {
  try {
    const db = getDb();
    const article = db.prepare('SELECT id, notes FROM articles WHERE id = ?').get(articleId) as { id: number; notes?: string | null } | undefined;
    if (!article) return { ok: false, error: 'Article not found' };

    if (reason?.trim()) {
      db.prepare("UPDATE articles SET notes = COALESCE(notes, '') || ? WHERE id = ?")
        .run(`\n[editor-delete] ${reason.trim()}`, articleId);
    }

    const cli = runPipelineCli('delete', articleId);
    if (!cli.ok) return cli;

    revalidatePath('/pipeline');
    revalidatePath('/process');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

export async function markDuplicateArticle(articleId: number, duplicateOfId?: string): Promise<ActionResult> {
  try {
    const db = getDb();
    const article = db.prepare('SELECT id, notes FROM articles WHERE id = ?').get(articleId) as { id: number; notes?: string | null } | undefined;
    if (!article) return { ok: false, error: 'Article not found' };

    const suffix = duplicateOfId?.trim() ? ` duplicate_of=${duplicateOfId.trim()}` : '';
    db.prepare("UPDATE articles SET status = 'failed', feedback = COALESCE(feedback, '') || ?, notes = COALESCE(notes, '') || ?, updated_at = datetime('now') WHERE id = ?")
      .run('\n[editor] Marked as duplicate', `\n[editor-duplicate]${suffix}`, articleId);

    revalidateArticlePaths(articleId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
