import { IntelligenceDashboard } from '@/features/intelligence/components/client/IntelligenceDashboard';

export default function IntelligencePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[var(--hig-title1)] font-semibold text-[var(--text-primary)]">
          📡 Intelligence
        </h1>
      </div>
      <IntelligenceDashboard />
    </div>
  );
}
