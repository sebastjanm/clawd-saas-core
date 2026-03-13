'use client';

import { useEffect, useState } from 'react';
import { apiPath } from '@/shared/lib/apiPath';

interface ArticleEvent {
  id: number;
  article_id: number;
  project: string;
  phase: string | null;
  event_type: string;
  agent: string | null;
  agent_type: string | null;
  status: string | null;
  priority: string | null;
  blocked_reason: string | null;
  error_message: string | null;
  detail: string | null;
  metadata: string | null;
  created_at: string;
}

const TOKEN = typeof window !== 'undefined' ? 'tovarna_dashboard_2026' : '';

const EVENT_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  status_change:    { icon: '→',  color: 'var(--accent)',  label: 'Status change' },
  agent_started:    { icon: '▶',  color: 'var(--success)', label: 'Agent started' },
  agent_completed:  { icon: '✓',  color: 'var(--success)', label: 'Agent completed' },
  agent_failed:     { icon: '✕',  color: 'var(--error)',   label: 'Agent failed' },
  agent_blocked:    { icon: '⏸',  color: 'var(--warning)', label: 'Blocked' },
  enqueued:         { icon: '+',  color: 'var(--accent)',  label: 'Enqueued' },
  manual_advance:   { icon: '↗',  color: 'var(--success)', label: 'Approved' },
  manual_reject:    { icon: '↩',  color: 'var(--error)',   label: 'Sent back' },
  priority_changed: { icon: '🔥', color: 'var(--warning)', label: 'Priority changed' },
  published:        { icon: '🚀', color: 'var(--success)', label: 'Published' },
  cancelled:        { icon: '⛔', color: 'var(--error)',   label: 'Cancelled' },
};

export function ArticleTimeline({ articleId }: { articleId: number }) {
  const [events, setEvents] = useState<ArticleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch(apiPath(`/api/pipeline/${articleId}/events`), {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [articleId]);

  if (loading) return <div className="text-xs text-[var(--text-faint)]">Loading timeline...</div>;
  if (events.length === 0) return <div className="text-xs text-[var(--text-faint)]">No events recorded</div>;

  const shown = expanded ? events : events.slice(0, 5);

  return (
    <div className="space-y-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs font-semibold text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] transition-colors"
      >
        Timeline ({events.length} events) {expanded ? '▼' : '▶'}
      </button>

      {(expanded || events.length <= 5) && (
        <div className="relative ml-2 border-l border-[var(--border-subtle)] space-y-0">
          {shown.map((evt) => {
            const config = EVENT_CONFIG[evt.event_type] ?? { icon: '•', color: 'var(--text-faint)', label: evt.event_type };
            const meta = evt.metadata ? JSON.parse(evt.metadata) : null;

            return (
              <div key={evt.id} className="relative pl-4 py-1.5 group">
                {/* Dot on timeline */}
                <span
                  className="absolute left-[-4.5px] top-[10px] inline-flex h-2 w-2 rounded-full"
                  style={{ backgroundColor: config.color }}
                />

                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[10px] tabular-nums text-[var(--text-faint)] shrink-0">
                    {formatEventTime(evt.created_at)}
                  </span>
                  <span className="text-[11px] font-medium" style={{ color: config.color }}>
                    {config.icon} {config.label}
                  </span>
                  {evt.agent && (
                    <span className="text-[10px] text-[var(--text-quaternary)]">
                      by {evt.agent}
                    </span>
                  )}
                </div>

                {evt.detail && (
                  <p className="text-[10px] text-[var(--text-faint)] mt-0.5">{evt.detail}</p>
                )}
                {evt.error_message && (
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">A processing issue occurred. The system will retry automatically.</p>
                )}
                {evt.blocked_reason && (
                  <p className="text-[10px] text-[var(--warning)] mt-0.5">{evt.blocked_reason}</p>
                )}
                {meta?.feedback && (
                  <p className="text-[10px] text-[var(--text-faint)] mt-0.5 italic">"{meta.feedback}"</p>
                )}
                {meta?.duration_ms && (
                  <span className="text-[10px] text-[var(--text-faint)]"> · {Math.round(meta.duration_ms / 1000)}s</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!expanded && events.length > 5 && (
        <button
          onClick={() => setExpanded(true)}
          className="ml-2 text-[10px] text-[var(--accent)] hover:underline"
        >
          Show {events.length - 5} more events
        </button>
      )}
    </div>
  );
}

function formatEventTime(iso: string): string {
  try {
    const d = new Date(iso + (iso.includes('Z') || iso.includes('+') ? '' : 'Z'));
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = diffMs / 3600000;

    if (diffH < 24) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return iso;
  }
}
