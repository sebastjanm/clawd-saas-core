import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export interface SocialPost {
  id: number;
  article_id: number;
  platform: string;
  content: string;
  media_brief: string | null;
  media_url: string | null;
  posted_at: string | null;
  post_url: string | null;
  status: string;
  created_at: string;
  // Joined from articles
  article_title?: string;
  article_project?: string;
  article_slug?: string;
  published_url?: string;
}

export interface SocialGroup {
  article_id: number;
  article_title: string;
  article_project: string;
  published_url: string | null;
  posts: SocialPost[];
}

export async function GET(request: Request) {
  try {
    // requireAuth(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const project = searchParams.get('project');

    const db = getDb();

    let query = `
      SELECT sp.*, a.title as article_title, a.project as article_project, 
             a.slug as article_slug, a.published_url
      FROM social_posts sp
      JOIN articles a ON sp.article_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      query += ` AND sp.status = ?`;
      params.push(status);
    }
    if (project) {
      query += ` AND a.project = ?`;
      params.push(project);
    }

    query += ` ORDER BY sp.created_at DESC`;

    const posts = db.prepare(query).all(...params) as SocialPost[];

    // Group by article
    const groupMap = new Map<number, SocialGroup>();
    for (const post of posts) {
      if (!groupMap.has(post.article_id)) {
        groupMap.set(post.article_id, {
          article_id: post.article_id,
          article_title: post.article_title ?? 'Unknown',
          article_project: post.article_project ?? '',
          published_url: post.published_url ?? null,
          posts: [],
        });
      }
      groupMap.get(post.article_id)!.posts.push(post);
    }

    const groups = Array.from(groupMap.values());

    // Stats
    const stats = db
      .prepare(
        `SELECT status, COUNT(*) as count FROM social_posts GROUP BY status`,
      )
      .all() as Array<{ status: string; count: number }>;

    return NextResponse.json({ groups, stats });
  } catch (error) {
    return errorResponse(error);
  }
}
