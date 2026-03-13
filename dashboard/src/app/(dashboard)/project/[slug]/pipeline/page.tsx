'use client';

import { KanbanBoard } from '@/features/pipeline/components/client/KanbanBoard';
import { PipelineQualityBadge } from '@/features/pipeline/components/client/PipelineQualityBadge';
import { EnqueueForm } from '@/features/pipeline/components/client/EnqueueForm';
import { useParams } from 'next/navigation';

export default function ProjectPipelinePage() {
  // Client component: useParams is safe (returns object, not promise)
  const params = useParams();
  const slug = params.slug as string;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-[var(--hig-title2)] font-semibold text-[var(--text-primary)]">Pipeline</h2>
        <EnqueueForm defaultProject={slug} />
      </div>
      
      <PipelineQualityBadge project={slug} />
      <KanbanBoard initialProject={slug} />
    </div>
  );
}
