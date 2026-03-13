'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { toggleProjectPause, type ProjectPauseState } from '../../actions/pause';
import { PROJECT_COLORS } from '@/lib/types';

const PROJECTS = [
  { id: 'nakupsrebra', label: 'NakupSrebra' },
  { id: 'baseman-blog', label: 'Baseman Blog' },
  { id: 'avant2go-subscribe', label: 'Avant2Subscribe' },
  { id: 'lightingdesign-studio', label: 'Lighting Design' },
];

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ProjectControls({ project }: { project?: string }) {
  const [states, setStates] = useState<Record<string, ProjectPauseState>>({});
  const [expanded, setExpanded] = useState(!project); // Default expanded if showing all
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchStates = useCallback(async () => {
    try {
      const res = await fetch('/api/pipeline/projects', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setStates(data.paused ?? {});
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchStates(); }, [fetchStates]);

  // If project is set, only show that project. Otherwise show all.
  const projectsToShow = project 
    ? PROJECTS.filter(p => p.id === project)
    : PROJECTS;

  // Check if anything (relevant) is paused
  const relevantStates = Object.entries(states)
    .filter(([k]) => !project || k === project)
    .map(([, v]) => v);
    
  const anyPaused = relevantStates.some(s => s.generating || s.publishing);

  function handleToggle(project: string, type: 'generating' | 'publishing', currentlyPaused: boolean) {
    startTransition(async () => {
      const res = await toggleProjectPause(project, type, !currentlyPaused);
      if (res.ok) {
        setFeedback(`${type} ${currentlyPaused ? 'resumed' : 'paused'} for ${project}`);
        await fetchStates();
        setTimeout(() => setFeedback(null), 2000);
      } else {
        setFeedback('Action could not be completed. Please try again.');
        setTimeout(() => setFeedback(null), 3000);
      }
    });
  }

  // Simplified view for single project
  if (project) {
    return (
      <div className="glass rounded-xl p-4 animate-fade-up">
        {feedback && (
          <div className={`text-xs font-medium px-3 py-1.5 rounded-lg mb-3 ${
            feedback.includes('Failed') ? 'bg-[var(--error)]/10 text-[var(--error)]' : 'bg-[var(--success)]/10 text-[var(--success)]'
          }`}>
            {feedback}
          </div>
        )}
        
        <div className="space-y-4">
          {projectsToShow.map((p) => {
            const state = states[p.id] || { generating: false, publishing: false };
            return (
              <div key={p.id} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <PauseSwitch
                    label="Generation"
                    sublabel="Liso, Pino, Rada, Zala"
                    paused={!!state.generating}
                    by={state.generating_by}
                    at={state.generating_at}
                    disabled={pending}
                    onToggle={() => handleToggle(p.id, 'generating', !!state.generating)}
                  />
                  <PauseSwitch
                    label="Publishing"
                    sublabel="Lana"
                    paused={!!state.publishing}
                    by={state.publishing_by}
                    at={state.publishing_at}
                    disabled={pending}
                    onToggle={() => handleToggle(p.id, 'publishing', !!state.publishing)}
                  />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`glass-static rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs font-medium transition-all w-full ${
          anyPaused
            ? 'border border-[var(--warning)]/30 text-[var(--warning)]'
            : 'text-[var(--text-quaternary)] hover:text-[var(--text-secondary)]'
        }`}
      >
        <span>{anyPaused ? '⏸️' : '⚙️'}</span>
        <span>Project Controls</span>
        {anyPaused && (
          <span className="ml-1 rounded-full bg-[var(--warning)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--warning)]">
            Paused
          </span>
        )}
        <span className="ml-auto text-[var(--text-faint)]">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="glass rounded-xl p-4 mt-2 space-y-3 animate-fade-up">
          {feedback && (
            <div className={`text-xs font-medium px-3 py-1.5 rounded-lg ${
              feedback.includes('Failed') ? 'bg-[var(--error)]/10 text-[var(--error)]' : 'bg-[var(--success)]/10 text-[var(--success)]'
            }`}>
              {feedback}
            </div>
          )}

          <div className="grid gap-3">
            {projectsToShow.map((p) => {
              const state = states[p.id];
              if (!state) return null;
              return (
                <div key={p.id} className="glass-static rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: PROJECT_COLORS[p.id] || 'var(--muted)' }}
                    />
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">{p.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <PauseSwitch
                      label="Generation"
                      sublabel="Liso, Pino, Rada, Zala"
                      paused={state.generating}
                      by={state.generating_by}
                      at={state.generating_at}
                      disabled={pending}
                      onToggle={() => handleToggle(p.id, 'generating', state.generating)}
                    />
                    <PauseSwitch
                      label="Publishing"
                      sublabel="Lana"
                      paused={state.publishing}
                      by={state.publishing_by}
                      at={state.publishing_at}
                      disabled={pending}
                      onToggle={() => handleToggle(p.id, 'publishing', state.publishing)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PauseSwitch({
  label,
  sublabel,
  paused,
  by,
  at,
  disabled,
  onToggle,
}: {
  label: string;
  sublabel: string;
  paused: boolean;
  by: string | null;
  at: string | null;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`rounded-lg p-2.5 transition-colors ${
      paused ? 'bg-[var(--warning)]/8 border border-[var(--warning)]/20' : 'bg-[var(--surface-hover)]/50'
    }`}>
      <div className="flex items-center justify-between mb-1">
        <div>
          <div className="text-[11px] font-semibold text-[var(--text-secondary)]">{label}</div>
          <div className="text-[9px] text-[var(--text-faint)]">{sublabel}</div>
        </div>
        <button
          onClick={onToggle}
          disabled={disabled}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-40 ${
            paused ? 'bg-[var(--warning)]' : 'bg-[var(--success)]/60'
          }`}
          title={paused ? `Paused${by ? ` by ${by}` : ''}${at ? ` ${timeAgo(at)}` : ''}. Click to resume.` : 'Running. Click to pause.'}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              paused ? 'translate-x-4' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      {paused && (
        <div className="text-[9px] text-[var(--warning)]/80 mt-1">
          ⏸ {by || 'system'} {at ? timeAgo(at) : ''}
        </div>
      )}
    </div>
  );
}
