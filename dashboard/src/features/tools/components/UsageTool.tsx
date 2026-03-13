import { useState, useEffect } from 'react';

// --- Pricing (Estimated) ---
const COSTS: Record<string, number> = {
  'tts': 0.05,
  'stt': 0.02,
  'image': 0.04,
  'video': 0.50,
  'brand': 0.16,
};

export function UsageTool() {
  const [data, setData] = useState<any[]>([]);
  const [provider, setProvider] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    let url = `/api/tools/usage?provider=${provider}`;
    if (fromDate) url += `&from=${fromDate}`;
    if (toDate) url += `&to=${toDate}`;

    fetch(url)
      .then(res => res.json())
      .then(res => { if (res.data) setData(res.data); })
      .catch(console.error);
  }, [provider, fromDate, toDate]);

  // Aggregation
  const totalRuns = data.length;
  const totalCost = data.reduce((sum, item) => sum + (COSTS[item.tool] || 0), 0);
  const byModel = data.reduce((acc, item) => {
    const key = `${item.provider}/${item.model}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="h-[calc(100vh-140px)] bg-[var(--background)] border border-[var(--border)] rounded-sm overflow-hidden flex flex-col font-mono text-xs">
      
      {/* Header */}
      <div className="h-14 border-b border-[var(--border)] bg-[var(--surface-strong)] flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <span className="text-[var(--accent)] font-bold">[USAGE]</span>
          <span className="text-[var(--text-secondary)]">$ stats --costs --usage --all</span>
        </div>
        <div className="flex gap-4 items-center">
           <div className="flex items-center gap-2">
              <label className="text-[var(--text-tertiary)] uppercase font-bold text-[10px]">--FROM</label>
              <input type="date" className="bg-[var(--surface)] border border-[var(--border)] rounded-sm px-2 py-1 text-[var(--text-secondary)]" onChange={e => setFromDate(e.target.value)} />
           </div>
           <div className="flex items-center gap-2">
              <label className="text-[var(--text-tertiary)] uppercase font-bold text-[10px]">--TO</label>
              <input type="date" className="bg-[var(--surface)] border border-[var(--border)] rounded-sm px-2 py-1 text-[var(--text-secondary)]" onChange={e => setToDate(e.target.value)} />
           </div>
           <select 
             className="bg-[var(--surface)] border border-[var(--border)] rounded-sm px-2 py-1 text-[var(--text-secondary)] uppercase font-bold"
             onChange={e => setProvider(e.target.value)}
           >
              <option value="all">PROVIDER: ALL</option>
              <option value="elevenlabs">ElevenLabs</option>
              <option value="fal-flux">Fal Flux</option>
              <option value="fal-luma">Fal Luma</option>
              <option value="soniox">Soniox</option>
           </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-6 p-6 border-b border-[var(--border)] bg-[var(--surface)]">
         
         <div className="p-4 border border-[var(--border)] bg-[var(--background)] rounded-sm flex flex-col gap-1">
            <span className="text-[var(--text-tertiary)] uppercase font-bold text-[10px]">TOTAL RUNS</span>
            <span className="text-2xl font-bold text-[var(--foreground)]">{totalRuns}</span>
         </div>

         <div className="p-4 border border-[var(--border)] bg-[var(--background)] rounded-sm flex flex-col gap-1">
            <span className="text-[var(--text-tertiary)] uppercase font-bold text-[10px]">EST. COST</span>
            <span className="text-2xl font-bold text-[var(--accent)]">${totalCost.toFixed(4)}</span>
         </div>

         <div className="p-4 border border-[var(--border)] bg-[var(--background)] rounded-sm flex flex-col gap-1">
            <span className="text-[var(--text-tertiary)] uppercase font-bold text-[10px]">TOTAL LATENCY</span>
            <span className="text-2xl font-bold text-[var(--text-secondary)]">-- s</span>
         </div>

      </div>

      {/* Content Grid */}
      <div className="flex-1 flex overflow-hidden">
         
         {/* Breakdown Sidebar */}
         <div className="w-[300px] border-r border-[var(--border)] bg-[var(--surface)] p-6 overflow-y-auto custom-scrollbar flex-shrink-0">
            <div className="text-[var(--text-tertiary)] uppercase font-bold text-[10px] mb-4 border-b border-[var(--border)] pb-2">Breakdown by Model</div>
            <div className="space-y-3">
               {Object.entries(byModel).map(([key, count]: [string, any]) => (
                 <div key={key} className="flex flex-col gap-1 pb-2 border-b border-[var(--border)]/50 last:border-0">
                    <span className="text-[var(--text-secondary)] truncate w-full" title={key}>{key}</span>
                    <span className="text-[var(--foreground)] font-bold text-[10px]">{count} runs</span>
                 </div>
               ))}
               {Object.keys(byModel).length === 0 && (
                 <div className="text-[var(--text-tertiary)] text-[10px] italic">No data available</div>
               )}
            </div>
         </div>

         {/* Log Table */}
         <div className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--background)] p-0">
            {data.length > 0 ? (
               <table className="w-full text-left border-collapse">
                  <thead className="bg-[var(--surface-strong)] text-[var(--text-tertiary)] uppercase text-[10px] font-bold tracking-wider sticky top-0 z-10">
                     <tr>
                        <th className="py-3 px-6 border-b border-[var(--border)]">Date</th>
                        <th className="py-3 px-6 border-b border-[var(--border)]">Provider</th>
                        <th className="py-3 px-6 border-b border-[var(--border)]">Model</th>
                        <th className="py-3 px-6 border-b border-[var(--border)]">Cost (Est.)</th>
                        <th className="py-3 px-6 border-b border-[var(--border)]">Latency</th>
                     </tr>
                  </thead>
                  <tbody className="text-[var(--text-secondary)] text-[11px]">
                     {data.map((row) => (
                        <tr key={row.id} className="hover:bg-[var(--surface-hover)] transition-colors border-b border-[var(--border)]/50">
                           <td className="py-3 px-6">{new Date(row.created_at).toLocaleString()}</td>
                           <td className="py-3 px-6 font-bold">{row.provider}</td>
                           <td className="py-3 px-6">{row.model}</td>
                           <td className="py-3 px-6 font-mono text-[var(--accent)]">${(COSTS[row.tool] || 0).toFixed(4)}</td>
                           <td className="py-3 px-6 font-mono text-[var(--text-tertiary)]">--</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-[var(--text-quaternary)]">
                  <div className="text-4xl mb-4 opacity-20">📊</div>
                  <div className="text-xs font-mono uppercase tracking-widest opacity-50">No Usage Data</div>
               </div>
            )}
         </div>

      </div>

    </div>
  );
}
