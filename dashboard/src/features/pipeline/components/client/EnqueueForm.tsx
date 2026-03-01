'use client';

import { useProjects } from '@/shared/hooks/useProjects';
import { useState, useTransition } from 'react';
import { enqueueArticle } from '../../actions/controls';



const PRIORITIES = [
  { id: 'normal' as const, label: 'Normal', icon: '' },
  { id: 'high' as const, label: 'High', icon: '🔥' },
  { id: 'now' as const, label: 'Now', icon: '⚡' },
];

export function EnqueueForm() {
  const { projects: PROJECTS } = useProjects();
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState(PROJECTS[0].id);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high' | 'now'>('high');
  const [brief, setBrief] = useState('');
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function handleSubmit() {
    if (!title.trim()) return;
    startTransition(async () => {
      const res = await enqueueArticle(project, title.trim(), priority, brief.trim() || undefined);
      if (res.ok) {
        setResult({ ok: true, msg: `Article #${res.articleId} created` });
        setTitle('');
        setBrief('');
        setTimeout(() => { setResult(null); setOpen(false); }, 2000);
      } else {
        setResult({ ok: false, msg: res.error ?? 'Failed' });
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
      >
        + New article
      </button>
    );
  }

  return (
    <div className="glass rounded-xl p-4 space-y-3 animate-fade-up">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Add article to pipeline</h3>
        <button
          onClick={() => { setOpen(false); setResult(null); }}
          className="text-xs text-[var(--text-faint)] hover:text-[var(--text-secondary)]"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
        {/* Title */}
        <div>
          <label className="block text-[10px] font-medium text-[var(--text-faint)] mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Article title or topic..."
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        {/* Project */}
        <div>
          <label className="block text-[10px] font-medium text-[var(--text-faint)] mb-1">Project</label>
          <select
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            {PROJECTS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-[10px] font-medium text-[var(--text-faint)] mb-1">Priority</label>
          <div className="flex gap-1">
            {PRIORITIES.map((p) => (
              <button
                key={p.id}
                onClick={() => setPriority(p.id)}
                className={`rounded-md px-2.5 py-2 text-[10px] font-semibold transition-all ${
                  priority === p.id
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/25'
                    : 'text-[var(--text-faint)] border border-[var(--border)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {p.icon} {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Brief (optional) */}
      <div>
        <label className="block text-[10px] font-medium text-[var(--text-faint)] mb-1">Brief / angle (optional)</label>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Angle, key points, source intel..."
          rows={2}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
        />
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || pending}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {pending ? 'Creating...' : 'Create article'}
        </button>
        {result && (
          <span className={`text-xs font-medium ${result.ok ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
            {result.msg}
          </span>
        )}
      </div>
    </div>
  );
}
