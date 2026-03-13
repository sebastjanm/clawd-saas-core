'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { HealthDot } from './HealthDot';

type NavItem = { href: string; icon: string; label: string };
type NavSection = { title: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Autopilot',
    items: [
      { href: '/', icon: '📊', label: 'Overview' },
      { href: '/projects', icon: '📁', label: 'Projects' },
      { href: '/library', icon: '📚', label: 'Library' },
      { href: '/social', icon: '📣', label: 'Social' },
      { href: '/strategy', icon: '🐺', label: 'Strategy' },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { href: '/intelligence', icon: '📡', label: 'Intel' },
      { href: '/news', icon: '📰', label: 'News Alerts' },
    ],
  },
  {
    title: 'Jobs',
    items: [
      { href: '/ai', icon: '⚡', label: 'Assistant' },
    ],
  },
  {
    title: 'Creative',
    items: [
      { href: '/tools/image', icon: '🎨', label: 'Image Gen' },
      { href: '/tools/tts', icon: '🔊', label: 'Text to Speech' },
      { href: '/tools/stt', icon: '🎙️', label: 'Speech to Text' },
      { href: '/tools/stt/live', icon: '📡', label: 'Live STT' },
      { href: '/tools/subtitles', icon: '💬', label: 'Subtitles' },
      { href: '/tools/video', icon: '🎬', label: 'Video' },
      { href: '/tools/brand', icon: '🏭', label: 'Brand' },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/agents', icon: '🤖', label: 'Team' },
      { href: '/flow', icon: '🎢', label: 'Flow' },
      { href: '/usage', icon: '💰', label: 'Usage' },
      { href: '/system', icon: '🖥️', label: 'System' },
    ],
  },
];

// Flat list for mobile bottom bar (most important items only)
const MOBILE_NAV: NavItem[] = [
  { href: '/', icon: '📊', label: 'Overview' },
  { href: '/projects', icon: '📁', label: 'Projects' },
  { href: '/social', icon: '📣', label: 'Social' },
  { href: '/ai', icon: '⚡', label: 'Assistant' },
  { href: '/agents', icon: '🤖', label: 'Team' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  
  // Special case for Projects: active if inside /project/[slug] too
  if (href === '/projects') return pathname.startsWith('/projects') || pathname.startsWith('/project/');

  // Exact match for /tools/* subroutes (don't highlight all tools at once)
  if (href.startsWith('/tools/')) return pathname === href;
  
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

  return (
    <>
      {/* Desktop: slim left sidebar — expands on hover */}
      <nav className="sticky top-0 z-50 hidden h-screen w-16 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--nav-bg)] backdrop-blur-2xl transition-all duration-300 ease-out hover:w-[200px] md:flex group">
        {/* Logo */}
        <div className="flex h-14 items-center gap-3 border-b border-[var(--border)] px-4">
          <span className="text-lg shrink-0">🏭</span>
          <span
            className="text-sm font-bold tracking-[0.15em] text-[var(--foreground)]/80 opacity-0 transition-opacity duration-300 group-hover:opacity-100 whitespace-nowrap"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            OLY
          </span>
        </div>

        {/* Nav sections */}
        <div className="flex flex-1 flex-col gap-1 px-2 py-4 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              {/* Section header — only visible on hover */}
              <div className="px-3 pt-3 pb-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-quaternary)]">
                  {section.title}
                </span>
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
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
            </div>
          ))}
        </div>

        {/* Health + Logout */}
        <div className="px-2 py-4 border-t border-[var(--border)] space-y-1">
          <HealthDot />
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

      {/* Mobile: bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-[var(--border)] bg-[var(--nav-bg)] backdrop-blur-2xl md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {MOBILE_NAV.map((item) => {
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
