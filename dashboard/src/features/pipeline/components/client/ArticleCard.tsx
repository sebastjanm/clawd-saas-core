'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Article } from '@/lib/types';
import { PROJECT_COLORS } from '@/lib/types';
import Link from 'next/link';
import { articleDisplayId } from '@/lib/articleId';
import { CardActions } from './CardActions';

type Semaphore = 'idle' | 'queued' | 'running' | 'blocked' | 'failed' | 'done';

interface BlockedDiagnostic {
  reason: string;
  detail: string;
  blockingArticleId: number;
  suggestion: string;
}

interface LastAgentRun {
  agent: string;
  status: string;
  finishedAt: string;
  durationMs: number;
  error: string | null;
}

interface LastEvent {
  event_type: string;
  agent: string;
  detail: string;
  created_at: string;
}

interface EnrichedArticle extends Article {
  blockedReason?: string | null;
  semaphore?: Semaphore;
  agentName?: string | null;
  agentEmoji?: string | null;
  agentDetail?: string | null;
  agentRunId?: string | null;
  agentStartedAt?: number | null;
  retryCount?: number;
  lastEvent?: LastEvent | null;
  lastAgentRun?: LastAgentRun | null;
  blockedDiagnostic?: BlockedDiagnostic | null;
}

interface ArticleCardProps {
  article: EnrichedArticle;
}

const STUCK_THRESHOLDS: Record<string, number> = {
  todo: 48,
  writing: 12,
  review: 8,
  ready_for_design: 6,
  ready: 4,
  awaiting_approval: 6,
};

function getStuckLevel(status: string, updatedAt: string): 'none' | 'warning' | 'stuck' {
  const threshold = STUCK_THRESHOLDS[status];
  if (!threshold) return 'none';
  const hours = (Date.now() - new Date(updatedAt + 'Z').getTime()) / 3600000;
  if (hours >= threshold * 2) return 'stuck';
  if (hours >= threshold) return 'warning';
  return 'none';
}

const SEMAPHORE_CONFIG: Record<Semaphore, { pulse: boolean; label: string; color: string }> = {
  idle:    { pulse: false, label: 'Waiting',  color: 'var(--text-faint)' },
  queued:  { pulse: false, label: 'Up next',  color: 'var(--warning)' },
  running: { pulse: true,  label: 'Working',  color: 'var(--success)' },
  blocked: { pulse: false, label: 'On hold',  color: 'var(--error)' },
  failed:  { pulse: false, label: 'Failed',   color: 'var(--error)' },
  done:    { pulse: false, label: 'Done',     color: 'var(--success)' },
};

const PRIORITY_BADGE: Record<string, { icon: string; label: string }> = {
  high: { icon: '🔥', label: 'High' },
  now:  { icon: '⚡', label: 'Now' },
};

export function ArticleCard({ article }: ArticleCardProps) {
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: article.id.toString() });

  const projectColor = PROJECT_COLORS[article.project] ?? 'var(--muted)';
  const stuckLevel = article.updated_at
    ? getStuckLevel(article.status, article.updated_at)
    : 'none';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    borderLeftColor: projectColor,
  };

  const timeInStatus = article.updated_at ? formatAge(article.updated_at) : null;
  const semaphore = article.semaphore ?? 'idle';
  const sem = SEMAPHORE_CONFIG[semaphore];
  const priorityBadge = article.priority ? PRIORITY_BADGE[article.priority] : null;
  const retryCount = article.retryCount ?? 0;

  // Last activity text
  const lastActivity = getLastActivity(article);

  const ringClass =
    semaphore === 'running'
      ? 'ring-1 ring-[var(--success)]/35 bg-[var(--success)]/[0.06]'
      : semaphore === 'failed'
        ? 'ring-1 ring-[var(--error)]/30 bg-[var(--error)]/[0.05]'
        : semaphore === 'blocked'
          ? 'ring-1 ring-[var(--error)]/20 bg-[var(--error)]/[0.03]'
          : stuckLevel === 'stuck'
            ? 'ring-1 ring-[var(--error)]/30 bg-[var(--error)]/[0.04]'
            : stuckLevel === 'warning'
              ? 'ring-1 ring-[var(--warning)]/25 bg-[var(--warning)]/[0.03]'
              : '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab rounded-lg border-l-[3px] bg-[var(--surface-raised)] border border-[var(--border-subtle)] p-3 transition-all duration-150 hover:bg-[var(--surface-hover)] hover:border-[var(--border)] active:cursor-grabbing ${ringClass}`}
    >
      {/* Title row */}
      <div className="flex items-start gap-1.5">
        <Link
          href={`/articles/${article.id}`}
          className="flex-1 block text-[var(--hig-callout)] font-medium leading-snug text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {article.title}
        </Link>
        {priorityBadge && (
          <span className="shrink-0 text-xs" title={`Priority: ${priorityBadge.label}`}>
            {priorityBadge.icon}
          </span>
        )}
      </div>

      {/* ID + retry count */}
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-[10px] font-semibold tracking-wider text-[var(--text-faint)]">
          {articleDisplayId(article.project, article.id)}
        </span>
        {retryCount > 0 && (
          <span className="text-[10px] font-medium text-[var(--warning)]" title={`Sent back ${retryCount} time${retryCount > 1 ? 's' : ''}`}>
            ↩ {retryCount}
          </span>
        )}
      </div>

      {/* Project + age */}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[var(--hig-subhead)] text-[var(--text-quaternary)]">{article.project}</span>
        {timeInStatus && (
          <span
            className={`tabular-nums text-[var(--hig-subhead)] ${
              stuckLevel === 'stuck'
                ? 'text-[var(--error)] font-medium'
                : stuckLevel === 'warning'
                  ? 'text-[var(--warning)]'
                  : 'text-[var(--text-faint)]'
            }`}
          >
            {timeInStatus}
          </span>
        )}
      </div>

      {/* Semaphore + Agent */}
      {semaphore !== 'idle' && semaphore !== 'done' && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (semaphore === 'blocked' || semaphore === 'failed') {
                setShowDiagnostic(!showDiagnostic);
              }
            }}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
              (semaphore === 'blocked' || semaphore === 'failed') ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
            }`}
            style={{
              color: sem.color,
              backgroundColor: `color-mix(in srgb, ${sem.color} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${sem.color} 20%, transparent)`,
            }}
          >
            {sem.pulse ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: sem.color }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: sem.color }} />
              </span>
            ) : (
              <span className="inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: sem.color }} />
            )}
            {article.agentEmoji ?? ''} {sem.label}
          </button>
          {article.agentDetail && (
            <span className="text-[10px] text-[var(--text-faint)]">{article.agentDetail}</span>
          )}
        </div>
      )}

      {/* Last activity */}
      {lastActivity && semaphore !== 'running' && (
        <div className="mt-1.5 text-[10px] text-[var(--text-faint)]">
          {lastActivity}
        </div>
      )}

      {/* Diagnostic popover */}
      {showDiagnostic && (semaphore === 'blocked' || semaphore === 'failed') && (
        <div
          className="mt-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2.5 text-[11px] space-y-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {semaphore === 'blocked' && article.blockedDiagnostic && (
            <>
              <p className="text-[var(--text-secondary)]">{article.blockedDiagnostic.detail}</p>
              <p className="text-[var(--text-faint)]">{article.blockedDiagnostic.suggestion}</p>
              {article.blockedDiagnostic.blockingArticleId && (
                <Link
                  href={`/articles/${article.blockedDiagnostic.blockingArticleId}`}
                  className="text-[var(--accent)] hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  View blocking article →
                </Link>
              )}
            </>
          )}
          {semaphore === 'blocked' && !article.blockedDiagnostic && article.blockedReason && (
            <p className="text-[var(--text-secondary)]">{article.blockedReason}</p>
          )}
          {semaphore === 'failed' && article.lastAgentRun && (
            <>
              <p className="text-[var(--error)]">
                Processing issue
                {article.lastAgentRun.finishedAt && ` · ${formatAge(article.lastAgentRun.finishedAt)} ago`}
              </p>
              <p className="text-[var(--text-secondary)] text-[10px]">This article needs attention. Try retrying or contact support if the issue persists.</p>
            </>
          )}
          {semaphore === 'failed' && article.agentDetail && !article.lastAgentRun && (
            <p className="text-[var(--error)]">This article needs attention. Try retrying or contact support.</p>
          )}
        </div>
      )}

      {/* Blocked reason (from API, not covered by diagnostic) */}
      {article.blockedReason && semaphore !== 'blocked' && semaphore !== 'failed' && (
        <div className="mt-2 inline-flex rounded-md border border-[var(--warning)]/25 bg-[var(--warning)]/10 px-2 py-1 text-[10px] font-medium text-[var(--warning)]">
          {article.blockedReason}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-2">
        <CardActions
          articleId={article.id}
          status={article.status}
          semaphore={semaphore}
          priority={article.priority}
        />
      </div>
    </div>
  );
}

function getLastActivity(article: EnrichedArticle): string | null {
  const lastRun = article.lastAgentRun;
  const lastEvent = article.lastEvent;

  // Prefer last agent run if it finished recently
  if (lastRun?.finishedAt && lastRun.status === 'ok') {
    const agentShort = lastRun.agent?.split(' ')[0] ?? '';
    const ago = formatAge(lastRun.finishedAt);
    const duration = lastRun.durationMs ? ` (${Math.round(lastRun.durationMs / 1000)}s)` : '';
    return `${agentShort} finished ${ago} ago${duration}`;
  }

  // Fall back to last event
  if (lastEvent?.created_at) {
    const ago = formatAge(lastEvent.created_at);
    const agent = lastEvent.agent ?? '';
    const verb = lastEvent.event_type === 'agent_started' ? 'started'
      : lastEvent.event_type === 'agent_completed' ? 'finished'
      : lastEvent.event_type === 'manual_advance' ? 'advanced'
      : lastEvent.event_type === 'manual_reject' ? 'sent back'
      : lastEvent.event_type === 'agent_blocked' ? 'blocked'
      : 'updated';
    return `${agent} ${verb} ${ago} ago`;
  }

  return null;
}

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso + (iso.includes('Z') || iso.includes('+') ? '' : 'Z')).getTime();
  if (ms < 0) return 'just now';
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
