'use client';

import { PublishedLibrary } from '@/features/library/components/client/PublishedLibrary';
import { useParams } from 'next/navigation';

export default function ProjectLibraryPage() {
  // Client component: useParams is safe
  const params = useParams();
  const slug = params.slug as string;

  return (
    <div className="space-y-6">
      <h2 className="text-[var(--hig-title2)] font-semibold text-[var(--text-primary)]">Library</h2>
      <PublishedLibrary initialProject={slug} />
    </div>
  );
}
