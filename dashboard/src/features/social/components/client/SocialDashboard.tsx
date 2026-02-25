'use client';

import { useState } from 'react';
import {
  useSocial,
  updateSocialPost,
  batchAction,
  type SocialGroup,
  type SocialPost,
} from '../../hooks/useSocial';
import { Spinner } from '@/shared/components/client/Spinner';
import { PROJECT_COLORS } from '@/lib/types';

const PLATFORM_META: Record<
  string,
  { icon: string; label: string; color: string; charLimit?: number }
> = {
  twitter: { icon: '𝕏', label: 'X / Twitter', color: '#1d9bf0', charLimit: 280 },
  linkedin: { icon: 'in', label: 'LinkedIn', color: '#0a66c2', charLimit: 1200 },
  facebook: { icon: 'f', label: 'Facebook', color: '#1877f2', charLimit: 500 },
  instagram: { icon: '📷', label: 'Instagram', color: '#e4405f' },
  tiktok: { icon: '♪', label: 'TikTok', color: '#010101' },
};

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'awaiting_approval', label: 'Awaiting' },
  { value: 'approved', label: 'Approved' },
  { value: 'posted', label: 'Posted' },
  { value: 'rejected', label: 'Rejected' },
];

const PROJECTS = [
  { id: '', label: 'All projects' },
  { id: 'nakupsrebra', label: 'NakupSrebra' },
  { id: 'baseman-blog', label: 'Baseman Blog' },
  { id: 'avant2go-subscribe', label: 'Avant2Subscribe' },
  { id: 'lightingdesign-studio', label: 'Lighting Design' },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-[var(--surface)] text-[var(--text-tertiary)]',
    awaiting_approval: 'bg-[var(--warning)]/15 text-[var(--warning)]',
    approved: 'bg-[var(--success)]/15 text-[var(--success)]',
    posted: 'bg-[var(--accent)]/15 text-[var(--accent)]',
    rejected: 'bg-[var(--error)]/15 text-[var(--error)]',
    failed: 'bg-[var(--error)]/15 text-[var(--error)]',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ${styles[status] ?? styles.draft}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  const meta = PLATFORM_META[platform];
  if (!meta) return <span className="text-xs">{platform}</span>;
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white shrink-0"
      style={{ backgroundColor: meta.color }}
      title={meta.label}
    >
      {meta.icon}
    </span>
  );
}

function PostCard({
  post,
  onAction,
  busy,
}: {
  post: SocialPost;
  onAction: (id: number, status: string) => void;
  busy: boolean;
}) {
  const meta = PLATFORM_META[post.platform];
  const charLimit = meta?.charLimit;
  const charCount = post.content.length;
  const overLimit = charLimit ? charCount > charLimit : false;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3 transition-colors hover:border-[var(--border-hover)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PlatformIcon platform={post.platform} />
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            {meta?.label ?? post.platform}
          </span>
        </div>
        <StatusBadge status={post.status} />
      </div>

      {/* Content */}
      <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap break-words">
        {post.content}
      </p>

      {/* Media brief */}
      {post.media_brief && (
        <div className="rounded-lg bg-[var(--surface-alt)] border border-[var(--border-subtle)] p-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            Media Brief
          </span>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            {post.media_brief}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-3 text-[11px] text-[var(--text-faint)]">
          {charLimit && (
            <span className={overLimit ? 'text-[var(--error)] font-semibold' : ''}>
              {charCount}/{charLimit}
            </span>
          )}
        </div>

        {/* Actions */}
        {(post.status === 'draft' || post.status === 'awaiting_approval') && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onAction(post.id, 'approved')}
              disabled={busy}
              className="rounded-lg bg-[var(--success)]/15 px-3 py-1.5 text-xs font-semibold text-[var(--success)] transition-colors hover:bg-[var(--success)]/25 disabled:opacity-40"
            >
              Approve
            </button>
            <button
              onClick={() => onAction(post.id, 'rejected')}
              disabled={busy}
              className="rounded-lg bg-[var(--error)]/15 px-3 py-1.5 text-xs font-semibold text-[var(--error)] transition-colors hover:bg-[var(--error)]/25 disabled:opacity-40"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ArticleGroup({
  group,
  onPostAction,
  onBatchAction,
  busy,
}: {
  group: SocialGroup;
  onPostAction: (id: number, status: string) => void;
  onBatchAction: (articleId: number, action: 'approve' | 'reject') => void;
  busy: boolean;
}) {
  const projectColor = PROJECT_COLORS[group.article_project] ?? '#64748b';
  const hasPendingPosts = group.posts.some(
    (p) => p.status === 'draft' || p.status === 'awaiting_approval',
  );

  return (
    <div className="space-y-4">
      {/* Article header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: projectColor }}
            />
            <span className="text-xs font-medium text-[var(--text-faint)] uppercase tracking-wide">
              {group.article_project}
            </span>
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)] leading-snug truncate">
            {group.article_title}
          </h3>
        </div>

        {/* Batch actions */}
        {hasPendingPosts && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onBatchAction(group.article_id, 'approve')}
              disabled={busy}
              className="rounded-lg bg-[var(--success)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--success)] transition-colors hover:bg-[var(--success)]/20 disabled:opacity-40"
            >
              Approve All
            </button>
            <button
              onClick={() => onBatchAction(group.article_id, 'reject')}
              disabled={busy}
              className="rounded-lg bg-[var(--error)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--error)] transition-colors hover:bg-[var(--error)]/20 disabled:opacity-40"
            >
              Reject All
            </button>
          </div>
        )}
      </div>

      {/* Platform posts grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onAction={onPostAction}
            busy={busy}
          />
        ))}
      </div>
    </div>
  );
}

export function SocialDashboard() {
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, loading, error, refetch } = useSocial(
    statusFilter || undefined,
    projectFilter || undefined,
  );

  const handlePostAction = async (id: number, status: string) => {
    setBusy(true);
    try {
      await updateSocialPost(id, { status });
      await refetch();
    } finally {
      setBusy(false);
    }
  };

  const handleBatchAction = async (
    articleId: number,
    action: 'approve' | 'reject',
  ) => {
    setBusy(true);
    try {
      await batchAction(articleId, action);
      await refetch();
    } finally {
      setBusy(false);
    }
  };

  const totalByStatus = (data?.stats ?? []).reduce(
    (acc, s) => {
      acc[s.status] = s.count;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="flex flex-wrap gap-3">
        {STATUS_TABS.filter((t) => t.value).map((tab) => {
          const count = totalByStatus[tab.value] ?? 0;
          return (
            <div
              key={tab.value}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-center min-w-[90px]"
            >
              <div className="text-lg font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-mono)' }}>
                {count}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                {tab.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-0.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-[var(--surface-strong)] text-[var(--text-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Project filter */}
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)] outline-none"
        >
          {PROJECTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading && !data ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[var(--error)]/20 bg-[var(--error)]/5 p-4 text-sm text-[var(--error)]">
          {error}
        </div>
      ) : !data?.groups.length ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center">
          <span className="text-4xl">🐝</span>
          <p className="mt-3 text-sm text-[var(--text-tertiary)]">
            No social posts yet. Bea will generate them when articles are published.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {data.groups.map((group) => (
            <ArticleGroup
              key={group.article_id}
              group={group}
              onPostAction={handlePostAction}
              onBatchAction={handleBatchAction}
              busy={busy}
            />
          ))}
        </div>
      )}
    </div>
  );
}
