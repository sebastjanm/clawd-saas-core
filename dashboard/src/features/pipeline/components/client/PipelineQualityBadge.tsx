'use client';

import { usePipelineQuality } from '../../hooks/usePipelineQuality';

export function PipelineQualityBadge() {
  const { data, loading, error } = usePipelineQuality();

  if (loading && !data) return null;
  if (error || !data) {
    return (
      <div className="glass-static rounded-lg px-3 py-2 text-xs text-[var(--warning)]">
        Pipeline data quality: unknown (health endpoint unavailable)
      </div>
    );
  }

  if (data.status === 'ok') {
    return (
      <div className="glass-static rounded-lg px-3 py-2 text-xs text-[var(--success)]">
        Pipeline data quality: OK · checked {new Date(data.checkedAt).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}
      </div>
    );
  }

  return (
    <div className="glass-static rounded-lg px-3 py-2 text-xs text-[var(--warning)]">
      Pipeline data quality: DEGRADED · {data.issues.join(' · ')}
    </div>
  );
}
