'use client';

import { useState, useTransition } from 'react';
import { createProject } from '../../actions/createProject';

type Step = 1 | 2 | 3;

export function NewProjectModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [lang, setLang] = useState('en');
  
  const [tone, setTone] = useState('');
  const [audience, setAudience] = useState('');
  const [mission, setMission] = useState('');
  
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState('standard');

  const handleSubmit = () => {
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    startTransition(async () => {
      const config = {
        project_id: id,
        client_name: name,
        client: {
          company_name: name,
          contact: { email },
          plan
        },
        language: lang,
        writing: { 
          tone: tone || 'Professional', 
          target_audience: audience || 'General Public',
          mission: mission || `Establish ${name} as a leader.`,
          word_count: '800-1200', 
          guidelines: 'Standard quality guidelines.'
        },
        social: { platforms: [] }
      };
      
      const res = await createProject(config);
      if (res.ok) {
        onClose();
        window.location.reload(); 
      } else {
        setError(res.error || 'Failed');
      }
    });
  };

  const nextStep = () => setStep(s => Math.min(s + 1, 3) as Step);
  const prevStep = () => setStep(s => Math.max(s - 1, 1) as Step);

  // Validation
  const isStep1Valid = name.length > 2;
  const isStep2Valid = tone.length > 2 && audience.length > 5;
  const isStep3Valid = email.includes('@');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">New Project Wizard</h2>
            <span className="text-xs font-mono text-[var(--text-tertiary)] bg-[var(--surface-hover)] px-2 py-1 rounded">Step {step}/3</span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-[var(--border)] h-1.5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[var(--accent)] transition-all duration-300 ease-out"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">1. Basic Info</h3>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Client / Project Name *</label>
                <input 
                  className="w-full p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="e.g. Mizarstvo Hrast" 
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Primary Language</label>
                <select 
                  className="w-full p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                  value={lang} 
                  onChange={e => setLang(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="sl">Slovenian</option>
                  <option value="de">German</option>
                  <option value="hr">Croatian</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">2. Content Strategy</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Tone of Voice *</label>
                  <input 
                    className="w-full p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                    value={tone} 
                    onChange={e => setTone(e.target.value)} 
                    placeholder="e.g. Friendly, Expert" 
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Target Audience *</label>
                  <input 
                    className="w-full p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                    value={audience} 
                    onChange={e => setAudience(e.target.value)} 
                    placeholder="e.g. Homeowners, Architects" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Mission / Goal</label>
                <textarea 
                  className="w-full p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none min-h-[100px]"
                  value={mission} 
                  onChange={e => setMission(e.target.value)} 
                  placeholder="What is the main goal of this content? (e.g. Increase sales of oak tables...)" 
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">3. Business Details</h3>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Contact Email *</label>
                <input 
                  type="email"
                  className="w-full p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="contact@client.com" 
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Subscription Plan</label>
                <div className="grid grid-cols-3 gap-2">
                  {['standard', 'pro', 'enterprise'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlan(p)}
                      className={`p-3 rounded-lg border text-sm font-medium capitalize transition-all ${
                        plan === p 
                          ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' 
                          : 'border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-xs flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[var(--border)] bg-[var(--bg-secondary)] flex justify-between items-center">
          <button 
            onClick={step === 1 ? onClose : prevStep}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          
          {step < 3 ? (
            <button 
              onClick={nextStep}
              disabled={step === 1 ? !isStep1Valid : !isStep2Valid}
              className="px-6 py-2 text-sm font-medium bg-[var(--surface-hover)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--border)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next Step →
            </button>
          ) : (
            <button 
              onClick={handleSubmit} 
              disabled={!isStep3Valid || pending}
              className="px-6 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-[var(--accent)]/20"
            >
              {pending ? 'Creating Engine...' : '✨ Launch Project'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

