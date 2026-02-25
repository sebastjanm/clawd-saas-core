'use client';

import { useCallback } from 'react';
import { usePolling } from '@/shared/hooks/usePolling';
import { apiPath } from '@/shared/lib/apiPath';
import type { PipelineColumn } from '@/lib/types';

const TOKEN = typeof window !== 'undefined' ? 'tovarna_dashboard_2026' : '';

async function fetchPipeline(project?: string): Promise<PipelineColumn[]> {
  const url = project
    ? apiPath(`/api/pipeline?project=${encodeURIComponent(project)}`)
    : apiPath('/api/pipeline');
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error('Failed to fetch pipeline');
  const json = (await res.json()) as { columns: PipelineColumn[] };
  return json.columns;
}

export function usePipeline(project?: string) {
  const fetcher = useCallback(() => fetchPipeline(project), [project]);
  return usePolling(fetcher, 20000);
}
