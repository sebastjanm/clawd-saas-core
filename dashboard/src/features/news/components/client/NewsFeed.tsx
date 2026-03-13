'use client';

import { useState, useEffect, useCallback } from 'react';

type NewsItem = {
  id: number;
  project: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  relevance: 'high' | 'medium' | 'low';
  category: string;
  created_at: string;
  read: boolean;
};

const RELEVANCE_STYLES = {
  high: { color: 'var(--error)', bg: 'var(--error)', label: 'High' },
  medium: { color: 'var(--warning)', bg: 'var(--warning)', label: 'Medium' },
  low: { color: 'var(--text-tertiary)', bg: 'var(--text-tertiary)', label: 'Low' },
};

function formatAge(iso: string) {
  const ms = Date.now() - new Date(iso + 'Z').getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function NewsCard({ item, onMarkRead }: { item: NewsItem; onMarkRead: (id: number) => void }) {
  const rel = RELEVANCE_STYLES[item.relevance];

  return (
    <div
      className={`rounded-xl border bg-[var(--bg-secondary)] overflow-hidden transition-all duration-200 hover:border-[var(--border-hover)] ${
        item.read ? 'border-[var(--border)] opacity-60' : 'border-[var(--border)]'
      }`}
    >
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  color: rel.color,
                  backgroundColor: `color-mix(in srgb, ${rel.bg} 12%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${rel.bg} 20%, transparent)`,
                }}
              >
                {rel.label}
              </span>
              <span className="text-[10px] text-[var(--text-quaternary)]">{item.category}</span>
              <span className="text-[10px] text-[var(--text-faint)]">{formatAge(item.created_at)}</span>
            </div>
            <h3 className="text-sm font-semibold text-[var(--text)] leading-snug">{item.title}</h3>
          </div>
          {!item.read && (
            <button
              onClick={() => onMarkRead(item.id)}
              className="shrink-0 w-2 h-2 rounded-full bg-[var(--accent)] mt-2"
              title="Mark as read"
            />
          )}
        </div>

        <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-2">{item.summary}</p>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-tertiary)]">{item.project}</span>
            <span className="text-[10px] text-[var(--text-faint)]">via {item.source}</span>
          </div>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[var(--accent)] hover:underline"
            >
              Source →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function NewsFeed() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'high'>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch('/api/news');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [fetchNews]);

  const markRead = async (id: number) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
    try {
      await fetch('/api/news', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, read: true }),
      });
    } catch { /* silent */ }
  };

  const projects = [...new Set(items.map((i) => i.project).filter(Boolean))].sort();

  const filtered = items.filter((i) => {
    if (filter === 'unread' && i.read) return false;
    if (filter === 'high' && i.relevance !== 'high') return false;
    if (projectFilter !== 'all' && i.project !== projectFilter) return false;
    return true;
  });

  const unreadCount = items.filter((i) => !i.read).length;
  const highCount = items.filter((i) => i.relevance === 'high' && !i.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm text-[var(--text-tertiary)]">Loading alerts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'all', label: `All (${items.length})` },
          { key: 'unread', label: `Unread (${unreadCount})` },
          { key: 'high', label: `🔴 High Priority (${highCount})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as typeof filter)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.key
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            {f.label}
          </button>
        ))}

        {projects.length > 1 && (
          <>
            <span className="text-[var(--border)] text-xs mx-1">|</span>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors appearance-none cursor-pointer"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Feed */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center border border-dashed border-[var(--border)] rounded-xl">
          <span className="text-3xl mb-2">📰</span>
          <p className="text-sm text-[var(--text-secondary)]">
            {filter === 'all'
              ? 'No news alerts yet. Intelligence agents will populate this feed.'
              : 'No matching alerts.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((item) => (
            <NewsCard key={item.id} item={item} onMarkRead={markRead} />
          ))}
        </div>
      )}
    </div>
  );
}
