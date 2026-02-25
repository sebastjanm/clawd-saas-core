'use client';

import { useCallback } from 'react';
import { usePolling } from '@/shared/hooks/usePolling';
import { apiPath } from '@/shared/lib/apiPath';

const TOKEN = typeof window !== 'undefined' ? 'tovarna_dashboard_2026' : '';

export interface StrategyDecision {
  id: number;
  project: string;
  decision_type: string;
  target: string;
  reason: string;
  data_source: string | null;
  status: string;
  created_by: string;
  approved_at: string | null;
  applied_at: string | null;
  created_at: string;
}

interface StrategyData {
  decisions: StrategyDecision[];
  stats: Array<{ status: string; count: number }>;
}

async function fetchStrategy(status?: string, project?: string): Promise<StrategyData> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (project) params.set('project', project);
  const qs = params.toString();
  const res = await fetch(apiPath(`/api/strategy${qs ? `?${qs}` : ''}`), {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error('Failed to fetch strategy');
  return res.json();
}

export async function actOnDecision(id: number, action: 'approve' | 'reject') {
  const res = await fetch(apiPath(`/api/strategy/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error('Failed to update decision');
  return res.json();
}

export function useStrategy(status?: string, project?: string) {
  const fetcher = useCallback(() => fetchStrategy(status, project), [status, project]);
  return usePolling(fetcher, 30000);
}
