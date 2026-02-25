'use client';

import { useCallback } from 'react';
import { usePolling } from '@/shared/hooks/usePolling';
import { apiPath } from '@/shared/lib/apiPath';
import type { AgentStatus } from '@/lib/types';

const TOKEN = typeof window !== 'undefined' ? 'tovarna_dashboard_2026' : '';

async function fetchAgents(): Promise<AgentStatus[]> {
  const res = await fetch(apiPath('/api/agents'), {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error('Failed to fetch agents');
  const json = (await res.json()) as { agents: AgentStatus[] };
  return json.agents;
}

export function useAgents() {
  const fetcher = useCallback(() => fetchAgents(), []);
  return usePolling(fetcher, 15000);
}
