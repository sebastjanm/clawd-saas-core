'use client';

import { useState } from 'react';
import {
  approveArticle,
  deleteArticle,
  markDuplicateArticle,
  rejectArticle,
  unpublishArticle,
} from '@/features/pipeline/actions/approval';
import { advanceArticle, requestChanges } from '@/features/pipeline/actions/verification';
import { useRouter } from 'next/navigation';

interface ApprovalActionsProps {
  articleId: number;
  status: string;
}

const PUBLISHED = new Set(['published', 'promoted']);
const TERMINAL = new Set(['published', 'promoted', 'failed', 'backlog']);

// Pipeline phase verification: what's the next status if approved?
const NEXT_STATUS: Record<string, string> = {
  writing: 'review',
  review: 'ready_for_design',
  ready_for_design: 'ready',
  ready: 'published',        // auto-publish via pipeline-cli
  awaiting_approval: 'published',
};

// Where to send back on "request changes"?
const REJECT_TARGET: Record<string, string> = {
  review: 'writing',
  ready_for_design: 'review',
  ready: 'ready_for_design',
  awaiting_approval: 'writing',
};

const PHASE_LABELS: Record<string, { title: string; approveLabel: string; description: string }> = {
  writing: {
    title: '✍️ Writing in Progress',
    approveLabel: '→ Send to Review',
    description: 'Article is being written. When done, advance to review.',
  },
  review: {
    title: '🦉 In Review',
    approveLabel: '→ Approve for Design',
    description: 'Review content quality, language, and accuracy. Approve or request changes.',
  },
  ready_for_design: {
    title: '🎨 Design Phase',
    approveLabel: '→ Mark Ready',
    description: 'HTML conversion in progress. Approve the design or send back.',
  },
  ready: {
    title: '🚀 Ready to Publish',
    approveLabel: '✅ Publish Now',
    description: 'Article is ready. Publish it or request final changes.',
  },
  awaiting_approval: {
    title: '🔔 Awaiting Approval',
    approveLabel: '✅ Publish Now',
    description: 'This article needs your approval before going live.',
  },
};

export function ApprovalActions({ articleId, status }: ApprovalActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [duplicateOfId, setDuplicateOfId] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const canPublish = status === 'awaiting_approval' || status === 'ready';
  const canAdvance = !TERMINAL.has(status) && NEXT_STATUS[status];
  const canReject = !!REJECT_TARGET[status];
  const canUnpublish = PUBLISHED.has(status);
  const phaseInfo = PHASE_LABELS[status];

  async function runAction(fn: () => Promise<{ ok: boolean; error?: string; publishedUrl?: string }>, successMsg: string) {
    setLoading(true);
    const result = await fn();
    setLoading(false);

    if (!result.ok) {
      alert(`❌ Error: ${result.error}`);
      return;
    }

    alert(successMsg + (result.publishedUrl ? `\n\nURL: ${result.publishedUrl}` : ''));
    router.refresh();
  }

  async function handleAdvance() {
    if (canPublish) {
      await runAction(() => approveArticle(articleId), '✅ Published!');
    } else {
      const nextStatus = NEXT_STATUS[status];
      if (!nextStatus) return;
      await runAction(() => advanceArticle(articleId, nextStatus), `✅ Advanced to ${nextStatus}`);
    }
  }

  async function handleRequestChanges() {
    if (!feedback.trim()) {
      alert('Please provide feedback');
      return;
    }
    const target = REJECT_TARGET[status];
    if (!target) return;

    if (status === 'awaiting_approval' || status === 'ready') {
      await runAction(() => rejectArticle(articleId, feedback), `❌ Sent back to ${target}`);
    } else {
      await runAction(() => requestChanges(articleId, target, feedback), `❌ Sent back to ${target}`);
    }
  }

  async function handleUnpublish() {
    if (!confirm('Unpublish this article from production?')) return;
    await runAction(() => unpublishArticle(articleId), '↩️ Article unpublished');
  }

  async function handleDelete() {
    if (!confirm('Delete this article permanently from pipeline? This cannot be undone.')) return;
    await runAction(() => deleteArticle(articleId, deleteReason), '🗑️ Article deleted');
  }

  async function handleMarkDuplicate() {
    await runAction(
      () => markDuplicateArticle(articleId, duplicateOfId),
      duplicateOfId.trim() ? `🧬 Marked as duplicate of #${duplicateOfId.trim()}` : '🧬 Marked as duplicate',
    );
  }

  return (
    <div className="space-y-4">
      {/* Phase verification gate */}
      {canAdvance && phaseInfo && (
        <div className="glass rounded-xl p-4 border-l-4 border-[var(--warning)]">
          <h3 className="text-[var(--hig-subhead)] font-semibold text-[var(--text-primary)] mb-1">
            {phaseInfo.title}
          </h3>
          <p className="text-sm text-[var(--text-tertiary)] mb-4">
            {phaseInfo.description}
          </p>

          {!showRejectForm ? (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleAdvance}
                disabled={loading}
                className="flex-1 min-w-[120px] bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/30 rounded-lg px-4 py-3 text-sm font-medium hover:bg-[var(--success)]/20 transition-colors disabled:opacity-50"
              >
                {loading ? 'Processing...' : phaseInfo.approveLabel}
              </button>
              {canReject && (
                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={loading}
                  className="flex-1 min-w-[120px] bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/20 rounded-lg px-4 py-3 text-sm font-medium hover:bg-[var(--error)]/15 transition-colors disabled:opacity-50"
                >
                  ✏️ Request Changes
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What needs to be fixed? (required)"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-secondary)] min-h-[80px] focus:border-[var(--accent)]/40 focus:outline-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleRequestChanges}
                  disabled={loading}
                  className="flex-1 bg-[var(--error)]/15 text-[var(--error)] border border-[var(--error)]/30 rounded-lg px-4 py-2 text-sm font-medium hover:bg-[var(--error)]/20 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Sending...' : `Send back to ${REJECT_TARGET[status]}`}
                </button>
                <button
                  onClick={() => { setShowRejectForm(false); setFeedback(''); }}
                  disabled={loading}
                  className="px-4 py-2 text-sm text-[var(--text-quaternary)] hover:text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Editor God Mode */}
      <div className="glass rounded-xl p-4 border-l-4 border-[var(--error)]/60">
        <h3 className="text-[var(--hig-subhead)] font-semibold text-[var(--text-primary)] mb-3">
          🛡️ Editor God Mode
        </h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={handleUnpublish}
            disabled={loading || !canUnpublish}
            className="rounded-lg px-4 py-2 text-sm font-medium border border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)] hover:bg-[var(--warning)]/20 disabled:opacity-40 disabled:cursor-not-allowed"
            title={canUnpublish ? 'Remove live article from production' : 'Only available for published/promoted'}
          >
            ↩️ Unpublish
          </button>

          <button
            onClick={handleDelete}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm font-medium border border-[var(--error)]/30 bg-[var(--error)]/10 text-[var(--error)] hover:bg-[var(--error)]/20 disabled:opacity-40"
          >
            🗑️ Delete Permanently
          </button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="Delete reason (optional)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-secondary)] focus:border-[var(--accent)]/40 focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              value={duplicateOfId}
              onChange={(e) => setDuplicateOfId(e.target.value)}
              placeholder="Original article ID (optional)"
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-secondary)] focus:border-[var(--accent)]/40 focus:outline-none"
            />
            <button
              onClick={handleMarkDuplicate}
              disabled={loading}
              className="rounded-lg px-3 py-2 text-sm font-medium border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text-secondary)] hover:bg-[var(--surface)] disabled:opacity-40"
            >
              Mark duplicate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
