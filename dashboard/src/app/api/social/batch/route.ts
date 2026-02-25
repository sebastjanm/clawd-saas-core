import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse, ValidationError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// Batch approve/reject all posts for an article
export async function POST(request: Request) {
  try {
    // requireAuth(request);
    const body = (await request.json()) as {
      article_id: number;
      action: 'approve' | 'reject';
    };

    if (!body.article_id || !['approve', 'reject'].includes(body.action)) {
      throw new ValidationError('article_id and action (approve|reject) required');
    }

    const newStatus = body.action === 'approve' ? 'approved' : 'rejected';
    const db = getDb();

    const result = db
      .prepare(
        `UPDATE social_posts SET status = ? WHERE article_id = ? AND status IN ('draft', 'awaiting_approval')`,
      )
      .run(newStatus, body.article_id);

    return NextResponse.json({
      updated: result.changes,
      status: newStatus,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
