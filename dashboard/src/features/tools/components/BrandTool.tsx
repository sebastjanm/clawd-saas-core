'use client';

import { useState, useEffect } from 'react';

const STYLES = [
  { id: 'lifestyle', label: 'Lifestyle', desc: 'Real-world context' },
  { id: 'studio', label: 'Studio', desc: 'Clean background' },
  { id: 'editorial', label: 'Editorial', desc: 'Fashion magazine' },
  { id: 'cinematic', label: 'Cinematic', desc: 'Moody lighting' },
];

export function BrandTool() {
  const [productFile, setProductFile] = useState<File | null>(null);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [style, setStyle] = useState('lifestyle');
  const [prompt, setPrompt] = useState('');
  const [batchSize, setBatchSize] = useState(4);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [activeBatch, setActiveBatch] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/tools/brand/history')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setHistory(data); })
      .catch(console.error);
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      if (productFile) formData.append('product_url', productFile); 
      if (modelFile) formData.append('model_url', modelFile);
      formData.append('brand_style', prompt);
      formData.append('batch_size', batchSize.toString());

      const res = await fetch('/api/tools/brand', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const newEntry = {
        id: data.batchId,
        prompt: prompt,
        output_path: JSON.stringify(data.images),
        created_at: new Date().toISOString(),
        settings: JSON.stringify({ style, batchSize })
      };
      
      setHistory(prev => [newEntry, ...prev]);
      setActiveBatch(data.images);

    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] bg-[var(--background)] border border-[var(--border)] rounded-sm overflow-hidden shadow-sm font-sans text-sm">
      
      {/* --- LEFT PANEL: ASSETS (350px) --- */}
      <div className="w-[350px] flex-shrink-0 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col z-10">
        
        <div className="h-14 border-b border-[var(--border)] flex items-center px-4 bg-[var(--surface-strong)] font-mono text-xs">
          <span className="text-[var(--accent)] font-bold mr-2">[BRAND]</span>
          <span className="text-[var(--text-secondary)]">$ batch --size {batchSize}</span>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-[var(--surface)]">
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider font-mono">--PRODUCT (SUBJECT)</label>
            <div className="relative group h-32 border-2 border-dashed border-[var(--border)] rounded-sm bg-[var(--surface-strong)] flex flex-col items-center justify-center text-[var(--text-tertiary)] hover:border-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-all cursor-pointer">
               <input type="file" accept="image/*" onChange={(e) => setProductFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
               <span className="text-2xl mb-1">{productFile ? '✅' : '📦'}</span>
               <span className="text-[10px] font-mono uppercase">{productFile ? productFile.name : 'Drop Product Image'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider font-mono">--MODEL (IDENTITY)</label>
            <div className="relative group h-32 border-2 border-dashed border-[var(--border)] rounded-sm bg-[var(--surface-strong)] flex flex-col items-center justify-center text-[var(--text-tertiary)] hover:border-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-all cursor-pointer">
               <input type="file" accept="image/*" onChange={(e) => setModelFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
               <span className="text-2xl mb-1">{modelFile ? '✅' : '👤'}</span>
               <span className="text-[10px] font-mono uppercase">{modelFile ? modelFile.name : 'Drop Model/Ref Image'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider font-mono">--STYLE PRESET</label>
            <div className="grid grid-cols-2 gap-2">
               {STYLES.map(s => (
                 <button
                   key={s.id}
                   onClick={() => { setStyle(s.id); setPrompt(prev => prev + (prev ? ' ' : '') + s.desc); }}
                   className={`p-2 rounded-sm text-[10px] font-bold border transition-all ${
                     style === s.id 
                       ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]' 
                       : 'border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text-tertiary)] hover:border-[var(--text-secondary)]'
                   }`}
                 >
                   {s.label}
                 </button>
               ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider font-mono">--CONTEXT PROMPT</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the scene, lighting, and mood..."
              className="w-full h-24 bg-[var(--surface-strong)] border border-[var(--border)] rounded-sm px-3 py-3 text-sm focus:outline-none focus:border-[var(--accent)] resize-none font-serif placeholder:text-[var(--text-quaternary)]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider font-mono">--BATCH SIZE</label>
            <input 
              type="range" min="1" max="8" step="1"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
            <div className="flex justify-between text-[10px] font-mono text-[var(--text-tertiary)]">
               <span>1</span>
               <span className="text-[var(--foreground)] font-bold">{batchSize} Images</span>
               <span>8</span>
            </div>
          </div>

        </div>

        <div className="p-6 border-t border-[var(--border)] bg-[var(--surface)]">
          <button
            onClick={handleGenerate}
            disabled={loading || !productFile}
            className={`w-full py-4 border border-[var(--accent)] rounded-sm font-bold text-sm uppercase tracking-widest transition-all shadow-sm active:scale-[0.99] flex items-center justify-center gap-2 ${
              loading 
                ? 'bg-[var(--surface-strong)] text-[var(--text-tertiary)] border-[var(--border)] cursor-wait' 
                : 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90'
            }`}
          >
             {loading ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"/> : <span>[ GENERATE BATCH ]</span>}
          </button>
        </div>

      </div>

      {/* --- RIGHT PANEL: GALLERY --- */}
      <div className="flex-1 bg-[var(--background)] relative min-w-0 border-l border-[var(--border)] flex flex-col p-8 overflow-y-auto custom-scrollbar">
        
        {activeBatch.length > 0 ? (
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {activeBatch.map((url, i) => (
                <div key={i} className="aspect-[4/5] bg-[var(--surface-strong)] rounded-sm overflow-hidden border border-[var(--border)] group relative hover:border-[var(--accent)] transition-all">
                   <img src={url} alt={`Batch ${i}`} className="w-full h-full object-cover" />
                   <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a href={url} download className="p-2 bg-white/20 rounded-full hover:bg-white/40 text-white transition-colors">⬇️</a>
                   </div>
                </div>
              ))}
           </div>
        ) : (
           <div className="h-full flex flex-col items-center justify-center text-[var(--text-quaternary)] select-none">
              <div className="text-4xl mb-4 opacity-20">🏭</div>
              <div className="text-xs font-mono uppercase tracking-widest opacity-50">Brand Factory Empty</div>
           </div>
        )}

      </div>

    </div>
  );
}
