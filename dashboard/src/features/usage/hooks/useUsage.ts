'use client';

import { useCallback, useState } from 'react';
import { usePolling } from '@/shared/hooks/usePolling';
import type { AgentRun } from '@/lib/types';

const TOKEN = typeof window !== 'undefined' ? 'tovarna_dashboard_2026' : '';

export interface UsageSummary {
  totalRuns: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalDurationMs: number;
  estimatedCost: number;
}

export interface ModelCost {
  model: string;
  runs: number;
  tokens_in: number;
  tokens_out: number;
  duration_ms: number;
  estimatedCost: number;
}

export interface AgentCost {
  agent: string;
  runs: number;
  tokens_in: number;
  tokens_out: number;
  duration_ms: number;
  estimatedCost: number;
}

export interface ProjectCost {
  project: string;
  runs: number;
  tokens_in: number;
  tokens_out: number;
  duration_ms: number;
  estimatedCost: number;
}

export interface DailyTrend {
  day: string;
  runs: number;
  cost: number;
  tokens: number;
}

export interface UsageData {
  runs: AgentRun[];
  summary: UsageSummary;
  modelCosts?: ModelCost[];
  agentCosts?: AgentCost[];
  projectCosts?: ProjectCost[];
  trend?: DailyTrend[];
  periods?: {
    today: { cost: number; runs: number };
    week: { cost: number; runs: number };
    month: { cost: number; runs: number };
  };
  projects?: string[];
  coverage?: {
    firstRunAt: string | null;
    lastRunAt: string | null;
    totalRows: number;
  };
}

export interface UsageFilters {
  agent: string;
  project: string;
  days: number;
}

async function fetchUsage(filters: UsageFilters): Promise<UsageData> {
  const params = new URLSearchParams();
  if (filters.agent) params.set('agent', filters.agent);
  if (filters.project) params.set('project', filters.project);
  params.set('days', filters.days.toString());

  const res = await fetch(`/api/usage?${params.toString()}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error('Failed to fetch usage');
  return (await res.json()) as UsageData;
}

export function useUsage(filters: UsageFilters) {
  const fetcher = useCallback(() => fetchUsage(filters), [filters.agent, filters.project, filters.days]);
  return usePolling(fetcher, 60000);
}
