import { getDb } from '@/lib/server/db';
import { AGENT_META } from '@/lib/types';
import { AgentMiniGrid } from '@/features/agents/components/client/AgentMiniGrid';
import { RecentActivity } from '@/features/agents/components/client/RecentActivity';

export default function DashboardPage() {
  const db = getDb();

  const totalAgents = Object.keys(AGENT_META).length;

  const activeRow = db
    .prepare(
      `SELECT COUNT(DISTINCT agent_name) as cnt
       FROM agent_runs
       WHERE started_at > datetime('now', '-1 day')`,
    )
    .get() as { cnt: number };

  const publishedRow = db
    .prepare(
      `SELECT COUNT(*) as cnt
       FROM articles
       WHERE status = 'published' AND published_at > datetime('now', '-1 day')`,
    )
    .get() as { cnt: number };

  const tokensRow = db
    .prepare(
      `SELECT COALESCE(SUM(tokens_in), 0) + COALESCE(SUM(tokens_out), 0) as total
       FROM agent_runs
       WHERE started_at > datetime('now', '-1 day')`,
    )
    .get() as { total: number };

  const stats = {
    total_agents: totalAgents,
    active_today: activeRow.cnt,
    published_today: publishedRow.cnt,
    tokens_today: tokensRow.total,
  };

  const uptime = loadUptimeState();

  return (
    <div className="space-y-8">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-fade-up">
        <StatCard label="Total Agents" value={stats.total_agents.toString()} icon="🤖" />
        <StatCard label="Active Today" value={stats.active_today.toString()} icon="⚡" />
        <StatCard label="Published Today" value={stats.published_today.toString()} icon="📰" />
        <StatCard
          label="Tokens Today"
          value={stats.tokens_today > 0 ? formatTokens(stats.tokens_today) : '0'}
          icon="🪙"
        />
      </div>

      {/* Uptime */}
      <section className="animate-fade-up" style={{ animationDelay: '90ms' }}>
        <SectionHeader label="Uptime" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {uptime.map((item) => (
            <div key={item.project} className="glass-static rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">{item.project}</p>
                <p className="text-xs text-[var(--text-quaternary)] mt-1">fail count: {item.failCount}</p>
              </div>
              <span className={item.failCount >= 2 ? 'text-red-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                {item.failCount >= 2 ? 'DOWN' : 'UP'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Agent Mini Grid */}
      <section className="animate-fade-up" style={{ animationDelay: '100ms' }}>
        <SectionHeader label="Agents" />
        <AgentMiniGrid />
      </section>

      {/* Recent Activity */}
      <section className="animate-fade-up" style={{ animationDelay: '200ms' }}>
        <SectionHeader label="Recent Activity" />
        <RecentActivity />
      </section>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-gradient-to-r from-[var(--divider-color)] to-transparent" />
      <h2 className="text-[var(--hig-subhead)] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)] shrink-0">{label}</h2>
      <div className="h-px flex-1 bg-gradient-to-l from-[var(--divider-color)] to-transparent" />
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="glass-static rounded-xl p-4 flex items-center gap-3.5">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xl font-bold tabular-nums text-[var(--text-primary)] leading-tight">{value}</p>
        <p className="text-[var(--hig-caption1)] font-medium uppercase tracking-wider text-[var(--text-quaternary)] mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function loadUptimeState(): Array<{ project: string; failCount: number }> {
  // In SaaS mode, we just show system status
  return [
    { project: 'EasyAI System', failCount: 0 },
    { project: 'API Gateway', failCount: 0 },
    { project: 'Writer Engine', failCount: 0 },
  ];
}
