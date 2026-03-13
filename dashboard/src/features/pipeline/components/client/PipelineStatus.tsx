'use client';

import { usePolling } from '@/shared/hooks/usePolling';

export function PipelineStatus() {
  const { data, loading } = usePolling(async () => {
    // We'll just fetch /api/pipeline/projects for now which returns { paused: ... }
    // In a real app we'd proxy full health.
    const res = await fetch('/api/pipeline/projects');
    if (!res.ok) throw new Error('Failed');
    return res.json();
  }, 5000);

  const pausedCount = data?.paused ? Object.values(data.paused).filter((p: any) => p.generating).length : 0;
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-up">
      <StatusCard 
        label="System Status" 
        value={loading ? '...' : (pausedCount > 0 ? `${pausedCount} Paused` : 'Operational')}
        status={pausedCount > 0 ? 'warning' : 'success'}
      />
      <StatusCard 
        label="Active Agents" 
        value={loading ? '...' : '0'} // Placeholder until we wire up activeRuns
        status="neutral" 
      />
      <StatusCard 
        label="Throughput (24h)" 
        value="--" 
        status="neutral" 
      />
      <StatusCard 
        label="Queue Depth" 
        value="--" 
        status="neutral" 
      />
    </div>
  );
}

function StatusCard({ label, value, status }: { label: string; value: string; status: 'success' | 'warning' | 'error' | 'active' | 'neutral' }) {
  const styles = {
    success: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20',
    warning: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20',
    error: 'bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20',
    active: 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20',
    neutral: 'bg-[var(--surface-hover)] text-[var(--text-secondary)] border-transparent',
  };

  return (
    <div className={`glass-static rounded-xl p-4 border ${styles[status]}`}>
      <div className="text-xs font-medium opacity-80 mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
