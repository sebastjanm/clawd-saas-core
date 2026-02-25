import { getDb } from '@/lib/server/db';
import { Card } from '@/shared/components/server/Card';
import type { AgentRun } from '@/lib/types';

interface RunHistoryProps {
  agentName: string;
}

export function RunHistory({ agentName }: RunHistoryProps) {
  const db = getDb();
  const runs = db
    .prepare(
      'SELECT * FROM agent_runs WHERE agent_name = ? ORDER BY started_at DESC LIMIT 20',
    )
    .all(agentName) as AgentRun[];

  if (runs.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--muted)]">No runs recorded yet.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="min-w-[600px]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[var(--hig-subhead)] font-semibold uppercase tracking-wider text-[var(--muted)]">
              <th className="sticky left-0 bg-[var(--surface)] px-4 py-2.5">Started</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Duration</th>
              <th className="px-4 py-2.5">Tokens In</th>
              <th className="px-4 py-2.5">Tokens Out</th>
              <th className="px-4 py-2.5">Article</th>
              <th className="px-4 py-2.5">Task</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr
                key={run.id}
                className="border-b border-[var(--border)] transition-colors hover:bg-[var(--surface)]"
              >
                <td className="sticky left-0 bg-[var(--background)] px-4 py-2 tabular-nums text-[var(--muted)] whitespace-nowrap">
                  {run.started_at}
                </td>
                <td className="px-4 py-2">
                  <StatusDot status={run.status} />
                </td>
                <td className="px-4 py-2 tabular-nums text-[var(--text-tertiary)]">
                  {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}
                </td>
                <td className="px-4 py-2 tabular-nums text-[var(--text-tertiary)]">
                  {run.tokens_in ? run.tokens_in.toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2 tabular-nums text-[var(--text-tertiary)]">
                  {run.tokens_out ? run.tokens_out.toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2 tabular-nums text-[var(--text-tertiary)]">
                  {run.article_id ?? '—'}
                </td>
                <td className="max-w-xs truncate px-4 py-2 text-[var(--text-tertiary)]">
                  {run.task_summary ?? run.error ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ok: 'text-[var(--success)]',
    running: 'text-[var(--accent)]',
    error: 'text-[var(--error)]',
    timeout: 'text-[var(--warning)]',
    killed: 'text-[var(--text-tertiary)]',
  };
  return (
    <span className={`text-xs font-medium ${colors[status] ?? 'text-[var(--text-tertiary)]'}`}>
      {status}
    </span>
  );
}
