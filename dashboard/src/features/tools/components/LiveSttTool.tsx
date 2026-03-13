'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SonioxClient } from '@soniox/client';

/* ── Constants ── */

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
  { id: '', label: 'None' },
  { id: 'en', label: '🇬🇧 English' },
  { id: 'sl', label: '🇸🇮 Slovenščina' },
  { id: 'de', label: '🇩🇪 Deutsch' },
];

type RecordingState = 'idle' | 'starting' | 'recording' | 'paused' | 'stopping' | 'stopped' | 'error';

interface HistoryEntry {
  id: string;
  startedAt: string;
  duration: number;
  transcript: string;
}

/* ── Component ── */

export function LiveSttTool() {
  // Settings
  const [lang, setLang] = useState('auto');
  const [diarize, setDiarize] = useState(true);
  const [numSpeakers, setNumSpeakers] = useState('auto');
  const [translateTo, setTranslateTo] = useState('');
  const [contextTerms, setContextTerms] = useState('');
  const [recordingContext, setRecordingContext] = useState('');

  // State
  const [state, setState] = useState<RecordingState>('idle');
  const [finalText, setFinalText] = useState('');
  const [nonFinalText, setNonFinalText] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const clientRef = useRef<SonioxClient | null>(null);
  const recordingRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('live-stt-history');
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);

  // Save history to localStorage
  const saveHistory = useCallback((entries: HistoryEntry[]) => {
    setHistory(entries);
    try {
      localStorage.setItem('live-stt-history', JSON.stringify(entries.slice(0, 50)));
    } catch {}
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current && state === 'recording') {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [finalText, nonFinalText, state]);

  // Timer
  useEffect(() => {
    if (state === 'recording') {
      startTimeRef.current = Date.now() - elapsed * 1000;
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else if (state === 'paused') {
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const formatCost = (s: number) => {
    const minutes = s / 60;
    return `$${(minutes * 0.0017).toFixed(4)}`;
  };

  /* ── Start Recording ── */
  const startRecording = useCallback(async () => {
    setError(null);
    setState('starting');
    setFinalText('');
    setNonFinalText('');
    setElapsed(0);

    try {
      // Get temporary API key from our server
      const keyRes = await fetch('/api/tools/stt/temp-key');
      if (!keyRes.ok) throw new Error('Failed to get API key');
      const { api_key } = await keyRes.json();

      // Create Soniox client
      const client = new SonioxClient({ api_key });
      clientRef.current = client;

      // Build recording config
      const config: any = {
        model: 'stt-rt-v4',
        enable_endpoint_detection: true,
      };

      // Language
      if (lang !== 'auto') {
        config.language_hints = [lang];
      }

      // Diarization
      if (diarize) {
        config.enable_speaker_diarization = true;
        if (numSpeakers !== 'auto') {
          config.min_num_speakers = parseInt(numSpeakers);
          config.max_num_speakers = parseInt(numSpeakers);
        }
      }

      // Translation
      if (translateTo) {
        config.enable_translation = true;
        config.translation_target_languages = [translateTo];
      }

      // Context
      const terms = contextTerms.split(',').map(t => t.trim()).filter(Boolean);
      if (terms.length > 0 || recordingContext) {
        config.context = {};
        if (terms.length > 0) config.context.terms = terms;
        if (recordingContext) {
          config.context.general = [{ key: 'topic', value: recordingContext }];
        }
      }

      // Start recording
      const recording = client.realtime.record(config);
      recordingRef.current = recording;

      let accFinal = '';

      recording.on('result', (result: any) => {
        let finalPart = '';
        let nonFinalPart = '';

        for (const token of result.tokens) {
          if (token.is_final) {
            finalPart += token.text;
          } else {
            nonFinalPart += token.text;
          }
        }

        if (finalPart) {
          accFinal += finalPart;
          setFinalText(accFinal);
        }
        setNonFinalText(nonFinalPart);
      });

      recording.on('error', (err: any) => {
        console.error('[LiveSTT] Error:', err);
        setError(err.message || 'Recording error');
        setState('error');
      });

      recording.on('state_change', ({ new_state }: any) => {
        if (new_state === 'recording') setState('recording');
        else if (new_state === 'stopped') setState('stopped');
        else if (new_state === 'error') setState('error');
      });

    } catch (err: any) {
      console.error('[LiveSTT] Start error:', err);
      setError(err.message || 'Failed to start recording');
      setState('error');
    }
  }, [lang, diarize, numSpeakers, translateTo, contextTerms, recordingContext]);

  /* ── Stop Recording ── */
  const stopRecording = useCallback(async () => {
    setState('stopping');
    try {
      if (recordingRef.current) {
        await recordingRef.current.stop();
      }
    } catch (err) {
      console.error('[LiveSTT] Stop error:', err);
    }

    // Save to history
    const transcript = finalText + nonFinalText;
    if (transcript.trim()) {
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        startedAt: new Date().toISOString(),
        duration: elapsed,
        transcript,
      };
      const updated = [entry, ...history];
      saveHistory(updated);
      setSelectedEntry(entry);
    }

    setState('stopped');
    recordingRef.current = null;
    clientRef.current = null;
  }, [finalText, nonFinalText, elapsed, history, saveHistory]);

  /* ── Pause / Resume ── */
  const togglePause = useCallback(() => {
    if (!recordingRef.current) return;
    if (state === 'recording') {
      recordingRef.current.pause();
      setState('paused');
    } else if (state === 'paused') {
      recordingRef.current.resume();
      setState('recording');
    }
  }, [state]);

  const isRecording = state === 'recording' || state === 'paused' || state === 'starting' || state === 'stopping';
  const canStart = state === 'idle' || state === 'stopped' || state === 'error';

  return (
    <div className="flex h-[calc(100vh-180px)] overflow-hidden rounded-xl border border-[var(--border)]">

      {/* ── Left Panel: Controls ── */}
      <div className="w-[380px] shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--surface)]/30">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Mode indicator */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20">
            <span className="text-sm">🎙️</span>
            <span className="text-xs font-medium text-[var(--accent)]">LIVE TRANSCRIPTION</span>
            <code className="text-[10px] text-[var(--text-quaternary)] ml-auto font-mono">$ stt --mode live --lang {lang}</code>
          </div>

          <hr className="border-[var(--border)]" />

          {/* Language */}
          <Section label="Language">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              disabled={isRecording}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </Section>

          {/* Diarization toggle */}
          <label className="flex items-center gap-3 cursor-pointer group py-1">
            <div
              className={`relative w-9 h-5 rounded-full transition-colors ${diarize ? 'bg-[var(--accent)]' : 'bg-[var(--surface)]'} border border-[var(--border)] ${isRecording ? 'opacity-50 pointer-events-none' : ''}`}
              onClick={() => !isRecording && setDiarize(!diarize)}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${diarize ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-xs text-[var(--text-secondary)]">Speaker diarization</span>
          </label>

          {/* Number of speakers */}
          {diarize && (
            <Section label="No. of speakers">
              <select
                value={numSpeakers}
                onChange={(e) => setNumSpeakers(e.target.value)}
                disabled={isRecording}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
              >
                <option value="auto">auto</option>
                {[2, 3, 4, 5, 6, 7, 8].map(n => (
                  <option key={n} value={String(n)}>{n}</option>
                ))}
              </select>
            </Section>
          )}

          {/* Translation */}
          <Section label="Translation">
            <select
              value={translateTo}
              onChange={(e) => setTranslateTo(e.target.value)}
              disabled={isRecording}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
            >
              {TRANSLATE_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </Section>

          {/* Context terms */}
          <Section label="Context terms">
            <input
              type="text"
              value={contextTerms}
              onChange={(e) => setContextTerms(e.target.value)}
              disabled={isRecording}
              placeholder="Domain terms, comma-separated (e.g. proper nouns, acronyms, jargon)"
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
            />
          </Section>

          {/* Recording context */}
          <Section label="Recording context">
            <input
              type="text"
              value={recordingContext}
              onChange={(e) => setRecordingContext(e.target.value)}
              disabled={isRecording}
              placeholder="e.g. Weekly team meeting, Client interview, AI lecture..."
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
            />
          </Section>

          {/* Price info */}
          <div className="text-[10px] text-[var(--text-quaternary)] px-1">
            Cost: $0.0017/min (same as file transcription). Billed by actual recording length.
          </div>
        </div>

        {/* Action buttons */}
        <div className="p-5 pt-3 space-y-3">
          {/* Timer + cost display */}
          {isRecording && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${state === 'paused' ? 'bg-yellow-400' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-sm font-mono font-semibold text-[var(--text)]">{formatTime(elapsed)}</span>
              </div>
              <span className="text-xs text-[var(--text-tertiary)] font-mono">{formatCost(elapsed)}</span>
            </div>
          )}

          {canStart ? (
            <button
              onClick={startRecording}
              className="w-full py-3 rounded-xl font-semibold text-sm tracking-wide transition-all bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]"
            >
              START RECORDING
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={togglePause}
                disabled={state === 'starting' || state === 'stopping'}
                className="flex-1 py-3 rounded-xl font-semibold text-sm tracking-wide transition-all bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--surface-hover)] active:scale-[0.98] disabled:opacity-50"
              >
                {state === 'paused' ? 'RESUME' : 'PAUSE'}
              </button>
              <button
                onClick={stopRecording}
                disabled={state === 'stopping'}
                className="flex-1 py-3 rounded-xl font-semibold text-sm tracking-wide transition-all bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 active:scale-[0.98] disabled:opacity-50"
              >
                {state === 'stopping' ? 'STOPPING...' : 'STOP'}
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 text-center bg-red-400/10 rounded-lg py-2 px-3">{error}</p>
          )}
        </div>
      </div>

      {/* ── Right Panel: History + Transcript ── */}
      <div className="flex-1 min-w-0 flex bg-[var(--background)]">

        {/* History sidebar */}
        <div className="w-48 shrink-0 border-r border-[var(--border)] flex flex-col">
          <div className="px-3 py-3 border-b border-[var(--border)]">
            <span className="text-xs text-[var(--text-tertiary)] font-medium">STT History</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-[11px] text-[var(--text-quaternary)] text-center py-8 px-3">No STT recordings yet</p>
            ) : (
              history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedEntry(item)}
                  className={`w-full text-left px-3 py-2.5 transition-all hover:bg-[var(--surface-hover)] group ${
                    selectedEntry?.id === item.id
                      ? 'bg-[var(--surface-hover)] border-r-2 border-r-[var(--accent)]'
                      : ''
                  }`}
                >
                  <p className="text-xs text-[var(--text)] truncate">
                    {item.transcript.slice(0, 40) || 'Empty transcript'}
                  </p>
                  <p className="text-[10px] text-[var(--text-quaternary)] mt-0.5">
                    {new Date(item.startedAt).toLocaleDateString()} · {formatTime(item.duration)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Transcript viewer */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {(isRecording || finalText || selectedEntry) ? (
            <>
              <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  {isRecording && (
                    <span className={`w-2 h-2 rounded-full ${state === 'paused' ? 'bg-yellow-400' : 'bg-red-500 animate-pulse'}`} />
                  )}
                  <h3 className="text-sm font-semibold text-[var(--text)]">
                    {isRecording ? 'Live transcript' : selectedEntry ? 'Transcript' : 'Completed transcript'}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    const text = selectedEntry?.transcript || (finalText + nonFinalText);
                    navigator.clipboard.writeText(text);
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/8 transition-all bg-[var(--surface)] border border-[var(--border)]"
                >
                  Copy
                </button>
              </div>
              <div
                ref={transcriptRef}
                className="flex-1 overflow-y-auto p-6 max-w-3xl"
              >
                <div className="text-sm leading-7 text-[var(--text-secondary)] whitespace-pre-wrap selection:bg-[var(--accent)]/20">
                  {selectedEntry && !isRecording ? (
                    selectedEntry.transcript
                  ) : (
                    <>
                      {finalText}
                      {nonFinalText && (
                        <span className="text-[var(--text-quaternary)] italic">{nonFinalText}</span>
                      )}
                      {isRecording && !finalText && !nonFinalText && (
                        <span className="text-[var(--text-quaternary)] italic animate-pulse">Waiting for speech...</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] flex items-center justify-center">
                <span className="text-2xl opacity-30">🎙️</span>
              </div>
              <p className="text-sm text-[var(--text-tertiary)]">No active transcription</p>
              <p className="text-xs text-[var(--text-quaternary)]">Click Start Recording for live transcription</p>
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
