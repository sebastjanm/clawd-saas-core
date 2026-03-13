import { AgentGrid } from '@/features/agents/components/client/AgentGrid';

export default function AgentsPage() {
  return (
    <div className="space-y-10">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[var(--hig-title1)] font-semibold text-[var(--text-primary)] animate-fade-up">
            Factory Team
          </h1>
          <p className="text-sm text-[var(--text-quaternary)] animate-fade-up delay-75">
            Core pipeline workers and system operators.
          </p>
        </div>
      </div>

      {/* 1. Pipeline Agents (The Factory Line) */}
      <div className="space-y-4 animate-fade-up delay-100">
        <h2 className="text-[var(--hig-subhead)] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
          Pipeline
        </h2>
        <AgentGrid filter="pipeline" />
      </div>

      {/* 2. System Agents (Ops) */}
      <div className="space-y-4 animate-fade-up delay-200">
        <h2 className="text-[var(--hig-subhead)] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
          System Ops
        </h2>
        <AgentGrid filter="system" />
      </div>

    </div>
  );
}
