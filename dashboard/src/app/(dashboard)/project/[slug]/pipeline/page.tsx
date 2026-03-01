'use client';

import { KanbanBoard } from '@/features/pipeline/components/client/KanbanBoard';
import { useParams } from 'next/navigation';

export default function ProjectPipelinePage() {
  const params = useParams();
  const slug = params.slug as string;

  return (
    <div className="space-y-6">
      <h2 className="text-[var(--hig-title2)] font-semibold text-[var(--text-primary)]">Pipeline</h2>
      <p className="text-sm text-[var(--text-tertiary)]">Showing articles for <strong>{slug}</strong>. Use the project filter to confirm scope.</p>
      <KanbanBoard />
    </div>
  );
}
