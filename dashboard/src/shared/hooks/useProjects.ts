'use client';

import { usePolling } from './usePolling';
import { apiPath } from '../lib/apiPath';

export interface ProjectOption {
  id: string;
  label: string;
}

// Fetch from Next.js API proxy which calls Router
async function fetchProjects(): Promise<ProjectOption[]> {
  try {
    const res = await fetch('/api/pipeline/settings', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    // Data is array of project_settings rows: { project: 'slug', ... }
    return Array.isArray(data) 
      ? data.map((p: any) => ({ id: p.project, label: p.project }))
      : [];
  } catch (err) {
    console.error('Failed to fetch projects', err);
    return [];
  }
}

export function useProjects() {
  const { data, loading } = usePolling(fetchProjects, 10000); // Poll every 10s
  
  const projects = [
    { id: '', label: 'All projects' },
    ...(data || [])
  ];

  return { projects, loading };
}
