'use client';

import { useAgents } from '../../hooks/useAgents';
import { AgentCard } from './AgentCard';
import { Spinner } from '@/shared/components/client/Spinner';
import { AGENT_META } from '@/lib/types';

const GROUP_ORDER = ['research', 'content', 'distribution', 'ops', 'strategy'] as const;
const GROUP_LABELS: Record<string, string> = {
  research: 'Research',
  content: 'Content',
  distribution: 'Distribution',
  ops: 'Operations',
  strategy: 'Strategy',
};

export function AgentGrid() {
  const { data: agents, loading, error } = useAgents();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (error || !agents) {
    return (
      <div className="glass-static rounded-xl p-4 text-sm text-[var(--error)]">
        Failed to load agents: {error}
      </div>
    );
  }

  const pipeline = agents.filter((a) => a.type === 'pipeline');
  const freelancers = agents.filter((a) => a.type === 'freelancer');

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    agents: pipeline.filter((a) => AGENT_META[a.name]?.group === group),
  })).filter((g) => g.agents.length > 0);

  return (
    <div className="space-y-8">
      {grouped.map((g, gi) => (
        <div key={g.group} className="animate-fade-up" style={{ animationDelay: `${gi * 80}ms` }}>
          {/* Section header: ── LABEL ────── */}
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px w-4 bg-[var(--surface-strong)]" />
            <h3 className="text-[var(--hig-subhead)] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
              {g.label}
            </h3>
            <div className="h-px flex-1 bg-[var(--surface-hover)]" />
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {g.agents.map((agent, ai) => (
              <AgentCard key={agent.name} agent={agent} delay={(gi * 80) + (ai * 40)} />
            ))}
          </div>
        </div>
      ))}

      {/* Freelancers */}
      {freelancers.length > 0 && (
        <div className="animate-fade-up" style={{ animationDelay: `${grouped.length * 80 + 100}ms` }}>
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px w-4 bg-[var(--surface-strong)]" />
            <h3 className="text-[var(--hig-subhead)] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
              Freelancers
            </h3>
            <div className="h-px flex-1 bg-[var(--surface-hover)]" />
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {freelancers.map((agent, i) => (
              <AgentCard key={agent.name} agent={agent} delay={i * 40} dimWhenIdle />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
