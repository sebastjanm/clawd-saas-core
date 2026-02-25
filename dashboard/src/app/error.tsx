'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <div className="text-center">
        <p className="text-4xl mb-4">⚠️</p>
        <h2 className="text-xl font-semibold text-[var(--foreground)]/80 mb-3">Something went wrong</h2>
        <p className="text-sm text-[var(--muted)] mb-6 max-w-sm">{error.message}</p>
        <button
          onClick={reset}
          className="rounded-lg bg-[var(--surface)] border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)]/70 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-all"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
