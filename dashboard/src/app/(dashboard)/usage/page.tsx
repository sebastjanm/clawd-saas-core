import { UsageDashboard } from '@/features/usage/components/client/UsageDashboard';

export default function UsagePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-[var(--text-primary)] animate-fade-up">Usage</h1>
      <UsageDashboard />
    </div>
  );
}
