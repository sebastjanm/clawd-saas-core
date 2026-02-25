import { StrategyDashboard } from '@/features/strategy/components/client/StrategyDashboard';

export default function StrategyPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-[var(--hig-title1)] font-semibold text-[var(--text-primary)] animate-fade-up">
        Strategy
      </h1>
      <StrategyDashboard />
    </div>
  );
}
