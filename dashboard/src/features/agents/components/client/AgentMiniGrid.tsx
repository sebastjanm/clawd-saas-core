'use client';

import Link from 'next/link';
import { useAgents } from '../../hooks/useAgents';
import { Spinner } from '@/shared/components/client/Spinner';

export function AgentMiniGrid() {
  const { data: agents, loading, error } = useAgents();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="sm" />
      </div>
    );
  }

  if (error || !agents) {
    return (
      <div className="glass-static rounded-xl p-3 text-sm text-[var(--error)]">
        Failed to load agents
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-8 gap-2">
      {agents.map((agent) => {
        const isRunning = agent.lastRun?.status === 'running';
        const isError = agent.lastRun?.status === 'error';
        const dotColor = isError
          ? 'bg-[var(--error)]'
          : isRunning
            ? 'bg-[var(--accent)] status-running'
            : agent.runCount24h > 0
              ? 'bg-[var(--success)]'
              : 'bg-[var(--surface-strong)]';

        return (
          <Link
            key={agent.name}
            href={`/agents/${agent.name}`}
            className="glass flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 transition-all min-h-[44px]"
            title={`${agent.name} — ${agent.role}`}
          >
            <div className="relative">
              <span className="text-xl">{agent.emoji}</span>
              <span className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ${dotColor}`} />
            </div>
            <span className="text-[var(--hig-caption1)] font-medium text-[var(--text-tertiary)] capitalize">{agent.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
