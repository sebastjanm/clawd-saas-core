import { useState, useEffect } from 'react';

const TYPES = [
  { id: 'all', label: 'ALL' },
  { id: 'tts', label: 'TTS' },
  { id: 'stt', label: 'STT' },
  { id: 'image', label: 'IMAGE' },
];

export function HistoryTool() {
  const [activeType, setActiveType] = useState('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetch(`/api/tools/history?type=${activeType}`)
      .then(res => res.json())
      .then(res => {
        setData(res.data);
        setTotal(res.total);
      })
      .catch(console.error);
  }, [activeType]);

  const toggleExpand = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const getStatusColor = (status: string) => {
    if (status === 'completed' || status === 'done') return 'text-[var(--success)]';
    if (status === 'failed' || status === 'error') return 'text-[var(--error)]';
    return 'text-[var(--warning)]';
  };

  const getTypeIcon = (tool: string) => {
    switch (tool) {
      case 'tts': return '🔊';
      case 'stt': return '🗣️';
      case 'image': return '🎨';
      default: return '❓';
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] bg-[var(--background)] border border-[var(--border)] rounded-sm overflow-hidden flex flex-col font-mono text-xs">
      
      {/* Header */}
      <div className="h-12 border-b border-[var(--border)] bg-[var(--surface-strong)] flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <span className="text-[var(--accent)] font-bold">[HISTORY]</span>
          <span className="text-[var(--text-secondary)]">$ query runs --page 1 --type {activeType}</span>
        </div>
        <div className="flex gap-1">
          {TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveType(t.id)}
              className={`px-3 py-1 rounded-sm text-[10px] uppercase font-bold transition-all ${
                activeType === t.id 
                  ? 'bg-[var(--accent)] text-white' 
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[40px_80px_100px_120px_1fr_150px] border-b border-[var(--border)] bg-[var(--surface)] text-[var(--text-tertiary)] font-bold uppercase tracking-wider py-2 px-4 select-none">
        <div></div>
        <div>Type</div>
        <div>Status</div>
        <div>Provider</div>
        <div>Preview / Prompt</div>
        <div className="text-right">Created</div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--background)]">
        {data.length === 0 && (
           <div className="p-8 text-center text-[var(--text-quaternary)]">No history found.</div>
        )}
        
        {data.map((row) => (
          <div key={row.id} className="border-b border-[var(--border)] group">
            
            {/* Row Summary */}
            <div 
              onClick={() => toggleExpand(row.id)}
              className={`grid grid-cols-[40px_80px_100px_120px_1fr_150px] py-3 px-4 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors items-center ${
                expandedRow === row.id ? 'bg-[var(--surface-strong)]' : ''
              }`}
            >
              <div className="text-[var(--text-tertiary)] text-[10px]">{expandedRow === row.id ? '▼' : '▶'}</div>
              <div className="flex items-center gap-2 font-bold text-[var(--foreground)]">
                <span>{getTypeIcon(row.tool)}</span>
                <span>{row.tool}</span>
              </div>
              <div className={`font-bold ${getStatusColor('completed')}`}>[DONE]</div>
              <div className="text-[var(--text-secondary)] truncate">{row.provider}</div>
              <div className="text-[var(--text-secondary)] truncate pr-4 opacity-80 font-serif italic">
                {row.prompt}
              </div>
              <div className="text-right text-[var(--text-tertiary)] text-[10px]">
                {new Date(row.created_at).toLocaleString()}
              </div>
            </div>

            {/* Expanded Details */}
            {expandedRow === row.id && (
              <div className="bg-[var(--surface)] border-t border-[var(--border)] p-6 space-y-4 animate-fade-in">
                
                {/* Input Section */}
                <div>
                   <div className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider mb-2">Input: --Prompt</div>
                   <div className="p-3 bg-[var(--surface-strong)] border border-[var(--border)] rounded-sm text-[var(--text-secondary)] font-serif whitespace-pre-wrap leading-relaxed">
                     {row.prompt}
                   </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-4">
                   
                   {/* Settings */}
                   <div>
                      <div className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider mb-2">--Settings</div>
                      <div className="p-3 bg-[var(--surface-strong)] border border-[var(--border)] rounded-sm font-mono text-[10px] text-[var(--text-secondary)] overflow-x-auto">
                        <pre>{JSON.stringify(JSON.parse(row.settings || '{}'), null, 2)}</pre>
                      </div>
                   </div>

                   {/* Output / Preview */}
                   <div>
                      <div className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider mb-2">--Output</div>
                      <div className="p-3 bg-[var(--surface-strong)] border border-[var(--border)] rounded-sm flex flex-col gap-3">
                         
                         {/* TTS Player */}
                         {row.tool === 'tts' && (
                           <audio controls src={row.output_path} className="w-full h-8" />
                         )}

                         {/* Image Preview */}
                         {row.tool === 'image' && (
                           <img src={row.output_path} alt="Generated" className="max-h-40 object-contain rounded-sm border border-[var(--border)] bg-[var(--background)]" />
                         )}

                         {/* STT Link */}
                         {row.tool === 'stt' && (
                            <a href={row.output_path} target="_blank" className="text-[var(--accent)] hover:underline flex items-center gap-2">
                              📄 View Transcript
                            </a>
                         )}

                         <div className="flex justify-between items-center pt-2 border-t border-[var(--border)] mt-1">
                            <span className="text-[var(--text-tertiary)] text-[10px]">PATH: {row.output_path}</span>
                            <a 
                              href={row.output_path} 
                              download 
                              className="px-3 py-1 bg-[var(--accent)] text-white rounded-sm text-[10px] font-bold uppercase hover:opacity-90 transition-opacity"
                            >
                              Download
                            </a>
                         </div>
                      </div>
                   </div>
                </div>

              </div>
            )}

          </div>
        ))}
      </div>
      
      {/* Footer */}
      <div className="h-8 border-t border-[var(--border)] bg-[var(--surface-strong)] flex items-center justify-between px-4 text-[10px] text-[var(--text-tertiary)]">
         <span>TOTAL RUNS: {total}</span>
         <span>PAGE 1 OF {Math.ceil(total / 50)}</span>
      </div>

    </div>
  );
}
