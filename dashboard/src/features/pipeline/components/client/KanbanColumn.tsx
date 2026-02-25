'use client';

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ArticleCard } from './ArticleCard';
import type { PipelineColumn } from '@/lib/types';

interface KanbanColumnProps {
  column: PipelineColumn;
  index: number;
}

export function KanbanColumn({ column, index }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-xl transition-all duration-200 animate-fade-up ${
        isOver
          ? 'bg-[var(--accent)]/[0.04] ring-1 ring-[var(--accent)]/20'
          : 'bg-[var(--surface-alt)]'
      }`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Glass header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--border-subtle)]">
        <span className="text-[var(--hig-subhead)] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
          {column.label}
        </span>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)]/15 px-1.5 text-[var(--hig-subhead)] font-bold tabular-nums text-[var(--accent)]">
          {column.articles.length}
        </span>
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto px-2 py-2">
        <SortableContext
          items={column.articles.map((a) => a.id.toString())}
          strategy={verticalListSortingStrategy}
        >
          {column.articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </SortableContext>
        {column.articles.length === 0 && (
          <div className="rounded-lg border border-dashed border-[var(--border)] py-6 text-center text-[var(--hig-subhead)] text-[var(--text-faint)]">
            No articles
          </div>
        )}
      </div>
    </div>
  );
}
