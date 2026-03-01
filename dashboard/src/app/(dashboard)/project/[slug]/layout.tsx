'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';

const TABS = [
  { id: 'pipeline', label: '📋 Pipeline', href: '/pipeline' },
  { id: 'social', label: '🐝 Social', href: '/social' },
  { id: 'library', label: '📚 Library', href: '/library' },
  { id: 'settings', label: '⚙️ Settings', href: '/settings' },
];

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // useParams is a client hook, so it returns params directly (not a promise)
  // This file is 'use client', so it's safe.
  const params = useParams();
  const pathname = usePathname();
  const projectSlug = (params.slug as string) || 'Project';

  // Derive project name from slug
  const projectName = projectSlug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="flex flex-col gap-1 px-1">
        <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">
          <Link href="/projects" className="hover:text-[var(--text-primary)] transition-colors">
            Projects
          </Link>
          <span className="text-[var(--text-quaternary)]">/</span>
          <span className="text-[var(--text-secondary)]">{projectName}</span>
        </div>
        <h1 className="text-[var(--hig-title1)] font-bold text-[var(--text-primary)]">
          {projectName}
        </h1>
      </div>

      {/* Project Navigation Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)] overflow-x-auto no-scrollbar">
        {TABS.map((tab) => {
          const href = `/project/${projectSlug}${tab.href}`;
          const isActive = pathname === href || (pathname === `/project/${projectSlug}` && tab.id === 'pipeline');
          
          return (
            <Link
              key={tab.id}
              href={href}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-[var(--accent)] text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)]'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Project Content */}
      <div className="animate-fade-in pt-4">
        {children}
      </div>
    </div>
  );
}
