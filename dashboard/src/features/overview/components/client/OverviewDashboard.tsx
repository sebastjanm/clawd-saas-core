'use client';

import { useOverview, type OverviewData } from '../../hooks/useOverview';
import { Spinner } from '@/shared/components/client/Spinner';
import { PROJECT_COLORS } from '@/lib/types';

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 min-w-[140px]">
      <div className="text-2xl font-bold text-[var(--text-primary)]" style={{ color, fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)] mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{sub}</div>}
    </div>
  );
}

function TrendBar({ data }: { data: OverviewData['dailyTrend'] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="text-xs font-semibold text-[var(--text-secondary)] mb-3">Daily Publishes (14 days)</div>
      <div className="flex items-end gap-1 h-16">
        {data.map(d => (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-sm bg-[var(--accent)] transition-all"
              style={{ height: `${Math.max((d.count / max) * 100, 4)}%`, minHeight: 2, opacity: d.count > 0 ? 1 : 0.2 }}
              title={`${d.day}: ${d.count}`}
            />
            <span className="text-[8px] text-[var(--text-faint)]">{d.day.slice(8)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectRow({ project, total, week, avgDays }: { project: string; total: number; week: number; avgDays: number | null }) {
  const color = PROJECT_COLORS[project] ?? '#64748b';
  return (
    <div className="flex items-center gap-3 py-2 border-b border-[var(--border-subtle)] last:border-0">
      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-sm text-[var(--text-primary)] flex-1">{project}</span>
      <span className="text-xs text-[var(--text-tertiary)] w-16 text-right">{week} this wk</span>
      <span className="text-xs text-[var(--text-faint)] w-16 text-right">{total} total</span>
      <span className="text-xs text-[var(--text-faint)] w-20 text-right">{avgDays ? `${avgDays}d avg` : '—'}</span>
    </div>
  );
}

function AgentRow({ name, runs, ok, failed }: { name: string; runs: number; ok: number; failed: number }) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-[var(--border-subtle)] last:border-0">
      <span className="text-sm text-[var(--text-primary)] flex-1">{name}</span>
      <span className="text-xs text-[var(--text-tertiary)] w-12 text-right">{runs} runs</span>
      <span className="text-xs text-[var(--success)] w-10 text-right">{ok} ✓</span>
      {failed > 0 && <span className="text-xs text-[var(--error)] w-10 text-right">{failed} ✗</span>}
    </div>
  );
}

function RecentArticle({ title, project, published_at, published_url }: { title: string; project: string; published_at: string; published_url: string }) {
  const color = PROJECT_COLORS[project] ?? '#64748b';
  const ago = Math.round((Date.now() - new Date(published_at + 'Z').getTime()) / 3600000);
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-[var(--border-subtle)] last:border-0">
      <span className="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        {published_url ? (
          <a href={published_url} target="_blank" rel="noreferrer" className="text-sm text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors line-clamp-1">
            {title}
          </a>
        ) : (
          <span className="text-sm text-[var(--text-primary)] line-clamp-1">{title}</span>
        )}
        <span className="text-[10px] text-[var(--text-faint)]">{ago}h ago</span>
      </div>
    </div>
  );
}

export function OverviewDashboard() {
  const { data, loading, error } = useOverview();

  if (loading && !data) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (error) return <div className="rounded-xl border border-[var(--error)]/20 bg-[var(--error)]/5 p-4 text-sm text-[var(--error)]">{error}</div>;
  if (!data) return null;

  const totalArticles = data.statusCounts.reduce((s, c) => s + c.count, 0);
  const published = data.statusCounts.find(s => s.status === 'published')?.count ?? 0;
  const inFlightCount = data.inFlight.reduce((s, c) => s + c.count, 0);
  const socialDrafts = data.socialStats.find(s => s.status === 'draft')?.count ?? 0;
  const socialPosted = data.socialStats.find(s => s.status === 'posted')?.count ?? 0;
  const pendingDecisions = data.strategyStats.find(s => s.status === 'pending')?.count ?? 0;

  return (
    <div className="space-y-6">
      {/* Top stats */}
      <div className="flex flex-wrap gap-3">
        <StatCard label="Published" value={published} sub={`of ${totalArticles} total`} />
        <StatCard label="This Week" value={data.publishedThisWeek} color="var(--accent)" />
        <StatCard label="In Flight" value={inFlightCount} sub="active pipeline" />
        <StatCard label="Failure Rate" value={`${data.failureRate}%`} color={data.failureRate > 10 ? 'var(--error)' : 'var(--success)'} />
        <StatCard label="Social" value={`${socialPosted}/${socialPosted + socialDrafts}`} sub={`${socialDrafts} drafts pending`} />
        <StatCard label="Cost (7d)" value={data.tokenUsage?.total_cost ? `$${data.tokenUsage.total_cost.toFixed(2)}` : '$0'} />
        {pendingDecisions > 0 && <StatCard label="Strategy" value={pendingDecisions} sub="decisions pending" color="var(--warning)" />}
      </div>

      {/* Trend + Projects */}
      <div className="grid gap-4 lg:grid-cols-2">
        {data.dailyTrend.length > 0 && <TrendBar data={data.dailyTrend} />}

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Projects</div>
          {data.byProject.map(p => {
            const week = data.byProjectWeek.find(w => w.project === p.project)?.count ?? 0;
            const avg = data.avgPipelineTime.find(a => a.project === p.project)?.avg_days ?? null;
            return <ProjectRow key={p.project} project={p.project} total={p.count} week={week} avgDays={avg} />;
          })}
        </div>
      </div>

      {/* Recent + Agents */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Recent Publishes</div>
          {data.recentPublishes.length === 0 ? (
            <p className="text-xs text-[var(--text-faint)] py-4 text-center">No recent publishes</p>
          ) : (
            data.recentPublishes.map((a: any) => (
              <RecentArticle key={a.id} title={a.title} project={a.project} published_at={a.published_at} published_url={a.published_url} />
            ))
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Agent Activity (7d)</div>
          {data.agentRunsWeek.length === 0 ? (
            <p className="text-xs text-[var(--text-faint)] py-4 text-center">No agent runs this week</p>
          ) : (
            data.agentRunsWeek.map(a => (
              <AgentRow key={a.agent_name} name={a.agent_name} runs={a.runs} ok={a.ok} failed={a.failed} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
