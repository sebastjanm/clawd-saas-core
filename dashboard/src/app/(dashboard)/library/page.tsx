import { PublishedLibrary } from '@/features/library/components/client/PublishedLibrary';

export default function LibraryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[var(--hig-title1)] font-semibold text-[var(--text-primary)]">Library</h1>
      </div>
      <PublishedLibrary />
    </div>
  );
}
