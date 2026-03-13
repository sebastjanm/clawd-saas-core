'use client';

import { useState, useEffect, useRef } from 'react';

const TOKEN = typeof window !== 'undefined' ? 'tovarna_dashboard_2026' : '';
const authHeaders = { 'Authorization': `Bearer ${TOKEN}` };

/* ── Constants ── */

const LANGUAGES = [
  { id: 'auto', label: 'auto (Auto-detect)' },
  { id: 'sl', label: '🇸🇮 Slovenščina' },
  { id: 'en', label: '🇬🇧 English' },
  { id: 'hr', label: '🇭🇷 Hrvatski' },
  { id: 'sr', label: '🇷🇸 Srpski' },
  { id: 'de', label: '🇩🇪 Deutsch' },
  { id: 'fr', label: '🇫🇷 Français' },
  { id: 'es', label: '🇪🇸 Español' },
  { id: 'it', label: '🇮🇹 Italiano' },
];

type Phase = 'select' | 'transcribing' | 'edit' | 'style' | 'burn';

interface VideoFile {
  id: string;
  name: string;
  size: number;
  url: string;
  uploadedAt: string;
}

interface SubtitleEntry {
  id: string;
  start: number;   // seconds
  end: number;      // seconds
  text: string;
}

interface HistoryEntry {
  id: string;
  videoName: string;
  createdAt: string;
  subtitles: SubtitleEntry[];
}

/* ── Component ── */

export function SubtitlesTool() {
  // Phase
  const [phase, setPhase] = useState<Phase>('select');

  // Select phase
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(null);
  const [lang, setLang] = useState('auto');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Transcribing phase
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState('');

  // Edit phase
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<HistoryEntry | null>(null);

  // Load videos & history from localStorage
  useEffect(() => {
    try {
      const savedVideos = localStorage.getItem('subtitle-videos');
      if (savedVideos) setVideos(JSON.parse(savedVideos));
      const savedHistory = localStorage.getItem('subtitle-history');
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory) as HistoryEntry[];
        setHistory(parsed.map(h => ({ ...h, subtitles: h.subtitles || [] })));
      }
    } catch {}
  }, []);

  const saveVideos = (vids: VideoFile[]) => {
    setVideos(vids);
    try { localStorage.setItem('subtitle-videos', JSON.stringify(vids.slice(0, 20))); } catch {}
  };

  const saveHistory = (entries: HistoryEntry[]) => {
    setHistory(entries);
    try { localStorage.setItem('subtitle-history', JSON.stringify(entries.slice(0, 50))); } catch {}
  };

  /* ── Upload Video ── */
  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('video/')) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/tools/subtitles/upload', { method: 'POST', headers: authHeaders, body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      const vid: VideoFile = {
        id: data.id,
        name: file.name,
        size: file.size,
        url: data.url,
        uploadedAt: new Date().toISOString(),
      };
      const updated = [vid, ...videos];
      saveVideos(updated);
      setSelectedVideo(vid);
    } catch (e) {
      console.error('[Subtitles] Upload error:', e);
    } finally {
      setUploading(false);
    }
  };

  /* ── Transcribe ── */
  const handleTranscribe = async () => {
    if (!selectedVideo) return;
    setPhase('transcribing');
    setTranscribing(true);
    setTranscribeProgress('Uploading to Soniox...');

    try {
      const res = await fetch('/api/tools/subtitles/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          videoId: selectedVideo.id,
          lang: lang === 'auto' ? undefined : lang,
        }),
      });

      if (!res.ok) throw new Error('Transcription failed');
      const data = await res.json();

      // Poll for completion
      const jobId = data.id;
      setTranscribeProgress('Transcribing...');

      const poll = async (): Promise<SubtitleEntry[]> => {
        const statusRes = await fetch(`/api/tools/subtitles/transcribe/${jobId}`, { headers: authHeaders });
        const statusData = await statusRes.json();

        if (statusData.status === 'completed') {
          return statusData.subtitles || [];
        } else if (statusData.status === 'failed') {
          throw new Error('Transcription failed');
        }

        setTranscribeProgress(statusData.status === 'processing' ? 'Processing audio...' : 'In queue...');
        await new Promise(r => setTimeout(r, 3000));
        return poll();
      };

      const subs = await poll();
      setSubtitles(subs);
      setPhase('edit');

      // Save to history
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        videoName: selectedVideo.name,
        createdAt: new Date().toISOString(),
        subtitles: subs,
      };
      saveHistory([entry, ...history]);
      setSelectedHistory(entry);

    } catch (e: any) {
      console.error('[Subtitles] Transcribe error:', e);
      setPhase('select');
    } finally {
      setTranscribing(false);
    }
  };

  /* ── Edit subtitle text ── */
  const updateSubtitle = (id: string, text: string) => {
    setSubtitles(prev => prev.map(s => s.id === id ? { ...s, text } : s));
  };

  const deleteSubtitle = (id: string) => {
    setSubtitles(prev => prev.filter(s => s.id !== id));
  };

  /* ── Format helpers ── */
  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 100);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const exportSrt = () => {
    let srt = '';
    subtitles.forEach((s, i) => {
      const startStr = formatTime(s.start).replace('.', ',') + '0';
      const endStr = formatTime(s.end).replace('.', ',') + '0';
      srt += `${i + 1}\n${startStr} --> ${endStr}\n${s.text}\n\n`;
    });
    const blob = new Blob([srt], { type: 'text/srt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedVideo?.name || 'subtitles'}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isSelectPhase = phase === 'select' || phase === 'transcribing';

  return (
    <div className="flex h-[calc(100vh-180px)] overflow-hidden rounded-xl border border-[var(--border)]">

      {/* ── Left Panel: Controls ── */}
      <div className="w-[380px] shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--surface)]/30">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Mode indicator */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20">
            <span className="text-sm">💬</span>
            <span className="text-xs font-medium text-[var(--accent)]">SUBTITLE</span>
            <code className="text-[10px] text-[var(--text-quaternary)] ml-auto font-mono">$ burn --phase {phase}</code>
          </div>

          {/* Description */}
          <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
            Add subtitles to video — automatic transcription, editing and visual styling.
          </p>

          <hr className="border-[var(--border)]" />

          {isSelectPhase && (
            <>
              {/* Input video */}
              <Section label="Input video">
                {/* Upload zone */}
                <div
                  className="relative"
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
                >
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={uploading || transcribing}
                  />
                  <div className={`h-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${
                    dragOver
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 scale-[1.01]'
                      : uploading
                        ? 'border-[var(--border)] opacity-50'
                        : 'border-[var(--border)] hover:border-[var(--accent)]/30'
                  }`}>
                    {uploading ? (
                      <>
                        <span className="animate-spin w-4 h-4 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full" />
                        <p className="text-xs text-[var(--text-tertiary)]">Uploading...</p>
                      </>
                    ) : (
                      <>
                        <span className="text-lg opacity-40">↑</span>
                        <p className="text-xs text-[var(--text-tertiary)]">Drop video file or click to upload (max 500 MB)</p>
                      </>
                    )}
                  </div>
                </div>
              </Section>

              {/* My videos */}
              <Section label="My videos">
                {videos.length === 0 ? (
                  <p className="text-[11px] text-[var(--text-quaternary)] py-3 text-center">No videos uploaded. Upload one above.</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {videos.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVideo(v)}
                        disabled={transcribing}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                          selectedVideo?.id === v.id
                            ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-transparent'
                        }`}
                      >
                        <p className="truncate font-medium">{v.name}</p>
                        <p className="text-[10px] text-[var(--text-quaternary)] mt-0.5">
                          {(v.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </Section>

              <hr className="border-[var(--border)]" />

              {/* Language */}
              <Section label="Language">
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  disabled={transcribing}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </Section>
            </>
          )}

          {phase === 'edit' && (
            <>
              {/* Video info */}
              <div className="px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                <p className="text-xs font-medium text-[var(--text)] truncate">{selectedVideo?.name}</p>
                <p className="text-[10px] text-[var(--text-quaternary)] mt-0.5">{subtitles.length} subtitle segments</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={exportSrt}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-all"
                >
                  ↓ Export .SRT
                </button>
                <button
                  onClick={() => { setPhase('select'); setSubtitles([]); setSelectedVideo(null); }}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] transition-all"
                >
                  ← Back
                </button>
              </div>
            </>
          )}
        </div>

        {/* Action button */}
        <div className="p-5 pt-3 space-y-3">
          {isSelectPhase && (
            <button
              onClick={handleTranscribe}
              disabled={!selectedVideo || transcribing}
              className={`w-full py-3 rounded-xl font-semibold text-sm tracking-wide transition-all ${
                transcribing
                  ? 'bg-[var(--surface)] text-[var(--text-tertiary)] cursor-wait'
                  : !selectedVideo
                    ? 'bg-[var(--surface)] text-[var(--text-quaternary)] cursor-not-allowed'
                    : 'bg-[var(--accent)] text-white hover:brightness-110 active:scale-[0.98]'
              }`}
            >
              {transcribing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  {transcribeProgress}
                </span>
              ) : (
                'TRANSCRIBE'
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Right Panel: History + Editor ── */}
      <div className="flex-1 min-w-0 flex bg-[var(--background)]">

        {/* History sidebar */}
        <div className="w-48 shrink-0 border-r border-[var(--border)] flex flex-col">
          <div className="px-3 py-3 border-b border-[var(--border)]">
            <span className="text-xs text-[var(--text-tertiary)] font-medium">History</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-[11px] text-[var(--text-quaternary)] text-center py-8 px-3">No subtitles yet</p>
            ) : (
              history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedHistory(item);
                    setSubtitles(item.subtitles || []);
                    setPhase('edit');
                  }}
                  className={`w-full text-left px-3 py-2.5 transition-all hover:bg-[var(--surface-hover)] ${
                    selectedHistory?.id === item.id
                      ? 'bg-[var(--surface-hover)] border-r-2 border-r-[var(--accent)]'
                      : ''
                  }`}
                >
                  <p className="text-xs text-[var(--text)] truncate">{item.videoName}</p>
                  <p className="text-[10px] text-[var(--text-quaternary)] mt-0.5">
                    {new Date(item.createdAt).toLocaleDateString()} · {item.subtitles?.length ?? 0} segs
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {phase === 'edit' && subtitles.length > 0 ? (
            <>
              <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)]">
                <h3 className="text-sm font-semibold text-[var(--text)]">Edit subtitles</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const text = subtitles.map(s => s.text).join('\n');
                      navigator.clipboard.writeText(text);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/8 transition-all bg-[var(--surface)] border border-[var(--border)]"
                  >
                    Copy all
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-2">
                {subtitles.map((sub, i) => (
                  <div
                    key={sub.id}
                    className="group flex gap-3 items-start p-3 rounded-lg border border-[var(--border)] hover:border-[var(--accent)]/30 transition-all bg-[var(--surface)]/30"
                  >
                    <div className="shrink-0 w-12 text-right">
                      <span className="text-[10px] font-mono text-[var(--text-quaternary)]">{i + 1}</span>
                    </div>
                    <div className="shrink-0 space-y-0.5">
                      <p className="text-[10px] font-mono text-[var(--text-quaternary)]">{formatTime(sub.start)}</p>
                      <p className="text-[10px] font-mono text-[var(--text-quaternary)]">{formatTime(sub.end)}</p>
                    </div>
                    <textarea
                      value={sub.text}
                      onChange={(e) => updateSubtitle(sub.id, e.target.value)}
                      rows={2}
                      className="flex-1 bg-transparent text-sm text-[var(--text-secondary)] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent)] rounded px-2 py-1"
                    />
                    <button
                      onClick={() => deleteSubtitle(sub.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-[var(--text-quaternary)] hover:text-red-400 transition-all p-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : phase === 'transcribing' ? (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <span className="animate-spin w-8 h-8 border-3 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full" />
              <p className="text-sm text-[var(--text-tertiary)]">{transcribeProgress}</p>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] flex items-center justify-center">
                <span className="text-2xl opacity-30">💬</span>
              </div>
              <p className="text-sm text-[var(--text-tertiary)]">No active subtitles</p>
              <p className="text-xs text-[var(--text-quaternary)]">Upload a video and click Transcribe</p>
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
