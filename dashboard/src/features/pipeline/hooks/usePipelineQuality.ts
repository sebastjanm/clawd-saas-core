'use client';

import { useCallback } from 'react';
import { usePolling } from '@/shared/hooks/usePolling';
import { apiPath } from '@/shared/lib/apiPath';

const TOKEN = typeof window !== 'undefined' ? 'tovarna_dashboard_2026' : '';

export interface PipelineQuality {
  status: 'ok' | 'degraded';
  checkedAt: string;
  issues: string[];
  checks: {
    staleDaily: Array<{ id: string; name: string }>;
    errorJobs: Array<{ id: string; name: string; consecutiveErrors: number }>;
    usageIntegrity: {
      totalRows: number;
      missingTokens: number;
      missingProject: number;
      invalidDuration: number;
    };
    articleFlow: {
      review: number;
      readyForDesign: number;
      ready: number;
      awaitingApproval: number;
    };
  };
}

async function fetchQuality(): Promise<PipelineQuality> {
  const res = await fetch(apiPath('/api/pipeline/quality'), {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error('Failed to fetch pipeline quality');
  return (await res.json()) as PipelineQuality;
}

export function usePipelineQuality() {
  const fetcher = useCallback(() => fetchQuality(), []);
  return usePolling(fetcher, 30000);
}
