'use client';

import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useState } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { usePipeline } from '../../hooks/usePipeline';
import { updateArticleStatus } from '../../actions';
import { Spinner } from '@/shared/components/client/Spinner';
import { PROJECT_COLORS } from '@/lib/types';
import type { Article, ArticleStatus } from '@/lib/types';

const PROJECTS = [
  { id: '', label: 'All projects' },
  { id: 'easyai-start', label: 'EasyAI Start' },
];

export function KanbanBoard() {
  const [selectedProject, setSelectedProject] = useState<string>('');
  const { data: columns, loading, error, refetch } = usePipeline(selectedProject || undefined);
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (error || !columns) {
    return (
      <div className="glass rounded-lg p-4 text-sm text-[var(--error)]">
        Failed to load pipeline: {error}
      </div>
    );
  }

  // Only show columns that have articles
  const activeColumns = columns.filter((col) => col.articles.length > 0);

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id.toString();
    for (const col of columns ?? []) {
      const article = col.articles.find((a) => a.id.toString() === id);
      if (article) {
        setActiveArticle(article);
        break;
      }
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveArticle(null);
    const { active, over } = event;
    if (!over) return;

    const articleId = Number(active.id);
    const targetStatus = over.id.toString() as ArticleStatus;

    let currentStatus: ArticleStatus | null = null;
    for (const col of columns ?? []) {
      if (col.articles.some((a) => a.id === articleId)) {
        currentStatus = col.status;
        break;
      }
    }

    if (currentStatus === targetStatus) return;

    try {
      await updateArticleStatus(articleId, targetStatus);
      await refetch();
    } catch {
      // Error already handled by the action
    }
  }

  if (activeColumns.length === 0) {
    return (
      <>
        <ProjectFilter selected={selectedProject} onChange={setSelectedProject} />
        <div className="glass rounded-lg p-8 text-center text-sm text-[var(--text-quaternary)]">
          No articles in pipeline
        </div>
      </>
    );
  }

  return (
    <>
      <ProjectFilter selected={selectedProject} onChange={setSelectedProject} />

    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="kanban-scroll flex gap-3 overflow-x-auto pb-4">
        {activeColumns.map((col, i) => (
          <KanbanColumn key={col.status} column={col} index={i} />
        ))}
      </div>
      <DragOverlay>
        {activeArticle ? (
          <div className="glass drag-glow rounded-lg p-3">
            <p className="text-sm font-medium text-[var(--text-primary)]">{activeArticle.title}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
    </>
  );
}

function ProjectFilter({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (project: string) => void;
}) {
  return (
    <div className="glass-static rounded-xl p-3 flex flex-wrap gap-3 items-center animate-fade-up">
      <span className="text-xs text-[var(--text-quaternary)]">Filter:</span>
      {PROJECTS.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-all min-h-[36px] ${
            selected === p.id
              ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20'
              : 'text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] border border-transparent'
          }`}
        >
          {p.id && (
            <span
              className="inline-block w-2 h-2 rounded-full mr-1.5"
              style={{ backgroundColor: PROJECT_COLORS[p.id] || 'var(--muted)' }}
            />
          )}
          {p.label}
        </button>
      ))}
    </div>
  );
}
