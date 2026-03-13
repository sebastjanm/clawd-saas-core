'use client';

import { PipelineStatus } from '@/features/pipeline/components/client/PipelineStatus';
import { ProjectSwimlane } from '@/features/pipeline/components/client/ProjectSwimlane';
import { usePolling } from '@/shared/hooks/usePolling';
import { apiPath } from '@/shared/lib/apiPath';
import type { PipelineColumn } from '@/lib/types';
import { useEffect } from 'react';

export default function PipelinePage() {
  useEffect(() => {
    console.log('🏭 FACTORY FLOOR MOUNTED - V3 (REAL)');
  }, []);

  const { data, loading } = usePolling(async () => {
    const res = await fetch(apiPath('/api/pipeline'));
    if (!res.ok) throw new Error('Failed to fetch pipeline');
    const json = (await res.json()) as { columns: PipelineColumn[] };
    return json;
  }, 10000);

  // Group by projects we care about
  const projectIds = ['nakupsrebra', 'baseman-blog', 'avant2go-subscribe', 'lightingdesign-studio'];

  // Map the single global pipeline into per-project data
  const columns = data?.columns || [];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[var(--hig-title1)] font-semibold text-[var(--text-primary)] animate-fade-up">
            Factory Floor (V3 Live)
          </h1>
          <p className="text-sm text-[var(--text-quaternary)] animate-fade-up delay-75">
            Real-time view of Tovarna OS production lines
          </p>
        </div>
      </div>

      <PipelineStatus />
      
      <div className="space-y-6 animate-fade-up delay-100">
        {loading && !columns.length ? (
          <div className="text-center py-12 text-[var(--text-quaternary)]">Loading factory lines...</div>
        ) : (
          projectIds.map(pid => (
            <ProjectSwimlane 
              key={pid} 
              projectId={pid} 
              pipeline={columns} 
            />
          ))
        )}
      </div>
    </div>
  );
}
