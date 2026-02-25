'use client';

import { useState, useTransition, useEffect, useCallback, useRef } from 'react';
import { type ProjectSettings, updateProjectSettings } from '../../actions/settings';
import { type ProjectPauseState, toggleProjectPause } from '../../actions/pause';

function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
  variant = 'default',
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  variant?: 'default' | 'warning' | 'success';
}) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer select-none group ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors mt-0.5 border border-transparent group-hover:border-white/10"
        style={{
          backgroundColor: checked
            ? variant === 'warning' ? 'var(--warning)'
              : variant === 'success' ? 'var(--success)'
              : 'var(--accent)'
            : 'var(--border)'
        }}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
          }`}
        />
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-[var(--text)] leading-snug">{label}</span>
        {hint && <span className="text-[11px] text-[var(--text-tertiary)] leading-tight mt-0.5">{hint}</span>}
      </div>
    </label>
  );
}

function NumberInput({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 10,
  disabled
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <label className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-8 h-8 flex items-center justify-center rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-quaternary)] text-[var(--text)] transition-colors"
          disabled={value <= min}
        >
          -
        </button>
        <div className="flex-1 text-center font-mono text-sm bg-[var(--bg-tertiary)] rounded-md py-1.5 border border-[var(--border)]">
          {value}
        </div>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-8 h-8 flex items-center justify-center rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-quaternary)] text-[var(--text)] transition-colors"
          disabled={value >= max}
        >
          +
        </button>
      </div>
      {hint && <span className="text-[10px] text-[var(--text-quaternary)] text-center">{hint}</span>}
    </div>
  );
}

function ProjectCard({
  settings: initial,
  pauseState,
  onPauseToggle,
}: {
  settings: ProjectSettings;
  pauseState?: ProjectPauseState;
  onPauseToggle: (project: string, type: 'generating' | 'publishing', paused: boolean) => void;
}) {
  const [s, setS] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  // Sync with initial props if they change (e.g. after revalidation)
  // We use a ref to track the previous initial settings to avoid loops/stale reverts
  const prevInitialRef = useRef(JSON.stringify(initial));
  useEffect(() => {
    const currentJson = JSON.stringify(initial);
    if (prevInitialRef.current !== currentJson) {
      setS(prev => ({ ...prev, ...initial }));
      prevInitialRef.current = currentJson;
    }
  }, [initial]);

  const save = (updates: Partial<ProjectSettings>) => {
    const next = { ...s, ...updates };
    setS(next);
    startTransition(async () => {
      const result = await updateProjectSettings(s.project, updates);
      if (result.ok) {
        setLastSaved(Date.now());
      }
    });
  };

  const projectColors: Record<string, string> = {
    nakupsrebra: '#C0C0C0', // Silver
    'baseman-blog': '#000000', // Black
    'avant2go-subscribe': '#00AEEF', // Blue
  };

  const projectLabels: Record<string, string> = {
    nakupsrebra: 'Nakup Srebra',
    'baseman-blog': 'Baseman Blog',
    'avant2go-subscribe': 'Avant2Go',
  };

  const isGeneratingPaused = !!pauseState?.generating;
  const isPublishingPaused = !!pauseState?.publishing;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden transition-all duration-200 hover:border-[var(--border-hover)]">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between bg-[var(--bg-tertiary)]/30 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <div
            className="w-3 h-3 rounded-full shadow-sm"
            style={{ backgroundColor: projectColors[s.project] || 'var(--text-secondary)' }}
          />
          <h3 className="font-semibold text-[var(--text)] tracking-tight">
            {projectLabels[s.project] || s.project}
          </h3>
          {/* Status Badge */}
          {s.paused === 1 ? (
             <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20">PAUSED</span>
          ) : isGeneratingPaused && isPublishingPaused ? (
             <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20">PAUSED</span>
          ) : isGeneratingPaused ? (
             <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20">GEN PAUSED</span>
          ) : isPublishingPaused ? (
             <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20">PUB PAUSED</span>
          ) : s.vacation_mode === 1 ? (
             <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">VACATION</span>
          ) : (
             <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20">ACTIVE</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPending && <span className="text-[10px] text-[var(--text-tertiary)] animate-pulse">Saving...</span>}
          {!isPending && lastSaved && (Date.now() - lastSaved < 2000) && (
            <span className="text-[10px] text-[var(--success)] animate-fade-out">Saved</span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Row 1: Production Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
             <div className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-2">
               <span>Flow Control</span>
               <div className="h-px bg-[var(--border)] flex-1"/>
             </div>
             <div className="space-y-3 pl-1">
               <Toggle
                 label="Generation"
                 hint="Liso, Pino, Rada, Zala"
                 checked={!isGeneratingPaused}
                 onChange={(v) => onPauseToggle(s.project, 'generating', !v)}
                 variant="success"
               />
               <Toggle
                 label="Publishing"
                 hint="Lana (Upload & Deploy)"
                 checked={!isPublishingPaused}
                 onChange={(v) => onPauseToggle(s.project, 'publishing', !v)}
                 variant="success"
               />
             </div>
          </div>

          <div className="space-y-3">
             <div className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-2">
               <span>Quality Gates</span>
               <div className="h-px bg-[var(--border)] flex-1"/>
             </div>
             <div className="space-y-3 pl-1">
               <Toggle
                 label="Auto-Approve"
                 hint="Skip human review step"
                 checked={!!s.auto_approve}
                 onChange={(v) => save({ auto_approve: v ? 1 : 0 })}
                 variant="warning"
               />
             </div>
          </div>
        </div>

        {/* Row 2: Capacity Settings (Grouped) */}
        <div className={`rounded-lg border transition-all duration-300 ${
          s.vacation_mode
            ? 'bg-[var(--accent)]/5 border-[var(--accent)]/20'
            : 'bg-[var(--bg-tertiary)]/30 border-[var(--border)]'
        }`}>
           <div className="p-3">
             <div className="flex items-center justify-between mb-3">
               <div className="flex items-center gap-2">
                 <span className="text-lg">{s.vacation_mode ? '🌴' : '🏭'}</span>
                 <span className="text-sm font-semibold text-[var(--text)]">
                   {s.vacation_mode ? 'Vacation Mode' : 'Standard Operations'}
                 </span>
               </div>
               <Toggle
                 label={s.vacation_mode ? "Enabled" : "Standard"}
                 checked={!!s.vacation_mode}
                 onChange={(v) => save({ vacation_mode: v ? 1 : 0 })}
                 variant="default" // accent color
               />
             </div>

             <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[var(--border)]/50">
                <div className={s.vacation_mode ? 'opacity-50 grayscale' : ''}>
                  <NumberInput
                    label="Daily Limit"
                    hint="Normal articles/day"
                    value={s.daily_limit}
                    onChange={(v) => save({ daily_limit: v })}
                    min={1}
                    max={10}
                    disabled={!!s.vacation_mode}
                  />
                </div>
                <div className={!s.vacation_mode ? 'opacity-50 grayscale' : ''}>
                  <NumberInput
                    label="Vacation Limit"
                    hint="Override when away"
                    value={s.vacation_limit}
                    onChange={(v) => save({ vacation_limit: v })}
                    min={1}
                    max={20}
                    disabled={!s.vacation_mode}
                  />
                </div>
             </div>
             <p className="text-[10px] text-[var(--text-tertiary)] mt-3 text-center italic">
               {s.vacation_mode
                 ? "Vacation mode active: Using higher limit. Auto-approve recommended."
                 : "Standard mode active: Using daily limit."}
             </p>
           </div>
        </div>
      </div>
    </div>
  );
}

export function ProjectSettingsPanel({ settings }: { settings: ProjectSettings[] }) {
  const [pauseStates, setPauseStates] = useState<Record<string, ProjectPauseState>>({});
  const [, startTransition] = useTransition();

  const fetchPauseStates = useCallback(async () => {
    try {
      const res = await fetch('/api/pipeline/projects', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setPauseStates(data.paused ?? {});
      }
    } catch { /* silent */ }
  }, []);

  // Poll for status updates every 5s
  useEffect(() => {
    fetchPauseStates();
    const interval = setInterval(fetchPauseStates, 5000);
    return () => clearInterval(interval);
  }, [fetchPauseStates]);

  const handlePauseToggle = (project: string, type: 'generating' | 'publishing', paused: boolean) => {
    // Optimistic update
    setPauseStates((prev) => ({
      ...prev,
      [project]: {
        ...(prev[project] || {}),
        [type]: paused,
      },
    }));

    startTransition(async () => {
      try {
        await toggleProjectPause(project, type, paused);
      } catch (err) {
        console.error('Pause toggle failed', err);
      } finally {
        await fetchPauseStates();
      }
    });
  };

  if (!settings?.length) {
    return (
      <div className="p-8 text-center border border-[var(--border)] rounded-xl border-dashed">
        <p className="text-sm text-[var(--text-secondary)]">No project settings found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {settings.map((s) => (
        <ProjectCard
          key={s.project}
          settings={s}
          pauseState={pauseStates[s.project]}
          onPauseToggle={handlePauseToggle}
        />
      ))}
    </div>
  );
}
