'use client';

import { useState } from 'react';
import { useStrategy, actOnDecision, type StrategyDecision } from '../../hooks/useStrategy';
import { useProjects } from '@/shared/hooks/useProjects';
import { Spinner } from '@/shared/components/client/Spinner';
import { PROJECT_COLORS } from '@/lib/types';

const TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  kill_pillar:    { icon: '🗑️', label: 'Kill Pillar', color: '#ef4444' },
  boost_pillar:   { icon: '🚀', label: 'Boost Pillar', color: '#10b981' },
  add_pillar:     { icon: '➕', label: 'Add Pillar', color: '#3b82f6' },
  avoid_topic:    { icon: '🚫', label: 'Avoid Topic', color: '#f59e0b' },
  scale_up:       { icon: '📈', label: 'Scale Up', color: '#10b981' },
  scale_down:     { icon: '📉', label: 'Scale Down', color: '#ef4444' },
  content_mix:    { icon: '🎯', label: 'Content Mix', color: '#8b5cf6' },
  platform_focus: { icon: '📱', label: 'Platform Focus', color: '#06b6d4' },
  custom:         { icon: '💡', label: 'Custom', color: '#64748b' },
};

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-[var(--warning)]/15 text-[var(--warning)]',
  approved: 'bg-[var(--accent)]/15 text-[var(--accent)]',
  applied:  'bg-[var(--success)]/15 text-[var(--success)]',
  rejected: 'bg-[var(--error)]/15 text-[var(--error)]',
};

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'applied', label: 'Applied' },
  { value: 'rejected', label: 'Rejected' },
];

function DecisionCard({
  decision,
  onAction,
  busy,
}: {
  decision: StrategyDecision;
  onAction: (id: number, action: 'approve' | 'reject') => void;
  busy: boolean;
}) {
  const typeMeta = TYPE_META[decision.decision_type] ?? TYPE_META.custom;
  const projectColor = PROJECT_COLORS[decision.project] ?? '#64748b';

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3 transition-colors hover:border-[var(--border-hover)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-base"
            style={{ backgroundColor: `${typeMeta.color}20` }}
          >
            {typeMeta.icon}
          </span>
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{typeMeta.label}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: projectColor }} />
              <span className="text-[10px] font-medium text-[var(--text-faint)] uppercase tracking-wide">
                {decision.project}
              </span>
            </div>
          </div>
        </div>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ${STATUS_STYLES[decision.status] ?? STATUS_STYLES.pending}`}>
          {decision.status}
        </span>
      </div>

      {/* Target */}
      <div className="rounded-lg bg-[var(--surface-alt)] border border-[var(--border-subtle)] px-3 py-2">
        <span className="text-sm font-medium text-[var(--text-primary)]">{decision.target}</span>
      </div>

      {/* Reason */}
      <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">{decision.reason}</p>

      {/* Data source */}
      {decision.data_source && (
        <p className="text-[10px] text-[var(--text-faint)]">
          📊 {decision.data_source}
        </p>
      )}

      {/* Timestamps */}
      {decision.applied_at && (
        <p className="text-[10px] text-[var(--success)]">
          Applied {new Date(decision.applied_at).toLocaleDateString()}
        </p>
      )}

      {/* Actions */}
      {decision.status === 'pending' && (
        <div className="flex items-center gap-1.5 pt-1">
          <button
            onClick={() => onAction(decision.id, 'approve')}
            disabled={busy}
            className="flex-1 rounded-lg bg-[var(--success)]/15 px-3 py-2 text-xs font-semibold text-[var(--success)] transition-colors hover:bg-[var(--success)]/25 disabled:opacity-40"
          >
            Approve & Apply
          </button>
          <button
            onClick={() => onAction(decision.id, 'reject')}
            disabled={busy}
            className="rounded-lg bg-[var(--error)]/15 px-3 py-2 text-xs font-semibold text-[var(--error)] transition-colors hover:bg-[var(--error)]/25 disabled:opacity-40"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

export function StrategyDashboard() {
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const { projects } = useProjects();

  const { data, loading, error, refetch } = useStrategy(
    statusFilter || undefined,
    projectFilter || undefined,
  );

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    setBusy(true);
    try {
      await actOnDecision(id, action);
      await refetch();
    } finally {
      setBusy(false);
    }
  };

  const totalByStatus = (data?.stats ?? []).reduce(
    (acc, s) => { acc[s.status] = s.count; return acc; },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        {STATUS_TABS.filter(t => t.value).map(tab => (
          <div key={tab.value} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-center min-w-[90px]">
            <div className="text-lg font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-mono)' }}>
              {totalByStatus[tab.value] ?? 0}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              {tab.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-0.5">
          {STATUS_TABS.map(tab => (
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
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)] outline-none"
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading && !data ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : error ? (
        <div className="rounded-xl border border-[var(--error)]/20 bg-[var(--error)]/5 p-4 text-sm text-[var(--error)]">{error}</div>
      ) : !data?.decisions.length ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center">
          <span className="text-4xl">🐺</span>
          <p className="mt-3 text-sm text-[var(--text-tertiary)]">
            No strategy decisions yet. Vuk will create them after his Sunday analysis.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.decisions.map(d => (
            <DecisionCard key={d.id} decision={d} onAction={handleAction} busy={busy} />
          ))}
        </div>
      )}
    </div>
  );
}
