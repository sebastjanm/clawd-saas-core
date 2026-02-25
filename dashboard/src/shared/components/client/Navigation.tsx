'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', icon: '🏠', label: 'Dashboard' },
  { href: '/agents', icon: '🤖', label: 'Agents' },
  { href: '/process', icon: '⚙️', label: 'Process' },
  { href: '/pipeline', icon: '📋', label: 'Pipeline' },
  { href: '/overview', icon: '🏭', label: 'Overview' },
  { href: '/social', icon: '🐝', label: 'Social' },
  { href: '/strategy', icon: '🐺', label: 'Strategy' },
  { href: '/library', icon: '📚', label: 'Library' },
  { href: '/projects', icon: '📁', label: 'Projects' },
  { href: '/usage', icon: '💰', label: 'Usage' },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/' || pathname === '';
  return pathname.startsWith(href);
}

export function Navigation() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: slim left sidebar — expands on hover */}
      <nav className="sticky top-0 z-50 hidden h-screen w-16 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--nav-bg)] backdrop-blur-2xl transition-all duration-300 ease-out hover:w-[200px] md:flex group">
        {/* Logo */}
        <div className="flex h-14 items-center gap-3 border-b border-[var(--border)] px-4">
          <span className="text-lg shrink-0">🚀</span>
          <span
            className="text-sm font-bold tracking-[0.15em] text-[var(--foreground)]/80 opacity-0 transition-opacity duration-300 group-hover:opacity-100 whitespace-nowrap"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            EasyAI
          </span>
        </div>

        {/* Nav items */}
        <div className="flex flex-1 flex-col gap-0.5 px-2 py-4">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 min-h-[44px] ${
                  active
                    ? 'bg-[var(--surface-hover)] text-[var(--foreground)]'
                    : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]/50'
                }`}
              >
                {/* Active left accent */}
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[var(--accent)] transition-all" />
                )}
                <span className="text-base shrink-0">{item.icon}</span>
                <span className="text-[var(--hig-callout)] font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100 whitespace-nowrap">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile: bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-[var(--border)] bg-[var(--nav-bg)] backdrop-blur-2xl md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center gap-1 py-2 min-h-[56px] justify-center transition-colors ${
                active
                  ? 'text-[var(--foreground)]'
                  : 'text-[var(--muted)]'
              }`}
            >
              <span className={`text-xl transition-transform ${active ? 'scale-110' : ''}`}>{item.icon}</span>
              <span className="text-[var(--hig-caption1)] font-semibold uppercase tracking-wider">
                {item.label}
              </span>
              {/* Active blue dot */}
              {active && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--accent)]" />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
