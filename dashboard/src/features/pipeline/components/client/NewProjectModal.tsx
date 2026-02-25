'use client';

import { useState, useTransition } from 'react';
import { createProject } from '../../actions/createProject';

export function NewProjectModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [lang, setLang] = useState('en');
  const [tone, setTone] = useState('professional');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    startTransition(async () => {
      const config = {
        project_id: id,
        client_name: name,
        language: lang,
        writing: { 
          tone, 
          word_count: '800-1200', 
          target_audience: 'General',
          forbidden: [],
          guidelines: 'Standard quality guidelines.'
        },
        social: { platforms: [] }
      };
      
      const res = await createProject(config);
      if (res.ok) {
        onClose();
        // Force hard reload to update client-side caches and server state
        window.location.reload(); 
      } else {
        setError(res.error || 'Failed');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 space-y-4 shadow-2xl">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">New Project</h2>
        
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Client Name</label>
            <input 
              className="w-full p-2 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="e.g. Mizarstvo Hrast" 
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Language</label>
              <select 
                className="w-full p-2 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                value={lang} 
                onChange={e => setLang(e.target.value)}
              >
                <option value="en">English</option>
                <option value="sl">Slovenian</option>
                <option value="de">German</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Tone</label>
              <input 
                className="w-full p-2 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                value={tone} 
                onChange={e => setTone(e.target.value)} 
                placeholder="e.g. Professional" 
              />
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-[var(--error)] bg-[var(--error)]/10 p-2 rounded">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]/50">
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={pending || !name} 
                  className="px-4 py-2 text-xs font-medium bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm">
            {pending ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
