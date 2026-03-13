'use client';

import { useState, useEffect, useRef } from 'react';

const PROVIDERS = [
  { id: 'soniox', label: 'Soniox', icon: '⚡' },
  { id: 'whisper', label: 'Whisper', icon: '🤫' },
];

const LANGUAGES = [
  { id: 'auto', label: 'auto (Auto-detect)' },
  { id: 'sl', label: '🇸🇮 Slovenščina' },
  { id: 'en', label: '🇬🇧 English' },
  { id: 'de', label: '🇩🇪 Deutsch' },
  { id: 'hr', label: '🇭🇷 Hrvatski' },
  { id: 'sr', label: '🇷🇸 Srpski' },
  { id: 'bs', label: '🇧🇦 Bosanski' },
  { id: 'es', label: '🇪🇸 Español' },
  { id: 'fr', label: '🇫🇷 Français' },
  { id: 'it', label: '🇮🇹 Italiano' },
];

const TRANSLATE_OPTIONS = [
  { id: '', label: 'Brez' },
  { id: 'en', label: '🇬🇧 English' },
  { id: 'sl', label: '🇸🇮 Slovenščina' },
  { id: 'de', label: '🇩🇪 Deutsch' },
];

const ACCEPTED_FORMATS = '.mp3,.wav,.m4a,.ogg,.flac,.aac,.webm,.mp4';

export function SttTool() {
  const [provider, setProvider] = useState('soniox');
  const [inputType, setInputType] = useState<'file' | 'url'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [lang, setLang] = useState('auto');
  const [translateTo, setTranslateTo] = useState('');
  const [diarize, setDiarize] = useState(false);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedResult, setSelectedResult] = useState<any | null>(null);
  const [activeTranscript, setActiveTranscript] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch('/api/tools/stt/history').then(res => res.json()).then(data => { if (Array.isArray(data)) setHistory(data); }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!jobId || jobStatus === 'completed' || jobStatus === 'error') return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/tools/transcribe/${jobId}`);
        const data = await res.json();
        if (data.status === 'completed') {
          setJobStatus('completed'); setLoading(false);
          const newEntry = { id: jobId, prompt: file ? file.name : url, output_path: data.url, created_at: new Date().toISOString() };
          setHistory(prev => [newEntry, ...prev]); setSelectedResult(newEntry); setActiveTranscript(data.text);
        } else if (data.status === 'failed') {
          setJobStatus('failed'); setLoading(false);
        } else {
          setJobStatus(data.status);
          pollRef.current = setTimeout(poll, 3000);
        }
      } catch { pollRef.current = setTimeout(poll, 5000); }
    };
    poll();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [jobId, jobStatus]);

  useEffect(() => {
    if (selectedResult?.output_path) {
      fetch(selectedResult.output_path).then(res => res.text()).then(setActiveTranscript).catch(console.error);
    }
  }, [selectedResult]);

  const handleTranscribe = async () => {
    setLoading(true); setJobId(null); setJobStatus('queued');
    try {
      const formData = new FormData();
      formData.append('provider', provider);
      if (inputType === 'file' && file) formData.append('file', file);
      else if (inputType === 'url') formData.append('url', url);
      formData.append('lang', lang);
      formData.append('diarize', String(diarize));
      if (translateTo) formData.append('translate', translateTo);
      const res = await fetch('/api/tools/transcribe', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJobId(data.id);
    } catch (e: any) { setLoading(false); setJobStatus('error'); }
  };

  return (
    <div className="flex h-[calc(100vh-180px)] overflow-hidden rounded-xl border border-[var(--border)]">

      {/* ── Left Panel: Controls ── */}
      <div className="w-[380px] shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--surface)]/30">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Provider */}
          <div className="flex gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  provider === p.id
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <span>{p.icon}</span> {p.label}
              </button>
            ))}
          </div>

          {/* Input type */}
          <div className="flex gap-1.5">
            {([
              { id: 'file' as const, label: 'Datoteka' },
              { id: 'url' as const, label: 'URL' },
            ]).map((t) => (
              <button
                key={t.id}
                onClick={() => setInputType(t.id)}
                className={`px-2.5 py-1 text-[11px] rounded-md font-medium transition-all ${
                  inputType === t.id
                    ? 'text-[var(--accent)] bg-[var(--accent)]/10'
                    : 'text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <hr className="border-[var(--border)]" />

          {/* File upload or URL */}
          {inputType === 'file' ? (
            <Section label="Vhodna datoteka">
              <div
                className="relative"
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
              >
                <input
                  type="file"
                  accept={ACCEPTED_FORMATS}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className={`h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1.5 transition-all ${
                  dragOver
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 scale-[1.01]'
                    : file
                      ? 'border-green-500/40 bg-green-500/5'
                      : 'border-[var(--border)] hover:border-[var(--accent)]/30'
                }`}>
                  {file ? (
                    <>
                      <span className="text-lg">✓</span>
                      <p className="text-xs font-medium text-[var(--text)] truncate max-w-[280px]">{file.name}</p>
                      <p className="text-[10px] text-[var(--text-quaternary)]">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                    </>
                  ) : (
                    <>
                      <span className="text-lg opacity-40">↑</span>
                      <p className="text-xs text-[var(--text-tertiary)]">Spusti avdio/video datoteko ali klikni</p>
                      <p className="text-[10px] text-[var(--text-quaternary)]">.mp3, .wav, .m4a, .ogg, .flac, .aac, .webm, .mp4 — maks 500MB</p>
                    </>
                  )}
                </div>
              </div>
            </Section>
          ) : (
            <Section label="URL">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://primer.com/posnetek.mp3"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </Section>
          )}

          {/* Language */}
          <Section label="Jezik">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </Section>

          {/* Translate to */}
          <Section label="Prevedi v">
            <select
              value={translateTo}
              onChange={(e) => setTranslateTo(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            >
              {TRANSLATE_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </Section>

          {/* Diarization toggle */}
          <label className="flex items-center gap-3 cursor-pointer group py-1">
            <div
              className={`relative w-9 h-5 rounded-full transition-colors ${diarize ? 'bg-[var(--accent)]' : 'bg-[var(--surface)]'} border border-[var(--border)]`}
              onClick={() => setDiarize(!diarize)}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${diarize ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-xs text-[var(--text-secondary)]">Ločevanje govorcev</span>
          </label>
        </div>

        {/* Transcribe button */}
        <div className="p-5 pt-3 space-y-3">
          <button
            onClick={handleTranscribe}
            disabled={loading || (inputType === 'file' && !file) || (inputType === 'url' && !url)}
            className={`w-full py-3 rounded-xl font-semibold text-sm tracking-wide transition-all ${
              loading
                ? 'bg-[var(--surface)] text-[var(--text-tertiary)] cursor-wait'
                : 'bg-[var(--accent)] text-white hover:brightness-110 active:scale-[0.98]'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                {jobStatus === 'queued' ? 'V vrsti...' : jobStatus === 'processing' ? 'Obdelava...' : 'Nalaganje...'}
              </span>
            ) : (
              'PREPIŠI'
            )}
          </button>

          {jobStatus === 'error' && (
            <p className="text-xs text-red-400 text-center bg-red-400/10 rounded-lg py-2 px-3">Napaka pri prepisu. Poskusite znova.</p>
          )}
        </div>
      </div>

      {/* ── Right Panel: History + Transcript ── */}
      <div className="flex-1 min-w-0 flex bg-[var(--background)]">

        {/* History sidebar */}
        <div className="w-48 shrink-0 border-r border-[var(--border)] flex flex-col">
          <div className="px-3 py-3 border-b border-[var(--border)]">
            <span className="text-xs text-[var(--text-tertiary)] font-medium">
              {history.length > 0 ? `STT Zgodovina` : 'Zgodovina'}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-[11px] text-[var(--text-quaternary)] text-center py-8 px-3">Še ni STT izvedb</p>
            ) : (
              history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedResult(item)}
                  className={`w-full text-left px-3 py-2.5 transition-all hover:bg-[var(--surface-hover)] group ${
                    selectedResult?.id === item.id
                      ? 'bg-[var(--surface-hover)] border-r-2 border-r-[var(--accent)]'
                      : ''
                  }`}
                >
                  <p className="text-xs text-[var(--text)] truncate">{item.prompt}</p>
                  <p className="text-[10px] text-[var(--text-quaternary)] mt-0.5">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Transcript viewer */}
        <div className="flex-1 overflow-y-auto">
          {selectedResult ? (
            <div className="p-6 max-w-3xl">
              <div className="flex items-start justify-between mb-4 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text)]">{selectedResult.prompt}</h3>
                  <p className="text-[10px] text-[var(--text-quaternary)] mt-0.5 font-mono">
                    {new Date(selectedResult.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(activeTranscript)}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/8 transition-all bg-[var(--surface)] border border-[var(--border)]"
                >
                  Kopiraj
                </button>
              </div>
              <div className="text-sm leading-7 text-[var(--text-secondary)] whitespace-pre-wrap selection:bg-[var(--accent)]/20">
                {activeTranscript || (
                  <span className="text-[var(--text-quaternary)] italic">Nalaganje prepisa...</span>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] flex items-center justify-center">
                <span className="text-2xl opacity-30">🎙️</span>
              </div>
              <p className="text-sm text-[var(--text-tertiary)]">Ni izbranega prepisa</p>
              <p className="text-xs text-[var(--text-quaternary)]">Naloži posnetek in klikni Prepiši</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
