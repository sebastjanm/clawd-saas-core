import { Navigation } from '@/shared/components/client/Navigation';
import { ThemeToggle } from '@/shared/components/client/ThemeToggle';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] md:flex">
      <Navigation />

      <div className="flex-1 min-w-0">
        {/* Sticky Health Bar */}
        <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-2xl">
          <div className="mx-auto flex h-12 max-w-[1400px] items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3 md:hidden">
              <span className="text-lg">🏭</span>
              <span
                className="text-xs font-bold tracking-[0.15em] text-[var(--foreground)]/70"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                OLY CONTROL
              </span>
            </div>
            <div className="hidden md:block" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="mx-auto max-w-[1400px] px-4 py-6 pb-24 sm:px-6 sm:py-8 md:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
