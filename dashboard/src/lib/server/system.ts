import 'server-only';
import os from 'node:os';
import { execSync } from 'node:child_process';
import type { SystemHealth } from '../types';

export function getSystemHealth(): SystemHealth {
  const cpus = os.cpus();
  const cpuPercent = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle = cpu.times.idle;
    return acc + ((total - idle) / total) * 100;
  }, 0) / cpus.length;

  const memTotal = os.totalmem();
  const memFree = os.freemem();

  let diskUsedGb = 0;
  let diskTotalGb = 0;
  try {
    const df = execSync("df -BG / | tail -1 | awk '{print $2, $3}'", {
      encoding: 'utf-8',
    }).trim();
    const [total, used] = df.split(/\s+/);
    diskTotalGb = parseFloat(total);
    diskUsedGb = parseFloat(used);
  } catch {
    // fallback: leave at 0
  }

  return {
    cpuPercent: Math.round(cpuPercent * 10) / 10,
    memUsedMb: Math.round((memTotal - memFree) / 1024 / 1024),
    memTotalMb: Math.round(memTotal / 1024 / 1024),
    diskUsedGb,
    diskTotalGb,
    uptimeHours: Math.round((os.uptime() / 3600) * 10) / 10,
  };
}
