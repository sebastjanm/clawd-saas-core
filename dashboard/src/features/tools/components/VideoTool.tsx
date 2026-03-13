'use client';

import { useState, useEffect } from 'react';

const MODES = [
  { id: 'text_to_video', label: 'TEXT → VIDEO', icon: '📝' },
  { id: 'image_to_video', label: 'IMAGE → VIDEO', icon: '🖼️' },
  // { id: 'video_to_video', label: 'VIDEO → VIDEO', icon: '🎬' },
];

const RATIOS = [
  { id: '16:9', label: '16:9' },
  { id: '4:3', label: '4:3' },
  { id: '1:1', label: '1:1' },
  { id: '9:16', label: '9:16' },
];

const RESOLUTIONS = [
  { id: '480p', label: '480p' },
  { id: '720p', label: '720p' },
  // { id: '1080p', label: '1080p' },
];

export function VideoTool() {
  const [mode, setMode] = useState('text_to_video');
  const [prompt, setPrompt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState('720p');
  const [duration, setDuration] = useState('5s');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tools/video/history')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setHistory(data); })
      .catch(console.error);
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('mode', mode);
      formData.append('aspect_ratio', aspectRatio);
      formData.append('resolution', resolution);
      formData.append('duration', duration);
      
      if (mode === 'image_to_video' && imageFile) {
        formData.append('image', imageFile); 
      }

      const res = await fetch('/api/tools/video', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const newEntry = {
        id: data.id || Date.now().toString(),
        prompt: prompt,
        output_path: data.url,
        created_at: new Date().toISOString(),
        settings: JSON.stringify({ mode, aspectRatio, resolution })
      };
      
      setHistory(prev => [newEntry, ...prev]);
      setActiveVideo(data.url);

    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] bg-[var(--background)] border border-[var(--border)] rounded-sm overflow-hidden shadow-sm font-sans text-sm">
      
      {/* --- LEFT PANEL: CONTROLS (500px) --- */}
      <div className="w-[500px] flex-shrink-0 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col z-10">
        
        {/* Header */}
        <div className="h-14 border-b border-[var(--border)] flex items-center px-4 bg-[var(--surface-strong)] font-mono text-xs overflow-hidden">
          <span className="text-[var(--accent)] font-bold mr-2">[VIDEO]</span>
          <span className="text-[var(--text-secondary)]">$ video --{mode} --{resolution}</span>
        </div>

        {/* Inputs */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-[var(--surface)]">
          
          {/* Mode Switch */}
          <div className="flex flex-wrap gap-1 border border-[var(--border)] rounded-sm p-1 bg-[var(--surface-strong)] w-fit">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${
                  mode === m.id
                    ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <span>{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>

          {/* Prompt Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider font-mono">--PROMPT</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the video scene, motion, and style..."
              className="w-full h-32 bg-[var(--surface-strong)] border border-[var(--border)] rounded-sm px-3 py-3 text-sm focus:outline-none focus:border-[var(--accent)] transition-all resize-none font-serif leading-relaxed placeholder:text-[var(--text-quaternary)]"
            />
            <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] font-mono">
              <span>CHARS: {prompt.length} / 4,096</span>
            </div>
          </div>

          {/* Image Upload (I2V) */}
          {mode === 'image_to_video' && (
            <div className="space-y-2">
               <label className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider font-mono">--INPUT IMAGE</label>
               <input 
                 type="file" 
                 accept="image/*"
                 onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                 className="block w-full text-xs text-[var(--text-secondary)] file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-xs file:font-semibold file:bg-[var(--surface-strong)] file:text-[var(--accent)] hover:file:bg-[var(--surface-hover)]"
               />
            </div>
          )}

          {/* Settings Grid */}
          <div className="grid grid-cols-2 gap-4 pt-2">
             
             {/* Aspect Ratio */}
             <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider font-mono">--ASPECT-RATIO</label>
                <div className="grid grid-cols-2 gap-1">
                  {RATIOS.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setAspectRatio(r.id)}
                      className={`px-2 py-1.5 rounded-sm text-[10px] font-bold border ${
                        aspectRatio === r.id 
                          ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10' 
                          : 'border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--text-secondary)]'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
             </div>

             {/* Resolution */}
             <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider font-mono">--RESOLUTION</label>
                <div className="flex gap-1">
                   {RESOLUTIONS.map(r => (
                     <button
                       key={r.id}
                       onClick={() => setResolution(r.id)}
                       className={`px-3 py-1.5 rounded-sm text-[10px] font-bold border ${
                         resolution === r.id 
                           ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10' 
                           : 'border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--text-secondary)]'
                       }`}
                     >
                       {r.label}
                     </button>
                   ))}
                </div>
             </div>

          </div>

          {/* Duration */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider font-mono">--DURATION</label>
            <div className="flex gap-2 text-[10px] font-mono text-[var(--text-tertiary)]">
               <span className={duration === '3s' ? 'text-[var(--accent)] font-bold' : ''}>3s</span>
               <span className={duration === '5s' ? 'text-[var(--accent)] font-bold' : ''}>5s (Default)</span>
            </div>
            <input 
              type="range" 
              min="3" max="5" step="2"
              value={parseInt(duration)} 
              onChange={(e) => setDuration(e.target.value + 's')}
              className="w-full accent-[var(--accent)]"
            />
          </div>

        </div>

        {/* Action Button */}
        <div className="p-6 border-t border-[var(--border)] bg-[var(--surface)]">
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt}
            className={`w-full py-4 border border-[var(--accent)] rounded-sm font-bold text-sm uppercase tracking-widest transition-all shadow-sm active:scale-[0.99] flex items-center justify-center gap-2 ${
              loading 
                ? 'bg-[var(--surface-strong)] text-[var(--text-tertiary)] border-[var(--border)] cursor-wait' 
                : 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90'
            }`}
          >
             {loading ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"/> : <span>[ GENERATE VIDEO ]</span>}
          </button>
        </div>
      </div>

      {/* --- RIGHT PANEL: PREVIEW & HISTORY --- */}
      <div className="flex-1 bg-[var(--background)] relative min-w-0 border-l border-[var(--border)] flex flex-col">
        
        {/* Main Preview */}
        <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden group">
           {activeVideo ? (
             <video 
               src={activeVideo} 
               controls 
               autoPlay 
               loop 
               className="max-h-full max-w-full object-contain"
             />
           ) : (
             <div className="text-[var(--text-quaternary)] flex flex-col items-center gap-2">
               <span className="text-4xl opacity-20">🎬</span>
               <span className="text-xs font-mono uppercase tracking-widest opacity-50">Preview Area</span>
             </div>
           )}
        </div>

        {/* Filmstrip (History) */}
        <div className="h-32 bg-[var(--surface)] border-t border-[var(--border)] flex items-center gap-2 overflow-x-auto custom-scrollbar p-2">
           {history.map((item) => (
             <div 
               key={item.id} 
               onClick={() => setActiveVideo(item.output_path)}
               className={`h-full aspect-video flex-shrink-0 relative group cursor-pointer border-2 transition-all overflow-hidden rounded-sm ${
                 activeVideo === item.output_path ? 'border-[var(--accent)]' : 'border-transparent hover:border-[var(--text-tertiary)]'
               }`}
             >
                <video src={item.output_path} className="w-full h-full object-cover pointer-events-none" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <span className="text-white text-2xl">▶</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white p-1 truncate font-mono">
                  {item.prompt}
                </div>
             </div>
           ))}
        </div>

      </div>
    </div>
  );
}
