'use client';

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-8 w-8' }[size];
  return (
    <div
      className={`${dims} animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]`}
    />
  );
}
