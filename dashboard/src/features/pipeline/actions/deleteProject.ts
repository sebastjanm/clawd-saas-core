'use server';

import { revalidatePath } from 'next/cache';

const ROUTER_URL = process.env.PIPELINE_ROUTER_URL || 'http://127.0.0.1:4001';

export async function deleteProject(projectId: string) {
  try {
    const res = await fetch(`${ROUTER_URL}/pipeline/projects/${projectId}`, {
      method: 'DELETE',
    });
    
    if (!res.ok) {
      const json = await res.json();
      return { ok: false, error: json.error || 'Failed to delete' };
    }

    revalidatePath('/projects');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}
