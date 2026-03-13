'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { marked } from 'marked';

interface IntelArticle {
  id: number;
  project: string;
  type: string | null;
  title: string;
  slug: string | null;
  abstract: string | null;
  status: string;
  final_md: string | null;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
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

const PROSE_CLASSES = `prose prose-invert max-w-none
  prose-headings:text-[var(--text-primary)] prose-headings:font-semibold
  prose-h1:text-2xl prose-h1:mb-4 prose-h1:mt-8
  prose-h2:text-xl prose-h2:mb-3 prose-h2:mt-6 prose-h2:pb-2 prose-h2:border-b prose-h2:border-[var(--border)]
  prose-h3:text-lg prose-h3:mb-2 prose-h3:mt-5
  prose-p:text-[var(--text-secondary)] prose-p:leading-relaxed prose-p:mb-4
  prose-strong:text-[var(--text-primary)] prose-strong:font-semibold
  prose-a:text-[var(--accent)] prose-a:no-underline hover:prose-a:underline
  prose-ul:text-[var(--text-secondary)] prose-ol:text-[var(--text-secondary)]
  prose-li:mb-1 prose-li:leading-relaxed
  prose-blockquote:border-l-[var(--accent)] prose-blockquote:text-[var(--text-tertiary)] prose-blockquote:italic
  prose-code:text-[var(--accent)] prose-code:bg-[var(--surface)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
  prose-pre:bg-[var(--surface)] prose-pre:border prose-pre:border-[var(--border)] prose-pre:rounded-xl
  prose-hr:border-[var(--border)]
  prose-table:text-sm
  prose-th:text-[var(--text-primary)] prose-th:border-[var(--border)] prose-th:px-3 prose-th:py-2
  prose-td:text-[var(--text-secondary)] prose-td:border-[var(--border)] prose-td:px-3 prose-td:py-2
  prose-img:rounded-xl prose-img:border prose-img:border-[var(--border)]`;

export default function IntelligenceArticlePage() {
  const params = useParams();
  const router = useRouter();
  const [article, setArticle] = useState<IntelArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchArticle() {
      try {
        const res = await fetch(`/api/intelligence/${params.id}`);
        if (!res.ok) throw new Error(res.status === 404 ? 'Article not found' : `HTTP ${res.status}`);
        const data = await res.json();
        setArticle(data.article);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchArticle();
  }, [params.id]);

  const htmlContent = useMemo(() => {
    if (!article?.final_md) return '';
    return marked.parse(article.final_md) as string;
  }, [article?.final_md]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="mx-auto max-w-3xl py-20 text-center">
        <p className="text-[var(--muted)] mb-4">{error || 'Article not found'}</p>
        <button
          onClick={() => router.push('/intelligence')}
          className="text-sm text-[var(--accent)] hover:underline"
        >
          ← Back to Intelligence
        </button>
      </div>
    );
  }

  const projectLabel = article.project === 'baseman-alpha' ? '🔬 Baseman AI' : '🪙 Nakup Srebra';

  return (
    <div className="mx-auto max-w-3xl">
      {/* Breadcrumbs */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-[var(--muted)]">
        <Link href="/intelligence" className="hover:text-[var(--text-primary)] transition-colors">
          Intelligence
        </Link>
        <span>/</span>
        <span className="text-[var(--text-primary)]">{article.id}</span>
      </nav>

      {/* Article header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            {projectLabel}
          </span>
          <StatusBadge status={article.status} />
          <span className="text-xs text-[var(--muted)]">
            {formatDate(article.published_at || article.updated_at || article.created_at)}
          </span>
        </div>

        <h1 className="text-3xl font-bold text-[var(--text-primary)] leading-tight mb-4">
          {article.title}
        </h1>

        {article.abstract && (
          <p className="text-base text-[var(--muted)] leading-relaxed border-l-2 border-[var(--accent)]/30 pl-4">
            {article.abstract}
          </p>
        )}
      </header>

      {/* Divider */}
      <hr className="border-[var(--border)] mb-8" />

      {/* Article content */}
      <article
        className={PROSE_CLASSES}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />

      {/* Bottom nav */}
      <div className="mt-12 pt-6 border-t border-[var(--border)]">
        <Link
          href="/intelligence"
          className="text-sm text-[var(--accent)] hover:underline"
        >
          ← Back to Intelligence
        </Link>
      </div>
    </div>
  );
}
