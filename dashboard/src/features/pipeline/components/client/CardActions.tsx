'use client';

import { useState, useTransition } from 'react';
import { runArticleNow, retryArticle, cancelArticle, setArticlePriority } from '../../actions/controls';

interface CardActionsProps {
  articleId: number;
  status: string;
  semaphore: string;
  priority?: string | null;
}

export function CardActions({ articleId, status, semaphore, priority }: CardActionsProps) {
  const [pending, startTransition] = useTransition();
  const [showMenu, setShowMenu] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isTerminal = ['published', 'promoted', 'backlog'].includes(status);
  const canRunNow = ['queued', 'blocked'].includes(semaphore) && !isTerminal;
  const canRetry = semaphore === 'failed' || status === 'failed';
  const canCancel = !isTerminal && status !== 'failed';

  if (isTerminal && !canRetry) return null;

  function doAction(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        setFeedback('✓');
        setTimeout(() => setFeedback(null), 1500);
      } else {
        setFeedback('Action could not be completed. Please try again.');
        setTimeout(() => setFeedback(null), 3000);
      }
      setShowMenu(false);
    });
  }

  return (
    <div className="relative inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {/* Quick actions based on state */}
      {canRunNow && (
        <button
          onClick={() => doAction(() => runArticleNow(articleId))}
          disabled={pending}
          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors disabled:opacity-40"
          title="Set priority=now and trigger agent immediately"
        >
          ⚡ Run now
        </button>
      )}
      {canRetry && (
        <button
          onClick={() => doAction(() => retryArticle(articleId))}
          disabled={pending}
          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--warning)] hover:bg-[var(--warning)]/10 transition-colors disabled:opacity-40"
          title="Reset and retry"
        >
          ↻ Retry
        </button>
      )}

      {/* Overflow menu */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="rounded px-1 py-0.5 text-[10px] text-[var(--text-faint)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
      >
        ⋯
      </button>

      {showMenu && (
        <div className="absolute left-0 top-full mt-1 z-50 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg py-1 min-w-[140px]">
          {!isTerminal && priority !== 'high' && (
            <MenuItem
              label="🔥 Set high priority"
              onClick={() => doAction(() => setArticlePriority(articleId, 'high'))}
              disabled={pending}
            />
          )}
          {!isTerminal && priority !== 'now' && (
            <MenuItem
              label="⚡ Set priority: now"
              onClick={() => doAction(() => setArticlePriority(articleId, 'now'))}
              disabled={pending}
            />
          )}
          {priority && priority !== 'normal' && (
            <MenuItem
              label="Reset priority"
              onClick={() => doAction(() => setArticlePriority(articleId, 'normal'))}
              disabled={pending}
            />
          )}
          {canCancel && (
            <MenuItem
              label="⛔ Cancel (→ backlog)"
              onClick={() => doAction(() => cancelArticle(articleId))}
              disabled={pending}
              danger
            />
          )}
        </div>
      )}

      {/* Feedback toast */}
      {feedback && (
        <span className={`text-[10px] font-medium ${feedback === '✓' ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
          {feedback}
        </span>
      )}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`block w-full text-left px-3 py-1.5 text-[11px] transition-colors disabled:opacity-40 ${
        danger
          ? 'text-[var(--error)] hover:bg-[var(--error)]/10'
          : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
      }`}
    >
      {label}
    </button>
  );
}
