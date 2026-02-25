import type { CronJob } from './types';

const AGENT_ALIASES: Record<string, string[]> = {
  oti: ['oti'],
  liso: ['liso'],
  pino: ['pino'],
  rada: ['rada'],
  zala: ['zala'],
  lana: ['lana'],
  bea: ['bea'],
  maci: ['maci', 'mači'],
  medo: ['medo'],
  kroki: ['kroki'],
  vuk: ['vuk'],
};

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tokenize(input: string): string[] {
  return normalize(input)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function findCronJobsForAgent(name: string, cronJobs: CronJob[]): CronJob[] {
  const aliases = (AGENT_ALIASES[name] ?? [name]).map(normalize);

  return cronJobs.filter((job) => {
    const label = job.name ?? job.label ?? '';
    const tokens = tokenize(label);
    return aliases.some((alias) => tokens.includes(alias));
  });
}

export function getMostRecentCronRun(jobs: CronJob[]): CronJob | null {
  if (jobs.length === 0) return null;

  return jobs.reduce((latest, job) => {
    const latestMs = latest.state?.lastRunAtMs ?? 0;
    const jobMs = job.state?.lastRunAtMs ?? 0;
    return jobMs > latestMs ? job : latest;
  });
}
