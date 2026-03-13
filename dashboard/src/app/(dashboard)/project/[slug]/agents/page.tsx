import { AgentGrid } from '@/features/agents/components/client/AgentGrid';

export default function ProjectAgentsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-[var(--hig-title2)] font-semibold text-[var(--text-primary)]">Project Team</h2>
      <AgentGrid filter="pipeline" />
    </div>
  );
}
