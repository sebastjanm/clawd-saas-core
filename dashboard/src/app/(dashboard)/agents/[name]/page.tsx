import { notFound } from 'next/navigation';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AGENT_META } from '@/lib/types';
import { getCronJobs } from '@/lib/server/cron';
import { getDb } from '@/lib/server/db';
import { RunHistory } from '@/features/agents/components/server/RunHistory';
import { AgentTriggerButton } from '@/features/agents/components/client/AgentTriggerButton';
import { Card } from '@/shared/components/server/Card';
import Link from 'next/link';
import type { CronJob } from '@/lib/types';
import { findCronJobsForAgent } from '@/lib/agentCron';

const MEMORY_DIR = '/home/clawdbot/clawd/content-pipeline/agents';

function getAgentMemory(name: string): string | null {
  try {
    const filePath = path.join(MEMORY_DIR, `${name}-memory.md`);
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function getAgentCronJobs(name: string): CronJob[] {
  const allJobs = getCronJobs();
  return findCronJobsForAgent(name, allJobs);
}

function getAgentStats(name: string) {
  const db = getDb();
  const row = db.prepare(`
    SELECT 
      COUNT(*) as total_runs,
      AVG(duration_ms) as avg_duration,
      COALESCE(SUM(tokens_in), 0) + COALESCE(SUM(tokens_out), 0) as total_tokens,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
    FROM agent_runs WHERE agent_name = ?
  `).get(name) as { total_runs: number; avg_duration: number | null; total_tokens: number; error_count: number };
  return row;
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const meta = AGENT_META[name];
  if (!meta) notFound();

  const memory = getAgentMemory(name);
  const cronJobs = getAgentCronJobs(name);
  const stats = getAgentStats(name);
  const errorRate = stats.total_runs > 0 ? ((stats.error_count / stats.total_runs) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/agents" className="inline-flex items-center gap-1 text-sm text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] transition-colors">
        ← Agents
      </Link>

      {/* Hero Header */}
      <div className="flex items-center gap-5 animate-fade-up">
        <span className="text-[4rem] leading-none">{meta.emoji}</span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold capitalize text-[var(--text-primary)]">{name}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{meta.desc}</p>
          <p className="text-xs text-[var(--text-quaternary)] mt-0.5">{meta.role} · {meta.type}</p>
        </div>
        <AgentTriggerButton agentName={name} />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-fade-up" style={{ animationDelay: '80ms' }}>
        <MiniStat label="Total Runs" value={stats.total_runs.toLocaleString()} />
        <MiniStat label="Avg Duration" value={stats.avg_duration ? `${(stats.avg_duration / 1000).toFixed(1)}s` : '—'} />
        <MiniStat label="Total Tokens" value={formatTokens(stats.total_tokens)} />
        <MiniStat label="Error Rate" value={`${errorRate}%`} alert={Number(errorRate) > 10} />
      </div>

      {/* Cron Jobs */}
      {cronJobs.length > 0 && (
        <section className="animate-fade-up" style={{ animationDelay: '160ms' }}>
          <SectionLabel>Cron Schedule</SectionLabel>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {cronJobs.map((job) => (
              <Card key={job.id} className="text-sm">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-medium text-[var(--text-secondary)] text-xs">{job.name ?? job.label ?? job.id}</span>
                  <span className={`text-[var(--hig-caption1)] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    job.enabled ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--surface)] text-[var(--text-quaternary)]'
                  }`}>
                    {job.enabled ? 'enabled' : 'disabled'}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-[var(--text-quaternary)]">
                  <div className="flex justify-between">
                    <span>Schedule</span>
                    <span className="tabular-nums text-[var(--text-secondary)]">{formatSchedule(job.schedule)}</span>
                  </div>
                  {job.state?.lastRunAtMs && (
                    <div className="flex justify-between">
                      <span>Last run</span>
                      <span className="tabular-nums text-[var(--text-tertiary)]">{formatTimestamp(job.state.lastRunAtMs)}</span>
                    </div>
                  )}
                  {job.state?.nextRunAtMs && (
                    <div className="flex justify-between">
                      <span>Next run</span>
                      <span className="tabular-nums text-[var(--text-tertiary)]">{formatTimestamp(job.state.nextRunAtMs)}</span>
                    </div>
                  )}
                  {job.state?.lastStatus && (
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className={job.state.lastStatus === 'ok' ? 'text-[var(--success)]' : 'text-[var(--error)]'}>
                        {job.state.lastStatus}
                      </span>
                    </div>
                  )}
                  {(job.state?.consecutiveErrors ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span>Errors</span>
                      <span className="text-[var(--error)]">{job.state?.consecutiveErrors} consecutive</span>
                    </div>
                  )}
                  {job.state?.lastError && (
                    <p className="mt-1.5 text-[var(--error)]/80 truncate text-[var(--hig-caption1)]" title={job.state.lastError}>
                      {job.state.lastError}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Run History */}
      <section className="animate-fade-up" style={{ animationDelay: '240ms' }}>
        <SectionLabel>Run History</SectionLabel>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <RunHistory agentName={name} />
        </div>
      </section>

      {/* Memory */}
      <section className="animate-fade-up" style={{ animationDelay: '320ms' }}>
        <SectionLabel>Memory</SectionLabel>
        <Card>
          {memory ? (
            <pre className="whitespace-pre-wrap text-xs text-[var(--text-tertiary)] max-h-96 overflow-y-auto leading-relaxed" style={{ fontFamily: 'var(--font-mono)' }}>
              {memory}
            </pre>
          ) : (
            <p className="text-sm text-[var(--text-faint)]">No memory file found</p>
          )}
        </Card>
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <div className="h-px w-4 bg-[var(--surface-strong)]" />
      <h2 className="text-[var(--hig-subhead)] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">{children}</h2>
      <div className="h-px flex-1 bg-[var(--surface-hover)]" />
    </div>
  );
}

function MiniStat({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="glass-static rounded-xl p-3.5 text-center">
      <p className={`text-lg font-bold tabular-nums leading-tight ${alert ? 'text-[var(--error)]' : 'text-[var(--text-primary)]'}`}>{value}</p>
      <p className="text-[var(--hig-caption1)] font-medium uppercase tracking-wider text-[var(--text-quaternary)] mt-1">{label}</p>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatSchedule(schedule: unknown): string {
  if (typeof schedule === 'string') return schedule;
  if (typeof schedule === 'object' && schedule !== null) {
    const s = schedule as Record<string, unknown>;
    if (s.cron) return String(s.cron);
    if (s.intervalMs) return `every ${Math.round(Number(s.intervalMs) / 60000)}m`;
  }
  return JSON.stringify(schedule);
}

function formatTimestamp(ms: number): string {
  const now = Date.now();
  const diff = now - ms;
  if (diff < 0) {
    const mins = Math.floor(-diff / 60000);
    if (mins < 60) return `in ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `in ${hours}h`;
    return `in ${Math.floor(hours / 24)}d`;
  }
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
