'use server';

import { revalidatePath } from 'next/cache';

const ROUTER_URL = 'http://127.0.0.1:3401';

type PauseResult = { ok: boolean; error?: string };

export async function toggleProjectPause(
  project: string,
  type: 'generating' | 'publishing',
  paused: boolean,
): Promise<PauseResult> {
  try {
    const res = await fetch(`${ROUTER_URL}/pipeline/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, type, paused, by: 'dashboard' }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? 'Failed' };
    revalidatePath('/pipeline');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export interface ProjectPauseState {
  generating: boolean;
  generating_by: string | null;
  generating_at: string | null;
  publishing: boolean;
  publishing_by: string | null;
  publishing_at: string | null;
}

export async function getProjectPauseStates(): Promise<Record<string, ProjectPauseState>> {
  try {
    const res = await fetch(`${ROUTER_URL}/pipeline/health`, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 0 },
    });
    if (!res.ok) return {};
    const health = await res.json();
    return health.paused ?? {};
  } catch {
    return {};
  }
}
