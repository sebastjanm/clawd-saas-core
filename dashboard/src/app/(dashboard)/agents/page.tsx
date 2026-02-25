import { AgentGrid } from '@/features/agents/components/client/AgentGrid';

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-[var(--hig-title1)] font-semibold text-[var(--text-primary)] leading-tight animate-fade-up">Agents</h1>
      <AgentGrid />
    </div>
  );
}
