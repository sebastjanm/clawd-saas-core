import { KanbanBoard } from '@/features/pipeline/components/client/KanbanBoard';
import { PipelineQualityBadge } from '@/features/pipeline/components/client/PipelineQualityBadge';
import { EnqueueForm } from '@/features/pipeline/components/client/EnqueueForm';

export default function PipelinePage() {
  return (
    <div className="space-y-5 pipeline-fullwidth">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[var(--hig-title1)] font-semibold text-[var(--text-primary)] animate-fade-up">Pipeline</h1>
        <EnqueueForm />
      </div>
      <PipelineQualityBadge />
      <KanbanBoard />
    </div>
  );
}
