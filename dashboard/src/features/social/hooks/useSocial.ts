'use client';

import { useCallback } from 'react';
import { usePolling } from '@/shared/hooks/usePolling';
import { apiPath } from '@/shared/lib/apiPath';

const TOKEN = typeof window !== 'undefined' ? 'tovarna_dashboard_2026' : '';

export interface SocialPost {
  id: number;
  article_id: number;
  platform: string;
  content: string;
  media_brief: string | null;
  media_url: string | null;
  post_url: string | null;
  status: string;
  created_at: string;
  article_title?: string;
  article_project?: string;
}

export interface SocialGroup {
  article_id: number;
  article_title: string;
  article_project: string;
  published_url: string | null;
  posts: SocialPost[];
}

export interface SocialStats {
  status: string;
  count: number;
}

interface SocialData {
  groups: SocialGroup[];
  stats: SocialStats[];
}

async function fetchSocial(
  status?: string,
  project?: string,
): Promise<SocialData> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (project) params.set('project', project);
  const qs = params.toString();
  const url = apiPath(`/api/social${qs ? `?${qs}` : ''}`);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error('Failed to fetch social posts');
  return res.json();
}

export async function updateSocialPost(
  id: number,
  data: { status?: string; content?: string },
) {
  const res = await fetch(apiPath(`/api/social/${id}`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update social post');
  return res.json();
}

export async function batchAction(
  articleId: number,
  action: 'approve' | 'reject',
) {
  const res = await fetch(apiPath('/api/social/batch'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ article_id: articleId, action }),
  });
  if (!res.ok) throw new Error('Failed to batch update');
  return res.json();
}

export function useSocial(status?: string, project?: string) {
  const fetcher = useCallback(
    () => fetchSocial(status, project),
    [status, project],
  );
  return usePolling(fetcher, 20000);
}
