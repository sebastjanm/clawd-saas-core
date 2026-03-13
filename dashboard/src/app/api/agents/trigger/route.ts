import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse, ValidationError } from '@/lib/errors';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const TriggerSchema = z.object({
  agentName: z.string().min(1),
  message: z.string().optional(),
  payload: z.any().optional(),
});

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN ?? '';
const PIPELINE_ROUTER_URL = process.env.PIPELINE_ROUTER_URL ?? 'http://127.0.0.1:3401';

const FREELANCER_AGENTS = new Set(['hobi', 'risko', 'orao', 'delfi', 'kodi', 'tigo']);

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await requireAuth(request);
    const body: unknown = await request.json();
    const parsed = TriggerSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
    }

    const { agentName, message, payload } = parsed.data;

    if (FREELANCER_AGENTS.has(agentName)) {
      // Freelancer (Pipeline Router)
      // Forward the request to the Pipeline Router's /hooks/agent endpoint
      const res = await fetch(`${PIPELINE_ROUTER_URL}/hooks/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          agent: agentName,
          task: payload?.task || 'default',
          article_id: payload?.articleId,
          project: payload?.project,
          message 
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        return NextResponse.json({ error: txt }, { status: res.status });
      }

      return NextResponse.json({ ok: true, agent: agentName, mode: 'pipeline' });
    } else {
      // Cron Job (Gateway)
      const res = await fetch(`${GATEWAY_URL}/api/cron/${agentName}/trigger`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GATEWAY_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        logger.warn({ status: res.status, agent: agentName }, 'Cron trigger failed');
        return NextResponse.json(
          { error: 'Failed to trigger cron agent', code: 'TRIGGER_FAILED' },
          { status: 502 },
        );
      }

      return NextResponse.json({ ok: true, agent: agentName, mode: 'cron' });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
