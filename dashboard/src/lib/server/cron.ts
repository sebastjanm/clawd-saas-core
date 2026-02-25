import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { logger } from '../logger';
import { CronJobSchema } from '../schemas';
import type { CronJob } from '../types';

const CRON_JOBS_PATH = process.env.CRON_JOBS_PATH
  ?? path.resolve('/home/clawdbot/.openclaw/cron/jobs.json');

export function getCronJobs(): CronJob[] {
  try {
    const raw = readFileSync(CRON_JOBS_PATH, 'utf-8');
    const data = JSON.parse(raw) as { version?: number; jobs?: unknown[] };
    const items = data.jobs ?? [];

    if (!Array.isArray(items)) return [];

    return items
      .map((item) => {
        const parsed = CronJobSchema.safeParse(item);
        if (!parsed.success) {
          logger.warn(
            { errors: parsed.error.issues, name: (item as Record<string, unknown>)?.name },
            'Failed to parse cron job',
          );
        }
        return parsed.success ? parsed.data : null;
      })
      .filter((x): x is CronJob => x !== null);
  } catch (err) {
    logger.error({ err }, 'Error reading cron jobs file');
    return [];
  }
}
