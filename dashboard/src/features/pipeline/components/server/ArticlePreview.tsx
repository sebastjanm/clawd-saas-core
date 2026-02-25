import { Badge } from '@/shared/components/server/Badge';
import { Card } from '@/shared/components/server/Card';
import type { Article } from '@/lib/types';
import { COLUMN_LABELS } from '@/lib/types';
import Link from 'next/link';
import { articleDisplayId } from '@/lib/articleId';
import { ApprovalActions } from '@/features/pipeline/components/client/ApprovalActions';
import { ArticleTimeline } from '@/features/pipeline/components/client/ArticleTimeline';

interface ArticlePreviewProps {
  article: Article;
}

const PROJECT_DOMAINS: Record<string, string> = {
  nakupsrebra: 'https://www.nakupsrebra.com/blog',
  'baseman-blog': 'https://baseman-blog.vercel.app/blog',
  'avant2go-subscribe': 'https://avant2subscribe.com/blog',
};

const PROJECT_LABELS: Record<string, string> = {
  nakupsrebra: 'NakupSrebra.com — Silver investment blog',
  'baseman-blog': 'Baseman Blog — Tech & AI',
  'avant2go-subscribe': 'Avant2Subscribe — Car subscription blog',
};

function buildArticleUrl(project: string, slug: string | null, publishedUrl: string | null): string | null {
  if (publishedUrl) return publishedUrl;
  if (!slug) return null;
  const base = PROJECT_DOMAINS[project];
  if (!base) return null;
  return `${base}/${slug}`;
}

const PUBLISHED_STATUSES = new Set(['published', 'promoted']);

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  // Handle both "2026-02-19" and "2026-02-19 08:09:34" formats
  const normalized = iso.includes('T') ? iso : iso.includes(' ') ? iso.replace(' ', 'T') + 'Z' : iso + 'T00:00:00Z';
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function ArticlePreview({ article }: ArticlePreviewProps) {
  const isPublished = PUBLISHED_STATUSES.has(article.status);
  const articleUrl = buildArticleUrl(article.project, article.slug, article.published_url);
  const projectLabel = PROJECT_LABELS[article.project] ?? article.project;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/pipeline" className="inline-flex items-center gap-1 text-[var(--hig-callout)] text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] transition-colors">
        ← Pipeline
      </Link>

      {/* Title + status */}
      <div>
        <h1 className="mb-3 text-[var(--hig-large-title)] font-bold leading-tight text-[var(--text-primary)]">{article.title}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Badge label={article.project} />
          <StatusBadge status={article.status} />
          {article.primary_keyword && (
            <span className="text-[var(--hig-subhead)] text-[var(--text-quaternary)]">
              🔑 {article.primary_keyword}
            </span>
          )}
        </div>
      </div>

      {/* Editor/approval actions */}
      <ApprovalActions articleId={article.id} status={article.status} />

      {/* Event Timeline */}
      <Card>
        <ArticleTimeline articleId={article.id} />
      </Card>

      {/* Meta card — project, URL, dates */}
      <Card>
        <h3 className="mb-3 text-[var(--hig-subhead)] font-semibold uppercase tracking-wider text-[var(--text-quaternary)]">
          Details
        </h3>
        <dl className="space-y-2 text-[var(--hig-callout)]">
          <Row label="Article ID" value={articleDisplayId(article.project, article.id)} />
          <Row label="Project" value={projectLabel} />
          {article.slug && <Row label="Slug" value={article.slug} />}
          {isPublished && articleUrl && (
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--text-quaternary)] shrink-0">Published URL</dt>
              <dd className="text-right truncate">
                <a
                  href={articleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline"
                >
                  {articleUrl}
                </a>
              </dd>
            </div>
          )}
          {!isPublished && articleUrl && (
            <Row label="Planned URL" value={articleUrl} />
          )}
          {article.search_intent && <Row label="Intent" value={article.search_intent} />}
          {article.claimed_by && <Row label="Claimed by" value={article.claimed_by} />}
          <Row label="Created" value={formatDate(article.created_at)} />
          <Row label="Updated" value={formatDate(article.updated_at)} />
          {article.scheduled_date && <Row label="Scheduled for" value={formatDate(article.scheduled_date)} />}
          {article.published_at && <Row label="Published" value={formatDate(article.published_at)} />}
        </dl>
      </Card>

      {/* Outline */}
      {article.outline && (
        <Card>
          <h3 className="mb-3 text-[var(--hig-subhead)] font-semibold uppercase tracking-wider text-[var(--text-quaternary)]">
            Outline
          </h3>
          <pre className="whitespace-pre-wrap text-[var(--hig-callout)] text-[var(--text-tertiary)] leading-relaxed" style={{ fontFamily: 'var(--font-mono)' }}>
            {article.outline}
          </pre>
        </Card>
      )}

      {/* Draft preview */}
      {article.draft_md && (
        <Card>
          <h3 className="mb-3 text-[var(--hig-subhead)] font-semibold uppercase tracking-wider text-[var(--text-quaternary)]">
            Draft
          </h3>
          <details>
            <summary className="cursor-pointer text-[var(--hig-callout)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
              Show draft ({Math.round(article.draft_md.length / 1000)}k chars)
            </summary>
            <pre className="mt-3 whitespace-pre-wrap text-[var(--hig-subhead)] text-[var(--text-tertiary)] leading-relaxed max-h-[600px] overflow-y-auto" style={{ fontFamily: 'var(--font-mono)' }}>
              {article.draft_md}
            </pre>
          </details>
        </Card>
      )}

      {/* Final HTML preview */}
      {article.final_md && (
        <Card>
          <h3 className="mb-3 text-[var(--hig-subhead)] font-semibold uppercase tracking-wider text-[var(--text-quaternary)]">
            Final HTML
          </h3>
          <details>
            <summary className="cursor-pointer text-[var(--hig-callout)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
              Show HTML ({Math.round(article.final_md.length / 1000)}k chars)
            </summary>
            <pre className="mt-3 whitespace-pre-wrap text-[var(--hig-subhead)] text-[var(--text-tertiary)] leading-relaxed max-h-[600px] overflow-y-auto" style={{ fontFamily: 'var(--font-mono)' }}>
              {article.final_md}
            </pre>
          </details>
        </Card>
      )}

      {/* Feedback + Revision Count */}
      {article.feedback && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[var(--hig-subhead)] font-semibold uppercase tracking-wider text-[var(--text-quaternary)]">
              Feedback
            </h3>
            {(article.revision_count ?? 0) > 0 && (
              <span className={`text-[var(--hig-caption2)] font-medium px-2 py-0.5 rounded-full ${
                (article.revision_count ?? 0) >= 2 
                  ? 'bg-red-500/10 text-red-400' 
                  : 'bg-yellow-500/10 text-yellow-400'
              }`}>
                Revision {article.revision_count}/2
              </span>
            )}
          </div>
          <p className="whitespace-pre-wrap text-[var(--hig-callout)] text-[var(--text-secondary)] leading-relaxed">
            {article.feedback}
          </p>
        </Card>
      )}

      {/* Notes */}
      {article.notes && (
        <Card>
          <h3 className="mb-3 text-[var(--hig-subhead)] font-semibold uppercase tracking-wider text-[var(--text-quaternary)]">
            Notes
          </h3>
          <p className="whitespace-pre-wrap text-[var(--hig-callout)] text-[var(--text-secondary)] leading-relaxed">
            {article.notes}
          </p>
        </Card>
      )}

      {/* Strategy */}
      {article.strategy && (
        <Card>
          <h3 className="mb-3 text-[var(--hig-subhead)] font-semibold uppercase tracking-wider text-[var(--text-quaternary)]">
            Strategy
          </h3>
          <p className="whitespace-pre-wrap text-[var(--hig-callout)] text-[var(--text-secondary)] leading-relaxed">
            {article.strategy}
          </p>
        </Card>
      )}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  backlog:             'bg-[var(--surface-strong)] text-[var(--text-tertiary)]',
  todo:                'bg-[var(--accent)]/10 text-[var(--accent)]',
  writing:             'bg-[#8b5cf6]/10 text-[#8b5cf6]',
  review:              'bg-[var(--warning)]/10 text-[var(--warning)]',
  ready:               'bg-[#06b6d4]/10 text-[#06b6d4]',
  ready_for_design:    'bg-[#ec4899]/10 text-[#ec4899]',
  awaiting_approval:   'bg-[var(--warning)]/15 text-[var(--warning)] ring-1 ring-[var(--warning)]/20',
  published:           'bg-[var(--success)]/10 text-[var(--success)]',
  promoted:            'bg-[var(--success)]/15 text-[var(--success)]',
  failed:              'bg-[var(--error)]/10 text-[var(--error)]',
};

function StatusBadge({ status }: { status: string }) {
  const label = COLUMN_LABELS[status as keyof typeof COLUMN_LABELS] ?? status;
  const style = STATUS_STYLES[status] ?? 'bg-[var(--surface)] text-[var(--text-tertiary)]';
  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[var(--hig-subhead)] font-semibold ${style}`}>
      {label}
    </span>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--text-quaternary)] shrink-0">{label}</dt>
      <dd className="tabular-nums text-[var(--text-secondary)] text-right">{value ?? '—'}</dd>
    </div>
  );
}
