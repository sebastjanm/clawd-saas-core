'use client';

import Link from 'next/link';
import type { AgentStatus } from '@/lib/types';

interface AgentCardProps {
  agent: AgentStatus;
  delay?: number;
  dimWhenIdle?: boolean;
}

export function AgentCard({ agent, delay = 0, dimWhenIdle = false }: AgentCardProps) {
  const dbStatus = agent.lastRun?.status;
  const cronStatus = agent.cronJob?.state?.lastStatus;
  const effectiveStatus = dbStatus ?? cronStatus ?? null;

  const isRunning = effectiveStatus === 'running';
  const isError = effectiveStatus === 'error';
  const hasRecentCron = Boolean(agent.cronJob?.state?.lastRunAtMs);
  const isIdle = !effectiveStatus && !hasRecentCron && agent.runCount24h === 0;

  const statusDot = isError
    ? 'bg-[var(--error)]'
    : isRunning
      ? 'bg-[var(--accent)] status-running'
      : isIdle
        ? 'bg-[var(--text-faint)]'
        : 'bg-[var(--success)]';

  const statusLabel = isError ? 'Error' : isRunning ? 'Running' : isIdle ? 'Idle' : 'OK';

  const lastRunTime = agent.lastRun?.started_at
    ? formatAge(agent.lastRun.started_at)
    : agent.cronJob?.state?.lastRunAtMs
      ? formatAgeMs(agent.cronJob.state.lastRunAtMs)
      : 'never';

  const dimmed = dimWhenIdle && isIdle;

  return (
    <Link
      href={`/agents/${agent.name}`}
      className={`group relative flex flex-col gap-2.5 rounded-xl p-4 transition-all duration-200 glass animate-fade-up ${
        dimmed ? 'opacity-35' : ''
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Error badge */}
      {agent.errorCount24h > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[var(--error)] px-1 text-[var(--hig-caption2)] font-bold text-white shadow-lg shadow-red-500/20">
          {agent.errorCount24h}
        </span>
      )}

      {/* Header: emoji + name */}
      <div className="flex items-start gap-3">
        <span className="text-[2rem] leading-none">{agent.emoji}</span>
        <div className="min-w-0 flex-1 pt-0.5">
          <span className="text-[var(--hig-body)] font-semibold capitalize text-[var(--text-primary)] block">{agent.name}</span>
          <p className="text-[var(--hig-subhead)] text-[var(--text-tertiary)] mt-0.5 leading-snug">{agent.desc}</p>
        </div>
      </div>

      {/* Status + time */}
      <div className="flex items-center justify-between text-[var(--hig-subhead)]">
        <div className="flex items-center gap-1.5">
          <span className={`h-[6px] w-[6px] rounded-full ${statusDot}`} />
          <span className="text-[var(--text-tertiary)]">{statusLabel}</span>
        </div>
        <span className="tabular-nums text-[var(--text-faint)]">{lastRunTime}</span>
      </div>

      {/* Run count */}
      <div className="flex items-center gap-2 text-[var(--hig-subhead)] tabular-nums text-[var(--text-faint)]">
        <span>{agent.runCount24h} runs / 24h</span>
        {dimmed && <span className="text-[var(--text-quaternary)] font-medium">Available</span>}
      </div>
    </Link>
  );
}

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso + 'Z').getTime();
  return formatRelative(ms);
}

function formatAgeMs(tsMs: number): string {
  const ms = Date.now() - tsMs;
  return formatRelative(ms);
}

function formatRelative(deltaMs: number): string {
  const mins = Math.floor(deltaMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
