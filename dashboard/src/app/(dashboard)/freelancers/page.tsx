import { AgentGrid } from '@/features/agents/components/client/AgentGrid';

export default function FreelancersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[var(--hig-title1)] font-semibold text-[var(--text-primary)] animate-fade-up">
            Freelance Network
          </h1>
          <p className="text-sm text-[var(--text-quaternary)] animate-fade-up delay-75">
            Specialized agents available on-demand.
          </p>
        </div>
      </div>
      
      <div className="animate-fade-up delay-100">
        <AgentGrid filter="freelancer" />
      </div>
    </div>
  );
}
