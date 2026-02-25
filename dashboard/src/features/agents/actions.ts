'use client';

import { apiPath } from '@/shared/lib/apiPath';

const TOKEN = 'tovarna_dashboard_2026';

export async function triggerAgent(
  agentName: string,
  message?: string,
): Promise<void> {
  const res = await fetch(apiPath('/api/agents/trigger'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ agentName, message }),
  });
  if (!res.ok) {
    const body = (await res.json()) as { error: string };
    throw new Error(body.error ?? 'Failed to trigger agent');
  }
}
