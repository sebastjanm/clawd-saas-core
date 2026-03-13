'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface IntelArticle {
  id: number;
  project: string;
  type: string | null;
  title: string;
  slug: string | null;
  abstract: string | null;
  status: string;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// Intelligence = baseman-alpha research briefings (internal use only)

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    published: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    promoted: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    review: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    writing: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  };
  const cls = colors[status] || 'bg-[var(--surface)] text-[var(--muted)] border-[var(--border)]';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

export function IntelligenceDashboard() {
  const [articles, setArticles] = useState<IntelArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/intelligence?filter=baseman-alpha`, {
        headers: { Authorization: 'Bearer tovarna_dashboard_2026' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setArticles(data.articles || []);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  return (
    <>
      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : articles.length === 0 ? (
        <div className="py-20 text-center text-[var(--muted)]">No intelligence briefings found.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/intelligence/${article.id}`}
              className="group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-all hover:border-[var(--accent)]/30 hover:bg-[var(--surface-hover)] no-underline"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
                    🔬 Baseman AI
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">
                    {formatDate(article.published_at || article.updated_at || article.created_at)}
                  </span>
                  <StatusBadge status={article.status} />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-snug group-hover:text-[var(--accent)] transition-colors">
                  {article.title}
                </h3>
                {article.abstract && (
                  <p className="mt-1 text-xs text-[var(--muted)] line-clamp-1">{article.abstract}</p>
                )}
              </div>
              <span className="shrink-0 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity text-sm">
                →
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
