'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useProjects } from '@/shared/hooks/useProjects';

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/' || pathname === '';
  return pathname.startsWith(href);
}

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }
  const { projects } = useProjects();

  // Filter out the "All projects" placeholder
  const realProjects = projects.filter((p) => p.id !== '');

  // Build nav items dynamically based on project count
  const NAV_ITEMS = buildNavItems(realProjects);

  return (
    <>
      {/* Desktop: slim left sidebar — expands on hover */}
      <nav className="sticky top-0 z-50 hidden h-screen w-16 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--nav-bg)] backdrop-blur-2xl transition-all duration-300 ease-out hover:w-[200px] md:flex group">
        {/* Logo */}
        <div className="flex h-14 items-center gap-3 border-b border-[var(--border)] px-4">
          <span className="text-lg shrink-0">🚀</span>
          <div className="opacity-0 transition-opacity duration-300 group-hover:opacity-100 whitespace-nowrap overflow-hidden">
            <span
              className="text-sm font-bold tracking-[0.15em] text-[var(--foreground)]/80"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              EasyAI
            </span>
            {process.env.NEXT_PUBLIC_COMPANY_NAME && (
              <div className="text-[10px] text-[var(--muted)] leading-tight truncate">
                {process.env.NEXT_PUBLIC_COMPANY_NAME}
              </div>
            )}
          </div>
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

        {/* Logout */}
        <div className="px-2 py-4 border-t border-[var(--border)]">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]/50 transition-all duration-200 min-h-[44px]"
          >
            <span className="text-base shrink-0">🚪</span>
            <span className="text-[var(--hig-callout)] font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100 whitespace-nowrap">
              Logout
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile: bottom tab bar (top 5 items only) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-[var(--border)] bg-[var(--nav-bg)] backdrop-blur-2xl md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {NAV_ITEMS.slice(0, 5).map((item) => {
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

type NavItem = { href: string; icon: string; label: string };

function buildNavItems(projects: { id: string; label: string }[]): NavItem[] {
  // Single project: navigation goes directly to /project/[slug]/*
  // Multi project: show global views with project dropdowns
  if (projects.length === 1) {
    const slug = projects[0].id;
    const name = projects[0].label
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return [
      { href: '/', icon: '🏠', label: 'Dashboard' },
      { href: `/project/${slug}/pipeline`, icon: '📋', label: 'Pipeline' },
      { href: `/project/${slug}/social`, icon: '🐝', label: 'Social' },
      { href: `/project/${slug}/library`, icon: '📚', label: 'Library' },
      { href: `/project/${slug}/agents`, icon: '🤖', label: 'Agents' },
      { href: `/project/${slug}/settings`, icon: '⚙️', label: 'Settings' },
      { href: '/usage', icon: '💰', label: 'Usage' },
    ];
  }

  // Multi-project: global views + projects page
  return [
    { href: '/', icon: '🏠', label: 'Dashboard' },
    { href: '/pipeline', icon: '📋', label: 'Pipeline' },
    { href: '/overview', icon: '🏭', label: 'Overview' },
    { href: '/social', icon: '🐝', label: 'Social' },
    { href: '/library', icon: '📚', label: 'Library' },
    { href: '/agents', icon: '🤖', label: 'Agents' },
    { href: '/strategy', icon: '🐺', label: 'Strategy' },
    { href: '/projects', icon: '📁', label: 'Projects' },
    { href: '/usage', icon: '💰', label: 'Usage' },
  ];
}
