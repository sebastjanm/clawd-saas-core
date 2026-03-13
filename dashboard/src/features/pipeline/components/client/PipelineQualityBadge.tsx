'use client';

import { usePipelineQuality } from '../../hooks/usePipelineQuality';

export function PipelineQualityBadge({ project }: { project?: string }) {
  const { data, loading, error } = usePipelineQuality();

  if (loading && !data) return null;
  if (error || !data) {
    return (
      <div className="glass-static rounded-lg px-3 py-2 text-xs text-[var(--warning)]">
        Pipeline data quality: unknown (health endpoint unavailable)
      </div>
    );
  }

  // Filter issues by project if needed?
  // Currently the quality badge checks the WHOLE pipeline health (router uptime, etc).
  // So 'project' prop is mostly unused for logic, but needed for TS compliance in the page.
  // We can display the project name if we want.

  if (data.status === 'ok') {
    return (
      <div className="glass-static rounded-lg px-3 py-2 text-xs text-[var(--success)]">
        Pipeline {project ? `(${project}) ` : ''}data quality: OK · checked {new Date(data.checkedAt).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}
      </div>
    );
  }

  return (
    <div className="glass-static rounded-lg px-3 py-2 text-xs text-[var(--warning)]">
      Pipeline {project ? `(${project}) ` : ''}data quality: DEGRADED · {data.issues.join(' · ')}
    </div>
  );
}
