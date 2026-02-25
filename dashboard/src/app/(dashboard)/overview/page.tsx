import { OverviewDashboard } from '@/features/overview/components/client/OverviewDashboard';

export default function OverviewPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-[var(--hig-title1)] font-semibold text-[var(--text-primary)] animate-fade-up">
        Overview
      </h1>
      <OverviewDashboard />
    </div>
  );
}
