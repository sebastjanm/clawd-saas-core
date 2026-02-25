'use client';

import type { ArticleStatus } from '@/lib/types';

const TOKEN = 'tovarna_dashboard_2026';

export async function updateArticleStatus(
  id: number,
  status: ArticleStatus,
): Promise<void> {
  const res = await fetch(`/api/pipeline/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const body = (await res.json()) as { error: string };
    throw new Error(body.error ?? 'Failed to update');
  }
}
