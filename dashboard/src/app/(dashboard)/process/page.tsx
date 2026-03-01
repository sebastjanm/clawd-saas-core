export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/server/db';
import { FlowGraph } from '@/features/pipeline/components/client/FlowGraph';

interface StageStats {
  count: number;
  avgHours: number;
}

function getStageStats(): Record<string, StageStats> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT status, COUNT(*) as count,
    AVG(CAST((julianday('now') - julianday(updated_at)) * 24 AS REAL)) as avg_hours
    FROM articles WHERE status NOT IN ('failed')
    GROUP BY status
  `).all() as Array<{ status: string; count: number; avg_hours: number }>;
  
  const map: Record<string, StageStats> = {};
  for (const r of rows) {
    map[r.status] = { count: r.count, avgHours: r.avg_hours ?? 0 };
  }
  return map;
}

function getRouterLog(): Array<{ timestamp: string; source_agent: string; project: string; action: string; target_agent: string | null; reason: string | null }> {
  const db = getDb();
  try {
    return db.prepare(`
      SELECT timestamp, source_agent, project, action, target_agent, reason
      FROM router_log
      ORDER BY id DESC
      LIMIT 10
    `).all() as Array<{ timestamp: string; source_agent: string; project: string; action: string; target_agent: string | null; reason: string | null }>;
  } catch {
    return [];
  }
}

function getTodayActivity(): Array<{ agent: string; emoji: string; action: string; time: string }> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT agent_name, status, task_summary, started_at
    FROM agent_runs
    WHERE started_at > datetime('now', '-24 hours')
    ORDER BY started_at DESC
    LIMIT 12
  `).all() as Array<{ agent_name: string; status: string; task_summary: string | null; started_at: string }>;

  const EMOJIS: Record<string, string> = {
    oti: '🦦', liso: '🦊', pino: '🕷️', rada: '🦉', zala: '🎨',
    lana: '🕊️', bea: '🐝', maci: '🐱', medo: '🐻', kroki: '🐦‍⬛',
    vuk: '🐺', oly: '🫒',
  };

  return rows.map(r => ({
    agent: r.agent_name,
    emoji: EMOJIS[r.agent_name] ?? '❓',
    action: r.task_summary ?? r.status,
    time: formatTime(r.started_at),
  }));
}

function formatTime(iso: string): string {
  const d = new Date(iso + 'Z');
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Ljubljana' });
}

export default function ProcessPage() {
  const stats = getStageStats();
  const activity = getTodayActivity();
  const routerLog = getRouterLog();

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="text-[var(--hig-title1)] font-semibold text-[var(--text-primary)]">Process</h1>
        <p className="text-[var(--hig-body)] text-[var(--text-tertiary)] mt-1">One cron trigger starts the chain at midnight. Everything after that is event-driven — each agent triggers the next via webhook on completion.</p>
      </div>

      {/* Flow Graph */}
      <div className="glass-static rounded-xl p-6 animate-fade-up" style={{ animationDelay: '80ms' }}>
        <FlowGraph stats={stats} />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-5 text-[var(--hig-subhead)] text-[var(--text-quaternary)] animate-fade-up" style={{ animationDelay: '160ms' }}>
        <span className="flex items-center gap-1.5">
          <span className="h-4 w-4 border border-[var(--border)] rounded" /> — solid arrow = sequential flow
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-5 border-t border-dashed border-[var(--text-faint)]" /> — dashed = triggers / feeds
        </span>
        <span className="flex items-center gap-1.5">
          ⏰ = cron (fixed schedule)
        </span>
        <span className="flex items-center gap-1.5">
          🔗 = webhook-triggered (router fires on completion)
        </span>
      </div>

      {/* Router Log */}
      {routerLog.length > 0 && (
        <div className="animate-fade-up" style={{ animationDelay: '200ms' }}>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-[var(--divider-color)] to-transparent" />
            <h2 className="text-[var(--hig-subhead)] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)] shrink-0">🔗 Router Decisions</h2>
            <div className="h-px flex-1 bg-gradient-to-l from-[var(--divider-color)] to-transparent" />
          </div>
          <div className="glass-static rounded-xl overflow-hidden">
            <div className="divide-y divide-[var(--border-subtle)]">
              {routerLog.map((r, i) => {
                const actionColor = r.action === 'triggered' ? 'text-[var(--success)]'
                  : r.action === 'no_work' ? 'text-[var(--text-faint)]'
                  : r.action === 'cooldown' ? 'text-[var(--warning)]'
                  : r.action.includes('error') ? 'text-[var(--error)]'
                  : 'text-[var(--text-tertiary)]';
                const actionIcon = r.action === 'triggered' ? '✅'
                  : r.action === 'no_work' ? '⏭️'
                  : r.action === 'cooldown' ? '⏳'
                  : r.action.includes('error') ? '❌'
                  : '•';
                return (
                  <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${i % 2 === 1 ? 'bg-[var(--surface-alt)]' : ''}`}>
                    <span className="text-sm shrink-0">{actionIcon}</span>
                    <span className={`text-[var(--hig-callout)] font-medium w-24 shrink-0 ${actionColor}`}>
                      {r.action}
                    </span>
                    <span className="text-[var(--hig-callout)] text-[var(--text-secondary)] truncate flex-1">
                      {r.source_agent && `${r.source_agent} → `}{r.target_agent ?? ''} {r.project ? `(${r.project})` : ''} {r.reason ? `— ${r.reason}` : ''}
                    </span>
                    <span className="text-[var(--hig-subhead)] tabular-nums text-[var(--text-faint)] shrink-0">
                      {r.timestamp.slice(11, 16)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Today's activity */}
      {activity.length > 0 && (
        <div className="animate-fade-up" style={{ animationDelay: '240ms' }}>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-[var(--divider-color)] to-transparent" />
            <h2 className="text-[var(--hig-subhead)] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)] shrink-0">Today&apos;s Activity</h2>
            <div className="h-px flex-1 bg-gradient-to-l from-[var(--divider-color)] to-transparent" />
          </div>
          <div className="glass-static rounded-xl overflow-hidden">
            <div className="divide-y divide-[var(--border-subtle)]">
              {activity.map((a, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${i % 2 === 1 ? 'bg-[var(--surface-alt)]' : ''}`}>
                  <span className="text-base shrink-0">{a.emoji}</span>
                  <span className="text-[var(--hig-callout)] font-medium text-[var(--text-secondary)] w-14 shrink-0 capitalize">{a.agent}</span>
                  <span className="text-[var(--hig-callout)] text-[var(--text-tertiary)] truncate flex-1">{a.action}</span>
                  <span className="text-[var(--hig-subhead)] tabular-nums text-[var(--text-faint)] shrink-0">{a.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
