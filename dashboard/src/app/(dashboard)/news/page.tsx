import { NewsFeed } from '@/features/news/components/client/NewsFeed';

export default function NewsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">📰</span>
        <div>
          <h2 className="text-[var(--hig-title2)] font-semibold text-[var(--text-primary)]">News Alerts</h2>
          <p className="text-xs text-[var(--text-tertiary)]">Market signals, competitor moves, and industry updates</p>
        </div>
      </div>
      <NewsFeed />
    </div>
  );
}
