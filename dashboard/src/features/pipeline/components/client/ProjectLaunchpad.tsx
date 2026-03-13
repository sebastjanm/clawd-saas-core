'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { type ProjectSettings } from '../../actions/settings';
import { PROJECT_COLORS } from '@/lib/types';
import { Spinner } from '@/shared/components/client/Spinner';

interface ProjectLaunchpadProps {
  settings: ProjectSettings[];
}

export function ProjectLaunchpad({ settings }: ProjectLaunchpadProps) {
  const [pauseStates, setPauseStates] = useState<Record<string, { generating: boolean; publishing: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    // Fetch real-time pause states
    fetch('/api/pipeline/projects', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        setPauseStates(data.paused ?? {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleToggle = async (e: React.MouseEvent, project: string, isPaused: boolean) => {
    e.preventDefault(); // Stop link navigation
    e.stopPropagation();
    
    setToggling(project);
    try {
      const action = isPaused ? 'resume' : 'pause';
      const res = await fetch('/api/pipeline/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, action }),
      });
      
      if (res.ok) {
        // Optimistic update
        setPauseStates(prev => ({
          ...prev,
          [project]: { generating: !isPaused, publishing: !isPaused }
        }));
      }
    } catch (err) {
      console.error('Toggle failed', err);
    } finally {
      setToggling(null);
    }
  };

  // baseman-alpha is Intelligence, not a content project
  const projectSettings = settings.filter(s => s.project !== 'baseman-alpha');

  if (!projectSettings?.length) {
    return (
      <div className="p-12 text-center border border-[var(--border)] rounded-2xl border-dashed bg-[var(--surface)]">
        <p className="text-sm text-[var(--text-secondary)]">No projects found. Add one in config.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-up">
      {projectSettings.map((s, i) => {
        const paused = pauseStates[s.project];
        // If EITHER generating or publishing is paused, treat as paused for the toggle
        const isPaused = paused?.generating || paused?.publishing;
        const color = PROJECT_COLORS[s.project] || 'var(--text-secondary)';
        const isToggling = toggling === s.project;
        
        return (
          <Link 
            key={s.project}
            href={`/project/${s.project}/pipeline`}
            className="group relative flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 transition-all duration-300 hover:border-[var(--accent)]/50 hover:shadow-lg hover:-translate-y-1"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {/* Header with Toggle */}
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  {/* Extract first letter or icon if mapped */}
                  {s.project.substring(0, 1).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] text-lg leading-tight">
                    {s.project.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </h3>
                  <p className="text-xs text-[var(--text-tertiary)] font-mono mt-0.5">
                    {s.project}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={(e) => handleToggle(e, s.project, !!isPaused)}
                disabled={!!isToggling}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2  focus-visible:ring-white/75 ${
                  isPaused ? 'bg-[var(--surface-strong)]' : 'bg-[var(--success)]'
                } ${isToggling ? 'opacity-50 cursor-wait' : ''}`}
                title={isPaused ? "Resume Production" : "Pause Production"}
              >
                <span className="sr-only">Toggle production</span>
                <span
                  aria-hidden="true"
                  className={`${isPaused ? 'translate-x-0' : 'translate-x-5'}
                    pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out`}
                />
              </button>
            </div>

            {/* Status Line */}
            <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]/50 mt-auto">
              <div className="flex items-center gap-2">
                <span className={`relative flex h-2.5 w-2.5 items-center justify-center`}>
                   <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
                     isPaused ? 'bg-[var(--warning)] hidden' : 'bg-[var(--success)]'
                   }`} />
                   <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                     isPaused ? 'bg-[var(--warning)]' : 'bg-[var(--success)]'
                   }`} />
                </span>
                <span className={`text-xs font-semibold ${
                  isPaused ? 'text-[var(--warning)]' : 'text-[var(--success)]'
                }`}>
                  {isPaused ? 'Paused' : 'Active'}
                </span>
              </div>
              
              <span className="text-xs text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition-colors">
                Open Dashboard →
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
