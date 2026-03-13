'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type HealthData = {
  cpuPercent: number;
  memPercent: number;
  diskPercent: number;
  uptimeHours: number;
  gatewayUptimeHours?: number;
};

function getOverallStatus(h: HealthData): 'ok' | 'warning' | 'error' {
  if (h.cpuPercent > 90 || h.memPercent > 90 || h.diskPercent > 90) return 'error';
  if (h.cpuPercent > 70 || h.memPercent > 70 || h.diskPercent > 80) return 'warning';
  return 'ok';
}

const STATUS_COLORS = {
  ok: 'var(--success)',
  warning: 'var(--warning)',
  error: 'var(--error)',
};

export function HealthDot() {
  const [health, setHealth] = useState<HealthData | null>(null);


  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/system', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setHealth({
          cpuPercent: data.cpuPercent ?? 0,
          memPercent: data.memTotalMb ? Math.round((data.memUsedMb / data.memTotalMb) * 100) : 0,
          diskPercent: data.diskTotalGb ? Math.round((data.diskUsedGb / data.diskTotalGb) * 100) : 0,
          uptimeHours: data.uptimeHours ?? 0,
          gatewayUptimeHours: data.gatewayUptimeHours,
        });
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (!health) return null;

  const status = getOverallStatus(health);
  const color = STATUS_COLORS[status];

  return (
    <Link
      href="/system"
      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[var(--muted)] hover:bg-[var(--surface)] transition-all duration-200 min-h-[44px] w-full"
      title="System Health"
    >
      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
        {status !== 'ok' && (
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-40 animate-ping"
            style={{ backgroundColor: color }}
          />
        )}
        <span
          className="relative inline-flex h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      </span>
      <span className="text-[var(--hig-callout)] font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100 whitespace-nowrap">
        {status === 'ok' ? 'Healthy' : status === 'warning' ? 'Warning' : 'Alert'}
      </span>
    </Link>
  );
}

function MiniGauge({ label, percent }: { label: string; percent: number }) {
  const color =
    percent > 90 ? 'var(--error)' : percent > 70 ? 'var(--warning)' : 'var(--success)';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[var(--text-tertiary)] w-8">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] text-[var(--text-secondary)] tabular-nums w-7 text-right">{percent}%</span>
    </div>
  );
}
