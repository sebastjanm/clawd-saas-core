'use client';

import { useState, useEffect } from 'react';
import { usePolling } from '@/shared/hooks/usePolling';
import { apiPath } from '@/shared/lib/apiPath';
import { Spinner } from '@/shared/components/client/Spinner';
import { PROJECT_COLORS } from '@/lib/types';
import type { Article } from '@/lib/types';
import Link from 'next/link';

interface LibraryResponse {
  articles: Article[];
}

const TOKEN = typeof window !== 'undefined' ? 'tovarna_dashboard_2026' : '';

const PROJECTS = [
  { id: '', label: 'All projects' },
  { id: 'nakupsrebra', label: 'NakupSrebra' },
  { id: 'baseman-blog', label: 'Baseman Blog' },
  { id: 'avant2go-subscribe', label: 'Avant2Subscribe' },
  { id: 'lightingdesign-studio', label: 'Lighting Design' },
];

async function fetchLibrary(project?: string): Promise<Article[]> {
  const url = project
    ? apiPath(`/api/library?project=${encodeURIComponent(project)}`)
    : apiPath('/api/library');
  const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  if (!res.ok) throw new Error('Failed to fetch library');
  const json = (await res.json()) as LibraryResponse;
  return json.articles;
}

export function PublishedLibrary({ initialProject }: { initialProject?: string }) {
  // If initialProject provided, lock to it.
  const [selectedProject, setSelectedProject] = useState<string>(initialProject || '');
  
  // Sync state if prop changes
  useEffect(() => {
    if (initialProject) setSelectedProject(initialProject);
  }, [initialProject]);
  
  const { data: articles, loading, error } = usePolling(
    () => fetchLibrary(selectedProject || undefined),
    30000 
  );

  // Hide filter if scoped
  const showProjectFilter = !initialProject;

  if (loading && !articles) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <div className="text-[var(--error)] p-4 glass rounded-lg">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {showProjectFilter && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {PROJECTS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p.id)}
              className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-all whitespace-nowrap ${
                selectedProject === p.id
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
      )}

      <div className="grid grid-cols-1 gap-3">
        {articles?.map((article) => (
          <div 
            key={article.id} 
            className="glass rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-[var(--border-hover)]"
          >
             <div className="space-y-1 flex-1">
               <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] mb-1">
                 <span 
                   className="w-2 h-2 rounded-full"
                   style={{ backgroundColor: PROJECT_COLORS[article.project] }}
                 />
                 <span className="uppercase tracking-wider font-medium">{article.project}</span>
                 <span>•</span>
                 <span>{new Date(article.published_at || article.updated_at || '').toLocaleDateString()}</span>
               </div>
               <Link href={`/articles/${article.id}`} className="block group">
                 <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                   {article.title}
                 </h3>
               </Link>
               {article.abstract && (
                 <p className="text-xs text-[var(--text-secondary)] mt-1.5 line-clamp-2 max-w-2xl leading-relaxed">
                   {article.abstract}
                 </p>
               )}
               {article.published_url && (
                 <a 
                   href={article.published_url} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1 mt-1"
                 >
                   View Live ↗
                 </a>
               )}
             </div>

             <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded text-[10px] font-medium border ${
                  article.status === 'promoted' 
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    : 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20'
                }`}>
                  {article.status.toUpperCase()}
                </span>
             </div>
          </div>
        ))}

        {articles?.length === 0 && (
          <div className="text-center py-12 text-[var(--text-quaternary)]">
            No published articles found.
          </div>
        )}
      </div>
    </div>
  );
}
