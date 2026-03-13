'use client';

import { useState, useEffect } from 'react';

const PROVIDERS = [
  { id: 'fal', label: 'fal.ai (Flux)', disabled: false },
  { id: 'gemini', label: 'Gemini', disabled: false },
  { id: 'recraft', label: 'Recraft', disabled: true },
];

// ── Fal config ──
const FAL_ACTIONS = [
  { id: 'generate', label: 'Generiraj' },
  { id: 'img2img', label: 'Slika→Slika' },
  { id: 'face-swap', label: 'Zamenjava obraza' },
  { id: 'multi-edit', label: 'Več-urejanje' },
];

const FAL_MODELS = [
  { id: 'flux-dev', label: 'Flux Dev (quality)' },
  { id: 'flux-schnell', label: 'Flux Schnell (fast)' },
  { id: 'flux-pro', label: 'Flux Pro 1.1' },
];

const FAL_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'];

// ── Gemini config ──
const GEMINI_TIERS = [
  { id: 'basic', label: 'BASIC' },
  { id: 'pro', label: 'PRO ★' },
];

const GEMINI_MODELS: Record<string, string> = {
  basic: 'imagen-4.0-generate-001',
  pro: 'imagen-4.0-ultra-generate-001',
};

const GEMINI_RESOLUTIONS = ['1K', '2K', '4K'];
const GEMINI_RATIOS = ['1:1', '4:5', '9:16', '16:9', '3:2'];

const GEMINI_STYLES = [
  '', 'Filmsko', 'Fotografsko', 'Ilustracija', 'Akvarel', 'Anime', '3D render', 'Pixel art',
];

const GEMINI_LIGHTS = [
  '', 'Naravna', 'Studijska', 'Dramatična', 'Neonska', 'Zlata ura', 'Modra ura',
];

const GEMINI_LENSES = [
  '', '35mm', '50mm', '85mm', '24mm', '135mm', 'Makro', 'Fisheye',
];

export function ImageTool() {
  const [provider, setProvider] = useState('fal');

  // Fal state
  const [falAction, setFalAction] = useState('generate');
  const [falModel, setFalModel] = useState(FAL_MODELS[0].id);
  const [falRatio, setFalRatio] = useState('1:1');
  const [falCount, setFalCount] = useState(1);
  const [falFormat, setFalFormat] = useState('jpeg');

  // Gemini state
  const [gemTier, setGemTier] = useState('basic');
  const [gemResolution, setGemResolution] = useState('1K');
  const [gemRatio, setGemRatio] = useState('1:1');
  const [gemStyle, setGemStyle] = useState('');
  const [gemLight, setGemLight] = useState('');
  const [gemLens, setGemLens] = useState('');
  const [gemImage, setGemImage] = useState<File | null>(null);

  // Shared state
  const [prompt, setPrompt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [lastRun, setLastRun] = useState<{ id?: string; latency?: string; model?: string; seed?: string } | null>(null);

  useEffect(() => {
    fetch('/api/tools/image/history').then(res => res.json()).then(data => { if (Array.isArray(data)) setResults(data); }).catch(console.error);
  }, []);

  const handleSubmit = async () => {
    setLoading(true); setError(null); setLastRun(null);
    const startTime = Date.now();
    try {
      const formData = new FormData();
      formData.append('provider', provider);
      formData.append('prompt', buildPrompt());

      if (provider === 'fal') {
        formData.append('action', falAction);
        formData.append('model', falModel);
        formData.append('aspect_ratio', falRatio);
        formData.append('count', String(falCount));
        formData.append('format', falFormat);
        if (imageFile) formData.append('image', imageFile);
      } else if (provider === 'gemini') {
        formData.append('action', 'generate');
        formData.append('model', GEMINI_MODELS[gemTier]);
        formData.append('aspect_ratio', gemRatio);
        formData.append('count', '1');
        formData.append('format', 'png');
        formData.append('resolution', gemResolution);
        if (gemImage) formData.append('image', gemImage);
      }

      const res = await fetch('/api/tools/image', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      const latency = ((Date.now() - startTime) / 1000).toFixed(1);
      setLastRun({
        id: data.requestId || data.run_id || undefined,
        latency: `${latency}s`,
        model: data.model || (provider === 'gemini' ? GEMINI_MODELS[gemTier] : falModel),
        seed: data.seed || undefined,
      });
      if (data.images?.length) setResults(prev => [...data.images, ...prev]);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  // Build enhanced prompt with Gemini style modifiers
  function buildPrompt(): string {
    if (provider !== 'gemini') return prompt;
    const parts = [prompt];
    if (gemStyle) parts.push(`slog: ${gemStyle}`);
    if (gemLight) parts.push(`osvetlitev: ${gemLight}`);
    if (gemLens) parts.push(`objektiv: ${gemLens}`);
    return parts.join(', ');
  }

  const needsFalImage = provider === 'fal' && ['img2img', 'face-swap', 'multi-edit'].includes(falAction);

  return (
    <div className="flex h-[calc(100vh-180px)] overflow-hidden rounded-xl border border-[var(--border)]">

      {/* ── Left Panel ── */}
      <div className="w-[380px] shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--surface)]/30">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Provider tabs */}
          <div className="flex gap-2 flex-wrap">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => !p.disabled && setProvider(p.id)}
                disabled={p.disabled}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  provider === p.id
                    ? 'bg-[var(--accent)] text-white'
                    : p.disabled
                      ? 'text-[var(--text-quaternary)] cursor-not-allowed line-through'
                      : 'text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* ── FAL CONTROLS ── */}
          {provider === 'fal' && (
            <>
              {/* Actions */}
              <div className="flex gap-1.5 flex-wrap">
                {FAL_ACTIONS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setFalAction(a.id)}
                    className={`px-2.5 py-1 text-[11px] rounded-md font-medium transition-all ${
                      falAction === a.id
                        ? 'text-[var(--accent)] bg-[var(--accent)]/10'
                        : 'text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              <hr className="border-[var(--border)]" />

              {/* Model */}
              <Section label="Model">
                <select
                  value={falModel}
                  onChange={(e) => setFalModel(e.target.value)}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                >
                  {FAL_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </Section>

              {/* Prompt */}
              <Section label="Opis" suffix={`${prompt.length} / 10,000`}>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Opiši sliko, ki jo želiš ustvariti..."
                  maxLength={10000}
                  className="w-full h-20 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none leading-relaxed"
                />
              </Section>

              {/* Ratio */}
              {falAction === 'generate' && (
                <Section label="Razmerje">
                  <PillGroup options={FAL_RATIOS} value={falRatio} onChange={setFalRatio} />
                </Section>
              )}

              {/* Count + Format row */}
              <div className="flex gap-4">
                <Section label="Število">
                  <PillGroup options={['1', '2', '3', '4']} value={String(falCount)} onChange={(v) => setFalCount(Number(v))} />
                </Section>
                <Section label="Format">
                  <PillGroup options={['jpeg', 'png']} value={falFormat} onChange={setFalFormat} />
                </Section>
              </div>

              {/* Image upload for img2img etc */}
              {needsFalImage && (
                <FileUpload file={imageFile} onFile={setImageFile} />
              )}

              {/* Advanced */}
              <AdvancedToggle open={advancedOpen} onToggle={() => setAdvancedOpen(!advancedOpen)} />
            </>
          )}

          {/* ── GEMINI CONTROLS ── */}
          {provider === 'gemini' && (
            <>
              <hr className="border-[var(--border)]" />

              {/* Prompt */}
              <Section label="Opis" suffix={`${prompt.length} / 10,000`}>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Opiši sliko, ki jo želiš ustvariti..."
                  maxLength={10000}
                  className="w-full h-20 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none leading-relaxed"
                />
              </Section>

              {/* Tier */}
              <PillGroup options={GEMINI_TIERS.map(t => t.label)} value={GEMINI_TIERS.find(t => t.id === gemTier)?.label || ''} onChange={(v) => {
                const tier = GEMINI_TIERS.find(t => t.label === v);
                if (tier) setGemTier(tier.id);
              }} />

              {/* Resolution */}
              <Section label="Resolucija">
                <PillGroup options={GEMINI_RESOLUTIONS} value={gemResolution} onChange={setGemResolution} />
              </Section>

              {/* Ratio */}
              <Section label="Razmerje">
                <PillGroup options={GEMINI_RATIOS} value={gemRatio} onChange={setGemRatio} />
              </Section>

              {/* Style */}
              <Section label="Slog">
                <SelectInput options={GEMINI_STYLES} value={gemStyle} onChange={setGemStyle} placeholder="Brez" />
              </Section>

              {/* Lighting */}
              <Section label="Osvetlitev">
                <SelectInput options={GEMINI_LIGHTS} value={gemLight} onChange={setGemLight} placeholder="Brez" />
              </Section>

              {/* Lens */}
              <Section label="Kamera/Objektiv">
                <SelectInput options={GEMINI_LENSES} value={gemLens} onChange={setGemLens} placeholder="Brez" />
              </Section>

              {/* Advanced */}
              <AdvancedToggle open={advancedOpen} onToggle={() => setAdvancedOpen(!advancedOpen)} />

              {/* Optional image input */}
              <Section label="Vhodna slika (neobvezno, za urejanje)">
                <FileUpload file={gemImage} onFile={setGemImage} />
              </Section>
            </>
          )}
        </div>

        {/* Generate button */}
        <div className="p-5 pt-3 space-y-3">
          <button
            onClick={handleSubmit}
            disabled={loading || (needsFalImage && !imageFile)}
            className={`w-full py-3 rounded-xl font-semibold text-sm tracking-wide transition-all ${
              loading
                ? 'bg-[var(--surface)] text-[var(--text-tertiary)] cursor-wait'
                : 'bg-[var(--accent)] text-white hover:brightness-110 active:scale-[0.98]'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                Generiranje...
              </span>
            ) : (
              'GENERIRAJ'
            )}
          </button>

          {lastRun && (
            <div className="text-[10px] text-[var(--text-quaternary)] space-y-0.5 font-mono bg-[var(--surface)] rounded-lg p-2.5">
              {lastRun.id && <p>RUN: {lastRun.id}</p>}
              {lastRun.latency && <p>LATENCY: {lastRun.latency}</p>}
              {lastRun.model && <p>MODEL: {lastRun.model}</p>}
              {lastRun.seed && <p>SEED: {lastRun.seed}</p>}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 text-center bg-red-400/10 rounded-lg py-2 px-3">{error}</p>
          )}
        </div>
      </div>

      {/* ── Right Panel: Gallery ── */}
      <div className="flex-1 min-w-0 flex flex-col bg-[var(--background)]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
          <span className="text-xs text-[var(--text-tertiary)] font-medium">
            {results.length > 0 ? `${results.length} slik` : 'Galerija'}
          </span>
          <div className="flex gap-3">
            <button onClick={() => fetch('/api/tools/image/history').then(res => res.json()).then(setResults)}
              className="text-[11px] text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] transition-colors">Osveži</button>
            {results.length > 0 && (
              <button onClick={() => { if (confirm('Počisti galerijo?')) setResults([]); }}
                className="text-[11px] text-[var(--text-quaternary)] hover:text-red-400 transition-colors">Počisti</button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {results.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] flex items-center justify-center">
                <span className="text-2xl opacity-30">🎨</span>
              </div>
              <p className="text-sm text-[var(--text-tertiary)]">Še ni slik</p>
              <p className="text-xs text-[var(--text-quaternary)]">Napiši opis in pritisni Generiraj</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {results.map((src, i) => (
                <div key={i} className="group relative aspect-square rounded-xl overflow-hidden bg-[var(--surface)] cursor-pointer"
                  onClick={() => setLightboxImage(src)}>
                  <img src={src} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="absolute bottom-2.5 left-3 right-3 flex justify-between items-end">
                      <span className="text-white/70 text-[10px] font-mono">#{results.length - i}</span>
                      <a href={src} download={`gen-${i}.png`} onClick={(e) => e.stopPropagation()}
                        className="w-7 h-7 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-colors text-xs">↓</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-8" onClick={() => setLightboxImage(null)}>
          <button className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all">✕</button>
          <img src={lightboxImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <a href={lightboxImage} download="generated.png"
            className="absolute bottom-6 px-5 py-2.5 bg-white text-black text-xs font-medium rounded-full hover:scale-105 transition-transform shadow-xl">Prenesi</a>
        </div>
      )}
    </div>
  );
}

/* ── Reusable components ── */

function Section({ label, suffix, children }: { label: string; suffix?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">{label}</label>
        {suffix && <span className="text-[10px] text-[var(--text-quaternary)] font-mono">{suffix}</span>}
      </div>
      {children}
    </div>
  );
}

function PillGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-2.5 py-1.5 text-xs rounded-md font-medium transition-all ${
            value === opt
              ? 'bg-[var(--accent)]/10 text-[var(--accent)] ring-1 ring-[var(--accent)]/20'
              : 'text-[var(--text-tertiary)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function SelectInput({ options, value, onChange, placeholder }: { options: string[]; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
    >
      <option value="">{placeholder}</option>
      {options.filter(Boolean).map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

function FileUpload({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  return (
    <div className="relative">
      <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] || null)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
      <div className={`h-16 border-2 border-dashed rounded-lg flex items-center justify-center gap-2 transition-all ${
        file ? 'border-green-500/40 bg-green-500/5' : 'border-[var(--border)] hover:border-[var(--accent)]/30'
      }`}>
        <span className="text-lg">{file ? '✓' : '↑'}</span>
        <div>
          <p className="text-xs font-medium text-[var(--text)]">{file ? file.name : 'Naloži sliko'}</p>
          <p className="text-[10px] text-[var(--text-quaternary)]">
            {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'PNG, JPEG, WebP, GIF (maks 20MB)'}
          </p>
        </div>
      </div>
    </div>
  );
}

function AdvancedToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <>
      <button onClick={onToggle}
        className="text-[11px] text-[var(--text-quaternary)] hover:text-[var(--text-tertiary)] transition-colors flex items-center gap-1">
        <span className="transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
        Napredne nastavitve
      </button>
      {open && (
        <div className="text-[11px] text-[var(--text-quaternary)] pl-4 py-2 border-l-2 border-[var(--border)]">
          Seed, guidance scale, steps: kmalu.
        </div>
      )}
    </>
  );
}
