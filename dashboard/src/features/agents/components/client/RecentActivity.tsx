'use client';

import { useCallback } from 'react';
import { usePolling } from '@/shared/hooks/usePolling';
import { apiPath } from '@/shared/lib/apiPath';
import { AGENT_META } from '@/lib/types';
import type { AgentRun } from '@/lib/types';

const TOKEN = typeof window !== 'undefined' ? 'tovarna_dashboard_2026' : '';

async function fetchRecentRuns(): Promise<AgentRun[]> {
  const res = await fetch(apiPath('/api/agents?recent=1'), {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error('Failed to fetch');
  const json = (await res.json()) as { agents: Array<{ lastRun: AgentRun | null; name: string }> };
  return json.agents
    .filter((a) => a.lastRun !== null)
    .map((a) => a.lastRun as AgentRun)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, 10);
}

export function RecentActivity() {
  const fetcher = useCallback(() => fetchRecentRuns(), []);
  const { data: runs, loading } = usePolling(fetcher, 30000);

  if (loading) {
    return (
      <div className="glass-static rounded-xl p-4">
        <p className="text-sm text-[var(--text-faint)]">Loading...</p>
      </div>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <div className="glass-static rounded-xl p-6 text-center">
        <p className="text-2xl mb-2">📊</p>
        <p className="text-sm text-[var(--text-quaternary)]">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="glass-static rounded-xl overflow-hidden p-0">
      <div className="divide-y divide-[var(--border-subtle)]">
        {runs.map((run, i) => {
          const meta = AGENT_META[run.agent_name];
          const statusColor: Record<string, string> = {
            ok: 'text-[var(--success)]',
            running: 'text-[var(--accent)]',
            error: 'text-[var(--error)]',
            timeout: 'text-[var(--warning)]',
            killed: 'text-[var(--text-quaternary)]',
          };

          return (
            <div
              key={run.id}
              className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--surface)] ${
                i % 2 === 1 ? 'bg-[var(--surface-alt)]' : ''
              }`}
            >
              <span className="text-base shrink-0">{meta?.emoji ?? '❓'}</span>
              <span className="text-[var(--hig-callout)] font-medium capitalize text-[var(--text-secondary)] w-16 shrink-0 truncate">
                {run.agent_name}
              </span>
              <span className={`text-xs font-medium w-12 shrink-0 ${statusColor[run.status] ?? 'text-[var(--text-quaternary)]'}`}>
                {run.status}
              </span>
              <span className="text-xs tabular-nums text-[var(--text-quaternary)] w-14 shrink-0">
                {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}
              </span>
              <span className="text-xs text-[var(--text-faint)] truncate flex-1">
                {run.task_summary ?? '—'}
              </span>
              <span className="text-[var(--hig-subhead)] tabular-nums text-[var(--text-faint)] shrink-0">
                {formatTime(run.started_at)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso + 'Z');
  const now = Date.now();
  const ms = now - d.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
