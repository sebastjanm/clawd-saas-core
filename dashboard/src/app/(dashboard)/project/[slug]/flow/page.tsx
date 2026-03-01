'use client';

import { FlowGraph } from '@/features/pipeline/components/client/FlowGraph';
import { usePipeline } from '@/features/pipeline/hooks/usePipeline';
import { useParams } from 'next/navigation';

export default function ProjectFlowPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: columns } = usePipeline(slug);

  // Transform pipeline columns into stats for the graph
  const stats: Record<string, { count: number; avgHours: number }> = {};
  
  if (columns) {
    for (const col of columns) {
      stats[col.status] = {
        count: col.articles.length,
        avgHours: 0, // We don't have this data easily yet
      };
    }
  }

  return (
    <div className="glass-static rounded-2xl p-6 min-h-[600px] overflow-x-auto flex items-center justify-center animate-fade-up">
      <FlowGraph stats={stats} />
    </div>
  );
}
