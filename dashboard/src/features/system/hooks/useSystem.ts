'use client';

import { useCallback } from 'react';
import { usePolling } from '@/shared/hooks/usePolling';
import { apiPath } from '@/shared/lib/apiPath';
import type { SystemHealth } from '@/lib/types';

const TOKEN = typeof window !== 'undefined' ? 'tovarna_dashboard_2026' : '';

async function fetchSystem(): Promise<SystemHealth> {
  const res = await fetch(apiPath('/api/system'), {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error('Failed to fetch system health');
  return (await res.json()) as SystemHealth;
}

export function useSystem() {
  const fetcher = useCallback(() => fetchSystem(), []);
  return usePolling(fetcher, 30000);
}
