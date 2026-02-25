'use client';

import { useCallback } from 'react';
import { usePolling } from '@/shared/hooks/usePolling';
import { apiPath } from '@/shared/lib/apiPath';

const TOKEN = typeof window !== 'undefined' ? 'tovarna_dashboard_2026' : '';

export interface OverviewData {
  statusCounts: Array<{ status: string; count: number }>;
  publishedThisWeek: number;
  byProject: Array<{ project: string; count: number }>;
  byProjectWeek: Array<{ project: string; count: number }>;
  avgPipelineTime: Array<{ project: string; avg_days: number }>;
  failureRate: number;
  socialStats: Array<{ status: string; count: number }>;
  strategyStats: Array<{ status: string; count: number }>;
  agentRunsWeek: Array<{ agent_name: string; runs: number; ok: number; failed: number }>;
  tokenUsage: { total_tokens: number; total_cost: number };
  recentPublishes: Array<{ id: number; project: string; title: string; published_at: string; published_url: string }>;
  inFlight: Array<{ status: string; project: string; count: number }>;
  dailyTrend: Array<{ day: string; count: number }>;
}

async function fetchOverview(): Promise<OverviewData> {
  const res = await fetch(apiPath('/api/overview'), {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error('Failed to fetch overview');
  return res.json();
}

export function useOverview() {
  const fetcher = useCallback(() => fetchOverview(), []);
  return usePolling(fetcher, 60000);
}
