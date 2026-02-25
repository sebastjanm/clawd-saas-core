import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <div className="text-center">
        <p className="text-5xl font-bold tabular-nums text-[var(--foreground)]/10 mb-2" style={{ fontFamily: 'var(--font-mono)' }}>404</p>
        <p className="text-sm text-[var(--muted)] mb-6">Page not found</p>
        <Link
          href="/"
          className="rounded-lg bg-[var(--surface)] border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]/80 transition-all"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
