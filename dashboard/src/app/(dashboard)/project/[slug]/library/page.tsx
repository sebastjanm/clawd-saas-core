'use client';

import { PublishedLibrary } from '@/features/library/components/client/PublishedLibrary';

export default function ProjectLibraryPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-[var(--hig-title2)] font-semibold text-[var(--text-primary)]">Library</h2>
      <PublishedLibrary />
    </div>
  );
}
