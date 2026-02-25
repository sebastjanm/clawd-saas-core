'use server';

import { revalidatePath } from 'next/cache';

const ROUTER_URL = 'http://127.0.0.1:3401';

export type ProjectSettings = {
  project: string;
  daily_limit: number;
  vacation_limit: number;
  vacation_mode: number;
  auto_approve: number;
  paused: number;
  done_for_today: number;
  done_at: string | null;
  updated_at: string;
};

export async function getProjectSettings(): Promise<ProjectSettings[]> {
  try {
    const res = await fetch(`${ROUTER_URL}/pipeline/settings`, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function updateProjectSettings(
  project: string,
  updates: Partial<Pick<ProjectSettings, 'daily_limit' | 'vacation_limit' | 'vacation_mode' | 'auto_approve' | 'paused' | 'done_for_today'>>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${ROUTER_URL}/pipeline/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, ...updates }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    revalidatePath('/pipeline');
    revalidatePath('/projects');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}
