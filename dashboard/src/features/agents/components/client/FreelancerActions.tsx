'use client';

import { useState, useEffect } from 'react';
import { Spinner } from '@/shared/components/client/Spinner';

interface FreelancerActionsProps {
  articleId: number;
  project: string;
}

type FreelancerTask = 'cover_art' | 'social_card';

interface MediaItem {
  id: number;
  url: string;
  prompt: string;
  created_at: string;
}

export function FreelancerActions({ articleId, project }: FreelancerActionsProps) {
  const [loading, setLoading] = useState<FreelancerTask | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);

  // Poll for media
  useEffect(() => {
    const fetchMedia = async () => {
      try {
        const res = await fetch(`/api/media/${articleId}`);
        const data = await res.json();
        setMedia(data.media || []);
      } catch (err) {
        console.error('Failed to fetch media');
      }
    };

    fetchMedia();
    const interval = setInterval(fetchMedia, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [articleId]);

  const handleCommission = async (task: FreelancerTask) => {
    if (loading) return;

    setLoading(task);
    setMessage(null);

    try {
      const res = await fetch('/api/agents/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: 'hobi',
          payload: { task, articleId, project }
        })
      });

      if (!res.ok) throw new Error('Trigger failed');
      
      setMessage({ 
        text: 'Hobi is working... (Check back in 1m)', 
        type: 'success' 
      });
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to commission', type: 'error' });
    } finally {
      setLoading(null);
    }
  };

  const setFeatured = async (url: string) => {
    // In future: Update article.featured_image_url
    alert('Set as featured: ' + url);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Commission Panel */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl filter grayscale-[0.2]">🎨</span>
          <div>
            <h3 className="text-[var(--hig-subhead)] font-semibold text-[var(--text-primary)]">
              Hobi (Visuals)
            </h3>
            <p className="text-xs text-[var(--text-tertiary)]">
              On-demand design assets
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleCommission('cover_art')}
            disabled={!!loading}
            className="group w-full flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-alt)] px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--accent)] hover:text-[var(--text-primary)] hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-2 group-hover:translate-x-1 transition-transform">
              <span>🖼️</span> Generate Cover Art
            </span>
            {loading === 'cover_art' && <Spinner size="sm" />}
          </button>

          <button
            onClick={() => handleCommission('social_card')}
            disabled={!!loading}
            className="group w-full flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-alt)] px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--accent)] hover:text-[var(--text-primary)] hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-2 group-hover:translate-x-1 transition-transform">
              <span>📱</span> Create Social Card
            </span>
            {loading === 'social_card' && <Spinner size="sm" />}
          </button>
        </div>

        {message && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium animate-fade-in ${
            message.type === 'success' 
              ? 'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20' 
              : 'bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/20'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      {/* Results Grid */}
      {media.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
           <h3 className="mb-3 text-[var(--hig-subhead)] font-semibold uppercase tracking-wider text-[var(--text-quaternary)]">
            Generated Assets
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {media.map((item) => (
              <div key={item.id} className="group relative aspect-video rounded-lg overflow-hidden bg-[var(--surface-strong)] border border-[var(--border-subtle)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="Hobi asset" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button 
                    onClick={() => window.open(item.url, '_blank')}
                    className="p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20" title="View"
                  >
                    👁️
                  </button>
                  <button 
                    onClick={() => setFeatured(item.url)}
                    className="p-1.5 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent)]/80" title="Use as Featured"
                  >
                    ★
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
