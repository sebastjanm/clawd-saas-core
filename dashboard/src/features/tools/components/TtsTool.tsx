'use client';

import { useState, useEffect, useRef } from 'react';

const MODELS = [
  { id: 'eleven_multilingual_v2', label: 'Multilingual v2', desc: '29 languages' },
  { id: 'eleven_flash_v2_5', label: 'Flash v2.5', desc: 'Fast, 32 langs' },
  { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5', desc: '32 languages' },
  { id: 'eleven_monolingual_v1', label: 'English v1', desc: 'Legacy' },
];

const FORMATS = [
  { id: 'mp3_44100_128', label: 'MP3 HQ', desc: '128kbps' },
  { id: 'mp3_22050_32', label: 'MP3 LQ', desc: '32kbps' },
  { id: 'pcm_24000', label: 'WAV', desc: 'Lossless' },
];

export function TtsTool() {
  const [mode, setMode] = useState('speech');
  const [text, setText] = useState('');
  const [voices, setVoices] = useState<any[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('21m00Tcm4TlvDq8ikWAM');
  const [model, setModel] = useState('eleven_multilingual_v2');
  const [format, setFormat] = useState('mp3_44100_128');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [textFocused, setTextFocused] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/tools/tts').then(res => res.json()).then(data => { if (Array.isArray(data)) setVoices(data); }).catch(console.error);
    fetch('/api/tools/tts/history').then(res => res.json()).then(data => { if (Array.isArray(data)) setHistory(data); }).catch(console.error);
  }, []);

  // Update progress bar
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const update = () => {
      if (progressRef.current && audio.duration) {
        const pct = (audio.currentTime / audio.duration) * 100;
        progressRef.current.style.width = `${pct}%`;
      }
      if (playing) requestAnimationFrame(update);
    };
    if (playing) requestAnimationFrame(update);
  }, [playing]);

  const handleSynthesize = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('text', text); formData.append('voice_id', selectedVoice);
      formData.append('model_id', model); formData.append('type', mode);
      formData.append('output_format', format);
      const res = await fetch('/api/tools/tts', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const newEntry = { id: Date.now().toString(), prompt: text, output_path: data.url, created_at: new Date().toISOString(), settings: JSON.stringify({ voiceId: selectedVoice, modelId: model, format }) };
      setHistory(prev => [newEntry, ...prev]);
      playAudio(data.url, newEntry.id);
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const playAudio = (url: string, id: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = url;
      audioRef.current.play();
      setPlaying(id);
      audioRef.current.onended = () => setPlaying(null);
    }
  };

  const togglePlay = (item: any) => {
    if (playing === item.id) { audioRef.current?.pause(); setPlaying(null); }
    else { playAudio(item.output_path, item.id); }
  };

  const getVoiceLabel = (v: any) => {
    const desc = v.labels?.description || v.labels?.accent || '';
    return desc ? `${v.name} · ${desc}` : v.name;
  };

  return (
    <div className="flex h-[calc(100vh-180px)] overflow-hidden">
      <audio ref={audioRef} className="hidden" />

      {/* Left: Controls */}
      <div className="w-[380px] flex-shrink-0 flex flex-col bg-[var(--surface-alt)]">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">

          {/* Mode */}
          <div className="inline-flex rounded-lg bg-[var(--surface)] p-0.5">
            {[
              { id: 'speech', label: 'Speech', icon: '🗣️' },
              { id: 'sfx', label: 'Sound FX', icon: '🔊' },
            ].map((m) => (
              <button key={m.id} onClick={() => setMode(m.id)}
                className={`px-4 py-2 text-xs rounded-md transition-all duration-200 flex items-center gap-1.5 ${
                  mode === m.id
                    ? 'bg-[var(--accent)] text-white shadow-sm font-medium'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}>
                <span className="text-sm">{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>

          {/* Text input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                {mode === 'speech' ? 'Text' : 'Sound description'}
              </label>
              <span className={`text-[10px] tabular-nums transition-colors ${text.length > 0 ? 'text-[var(--text-tertiary)]' : 'text-transparent'}`}>
                {text.length} / {mode === 'speech' ? '5,000' : '500'}
              </span>
            </div>
            <div className={`rounded-xl transition-all duration-300 ${textFocused ? 'ring-2 ring-[var(--accent)]/25' : ''}`}>
              <textarea value={text} onChange={(e) => setText(e.target.value)}
                onFocus={() => setTextFocused(true)} onBlur={() => setTextFocused(false)}
                placeholder={mode === 'speech' ? "Type or paste text to speak..." : "Describe the sound: a thunderstorm with distant rumbling..."}
                className="w-full h-[120px] bg-[var(--surface)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] resize-none leading-relaxed placeholder:text-[var(--text-quaternary)] transition-colors"
              />
            </div>
          </div>

          {mode === 'speech' && (
            <>
              {/* Voice */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Voice</label>
                <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full bg-[var(--surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-all">
                  {voices.map(v => <option key={v.voice_id} value={v.voice_id}>{getVoiceLabel(v)}</option>)}
                </select>
              </div>

              {/* Model + Format side by side */}
              <div className="flex gap-3">
                <div className="flex-1 space-y-1.5">
                  <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Model</label>
                  <select value={model} onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-[var(--surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-all">
                    {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>
                <div className="w-[100px] space-y-1.5">
                  <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Format</label>
                  <select value={format} onChange={(e) => setFormat(e.target.value)}
                    className="w-full bg-[var(--surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-all">
                    {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Synthesize */}
        <div className="p-5 pt-3">
          <button onClick={handleSynthesize} disabled={loading || !text}
            className={`w-full py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
              loading
                ? 'bg-[var(--surface-strong)] text-[var(--text-tertiary)] cursor-wait'
                : 'bg-[var(--accent)] text-white hover:brightness-110 hover:shadow-lg hover:shadow-[var(--accent)]/20 active:scale-[0.98]'
            }`}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                Synthesizing...
              </span>
            ) : mode === 'speech' ? 'Synthesize' : 'Generate Sound'}
          </button>
        </div>
      </div>

      {/* Right: History */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-[var(--text-tertiary)]">
            {history.length > 0 ? `${history.length} clips` : 'History'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-5">
          {history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] flex items-center justify-center">
                <span className="text-2xl opacity-30">🔊</span>
              </div>
              <div className="text-center">
                <p className="text-sm text-[var(--text-tertiary)]">No audio yet</p>
                <p className="text-xs text-[var(--text-quaternary)] mt-1">Type something and hit Synthesize</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((item) => {
                const isPlaying = playing === item.id;
                let voiceName = '';
                try { const s = JSON.parse(item.settings); voiceName = voices.find(v => v.voice_id === s.voiceId)?.name || ''; } catch {}
                return (
                  <div key={item.id}
                    className={`group rounded-xl px-4 py-3 transition-all duration-200 cursor-pointer ${
                      isPlaying
                        ? 'bg-[var(--accent)]/8 ring-1 ring-[var(--accent)]/20'
                        : 'hover:bg-[var(--surface-hover)]'
                    }`}
                    onClick={() => togglePlay(item)}>
                    <div className="flex items-center gap-3">
                      <button className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 text-xs ${
                        isPlaying
                          ? 'bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/20'
                          : 'bg-[var(--surface)] text-[var(--text-secondary)] group-hover:bg-[var(--accent)] group-hover:text-white group-hover:shadow-md'
                      }`}>
                        {isPlaying ? '⏸' : '▶'}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-[var(--foreground)] line-clamp-1">{item.prompt}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-[var(--text-quaternary)]">{new Date(item.created_at).toLocaleDateString()}</span>
                          {voiceName && <span className="text-[11px] text-[var(--text-quaternary)]">· {voiceName}</span>}
                        </div>
                      </div>
                      <a href={item.output_path} download onClick={(e) => e.stopPropagation()}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-quaternary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 opacity-0 group-hover:opacity-100 transition-all text-xs">
                        ↓
                      </a>
                    </div>
                    {/* Progress bar */}
                    {isPlaying && (
                      <div className="mt-2 h-0.5 bg-[var(--surface-strong)] rounded-full overflow-hidden">
                        <div ref={progressRef} className="h-full bg-[var(--accent)] rounded-full transition-none" style={{ width: '0%' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
