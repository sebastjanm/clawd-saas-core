import { getSystemHealth } from '@/lib/server/system';

export function HealthBar() {
  const health = getSystemHealth();
  const memPercent = Math.round(
    (health.memUsedMb / health.memTotalMb) * 100,
  );
  const diskPercent = health.diskTotalGb
    ? Math.round((health.diskUsedGb / health.diskTotalGb) * 100)
    : 0;

  return (
    <div className="flex items-center gap-5 text-[var(--hig-subhead)] tabular-nums">
      <Gauge label="CPU" percent={health.cpuPercent} />
      <Gauge label="RAM" percent={memPercent} />
      <Gauge label="DISK" percent={diskPercent} />
      <span className="text-[var(--text-quaternary)]">
        Up {health.uptimeHours}h
      </span>
    </div>
  );
}

function Gauge({ label, percent }: { label: string; percent: number }) {
  const color =
    percent > 90
      ? 'bg-[var(--error)]'
      : percent > 70
        ? 'bg-[var(--warning)]'
        : 'bg-[var(--success)]';

  return (
    <div className="flex items-center gap-2">
      <span className="text-[var(--text-quaternary)] font-medium">{label}</span>
      <div className="relative h-1 w-14 overflow-hidden rounded-full bg-[var(--surface)]">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${color} transition-all duration-700`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className="w-8 text-right text-[var(--text-tertiary)]">{Math.round(percent)}%</span>
    </div>
  );
}
