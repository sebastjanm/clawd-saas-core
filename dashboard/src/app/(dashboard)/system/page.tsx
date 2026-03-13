import { getSystemHealth } from '@/lib/server/system';

export const dynamic = 'force-dynamic';

function Gauge({ label, percent, detail }: { label: string; percent: number; detail?: string }) {
  const color =
    percent > 90 ? 'var(--error)' : percent > 70 ? 'var(--warning)' : 'var(--success)';
  const status = percent > 90 ? 'Critical' : percent > 70 ? 'Warning' : 'Normal';

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[var(--text)]">{label}</span>
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{
            color,
            backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
          }}
        >
          {status}
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-[var(--surface)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-2xl font-bold tabular-nums text-[var(--text)]">{Math.round(percent)}%</span>
        {detail && <span className="text-xs text-[var(--text-tertiary)]">{detail}</span>}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
      <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{label}</span>
      <div className="mt-2 text-2xl font-bold tabular-nums text-[var(--text)]">{value}</div>
      {sub && <span className="text-xs text-[var(--text-tertiary)] mt-1 block">{sub}</span>}
    </div>
  );
}

export default async function SystemPage() {
  const health = await getSystemHealth();
  const memPercent = Math.round((health.memUsedMb / health.memTotalMb) * 100);
  const diskPercent = health.diskTotalGb
    ? Math.round((health.diskUsedGb / health.diskTotalGb) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🖥️</span>
        <div>
          <h2 className="text-[var(--hig-title2)] font-semibold text-[var(--text-primary)]">System</h2>
          <p className="text-xs text-[var(--text-tertiary)]">Infrastructure health and resources</p>
        </div>
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Gauge
          label="CPU"
          percent={health.cpuPercent}
        />
        <Gauge
          label="Memory"
          percent={memPercent}
          detail={`${Math.round(health.memUsedMb / 1024 * 10) / 10} / ${Math.round(health.memTotalMb / 1024 * 10) / 10} GB`}
        />
        <Gauge
          label="Disk"
          percent={diskPercent}
          detail={`${health.diskUsedGb} / ${health.diskTotalGb} GB`}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Uptime"
          value={`${health.uptimeHours}h`}
          sub={`${Math.round(health.uptimeHours / 24)} days`}
        />
        <StatCard
          label="Brain"
          value={health.gatewayUptimeHours !== undefined ? `${health.gatewayUptimeHours}h` : '—'}
          sub="AI Gateway"
        />
      </div>
    </div>
  );
}
