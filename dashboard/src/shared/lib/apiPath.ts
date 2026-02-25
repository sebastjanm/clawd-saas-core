'use client';

export function apiPath(path: string): string {
  if (typeof window === 'undefined') return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized.startsWith('/factory/')) return normalized;
  return window.location.pathname.startsWith('/factory')
    ? `/factory${normalized}`
    : normalized;
}
