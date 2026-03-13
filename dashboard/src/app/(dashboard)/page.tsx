import { getProjectSettings } from '@/features/pipeline/actions/settings';
import { ProjectLaunchpad } from '@/features/pipeline/components/client/ProjectLaunchpad';
import { RecentActivity } from '@/features/agents/components/client/RecentActivity';
import { OverviewDashboard } from '@/features/overview/components/client/OverviewDashboard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const settings = await getProjectSettings();

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[var(--hig-title1)] font-semibold text-[var(--text-primary)] animate-fade-up">
            Factory Overview
          </h1>
          <p className="text-sm text-[var(--text-quaternary)] animate-fade-up delay-75">
            System status, production lines, and live feed.
          </p>
        </div>
      </div>

      {/* 1. Metrics (Cockpit) */}
      <div className="animate-fade-up delay-100">
        <h2 className="mb-4 text-[var(--hig-subhead)] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
          System Pulse
        </h2>
        <OverviewDashboard />
      </div>

      {/* 2. Projects (Control) */}
      <div className="animate-fade-up delay-150">
        <h2 className="mb-4 text-[var(--hig-subhead)] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
          Production Lines
        </h2>
        <ProjectLaunchpad settings={settings} />
      </div>

      {/* 3. Feed (Logs) */}
      <div className="animate-fade-up delay-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[var(--hig-subhead)] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
            Live Feed
          </h2>
        </div>
        <RecentActivity />
      </div>
    </div>
  );
}
