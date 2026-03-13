'use client';

import { PipelineColumn, ArticleStatus, Article, PROJECT_COLORS } from '@/lib/types';
import Link from 'next/link';

// Map specific project IDs to readable labels
const PROJECT_LABELS: Record<string, string> = {
  'nakupsrebra': 'NakupSrebra',
  'baseman-blog': 'Baseman Blog',
  'avant2go-subscribe': 'Avant2Subscribe',
  'lightingdesign-studio': 'Lighting Design'
};

export function ProjectSwimlane({ projectId, pipeline }: { projectId: string; pipeline: PipelineColumn[] }) {
  // Filter the pipeline columns to only include articles for this project
  const articlesByStage = {
    Idea: [] as Article[],
    Writing: [] as Article[],
    Review: [] as Article[],
    Publishing: [] as Article[],
    Done: [] as Article[]
  };

  let totalItems = 0;

  // Flatten and categorize
  if (pipeline) {
    pipeline.forEach(col => {
      if (col && col.articles) {
        col.articles.forEach(article => {
          if (article.project === projectId) {
            if (col.status === 'backlog' || col.status === 'todo') articlesByStage.Idea.push(article);
            else if (col.status === 'writing') articlesByStage.Writing.push(article);
            else if (col.status === 'review' || col.status === 'ready_for_design') articlesByStage.Review.push(article);
            else if (col.status === 'ready' || col.status === 'awaiting_approval') articlesByStage.Publishing.push(article);
            else if (col.status === 'published' || col.status === 'promoted') articlesByStage.Done.push(article);
            
            totalItems++;
          }
        });
      }
    });
  }

  const label = PROJECT_LABELS[projectId] || projectId;
  const color = PROJECT_COLORS[projectId] || '#888';

  return (
    <div className="glass rounded-xl p-5 transition-all hover:bg-[var(--surface-hover)] border border-transparent hover:border-[var(--border)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: color }} />
          <h3 className="font-semibold text-[var(--text-primary)] text-lg">{label}</h3>
          <span className="text-xs text-[var(--text-quaternary)] px-2.5 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)] font-medium">
            {totalItems} items
          </span>
        </div>
        <div className="flex items-center gap-2">
           <Link href={`/project/${projectId}/pipeline`} className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-3 py-1.5 rounded-lg hover:bg-[var(--surface)] border border-transparent hover:border-[var(--border)] flex items-center gap-1">
             View Board <span className="opacity-50">→</span>
           </Link>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 overflow-x-auto pb-2">
        <StageCard label="Idea" items={articlesByStage.Idea} />
        <StageCard label="Writing" items={articlesByStage.Writing} active />
        <StageCard label="Review" items={articlesByStage.Review} />
        <StageCard label="Publishing" items={articlesByStage.Publishing} />
        <StageCard label="Done" items={articlesByStage.Done} />
      </div>
    </div>
  );
}

function StageCard({ label, items, active }: { label: string; items: Article[]; active?: boolean }) {
  const count = items.length;
  
  return (
    <div className={`rounded-lg p-3 min-w-[140px] border transition-colors flex flex-col h-full ${
      active && count > 0 
        ? 'bg-[var(--accent)]/5 border-[var(--accent)]/20' 
        : 'bg-[var(--surface)]/50 border-[var(--border)]/50'
    }`}>
      <div className="flex justify-between items-center mb-2.5">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? 'text-[var(--accent)]' : 'text-[var(--text-quaternary)]'}`}>
          {label}
        </span>
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${count > 0 ? 'bg-[var(--surface-hover)] text-[var(--text-primary)]' : 'text-[var(--text-faint)]'}`}>
          {count}
        </span>
      </div>
      
      {/* Mini items list (max 3) */}
      <div className="space-y-2 flex-1">
        {count === 0 ? (
          <div className="h-full min-h-[60px] flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-[var(--text-faint)]/20" />
          </div>
        ) : (
          <>
            {items.slice(0, 3).map(article => (
              <div key={article.id} className="text-[11px] font-medium truncate px-2.5 py-2 bg-[var(--surface)] rounded border border-[var(--border)] text-[var(--text-secondary)] shadow-sm hover:border-[var(--text-quaternary)] transition-colors cursor-default" title={article.title}>
                {article.title}
              </div>
            ))}
            {count > 3 && (
              <div className="text-[10px] text-center text-[var(--text-quaternary)] pt-1 font-medium">
                + {count - 3} more
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
