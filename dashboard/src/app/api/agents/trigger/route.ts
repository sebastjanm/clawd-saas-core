import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse, ValidationError } from '@/lib/errors';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const TriggerSchema = z.object({
  agentName: z.string().min(1),
  message: z.string().optional(),
});

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN ?? '';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // requireAuth(request);
    const body: unknown = await request.json();
    const parsed = TriggerSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
    }

    const { agentName, message } = parsed.data;

    const res = await fetch(`${GATEWAY_URL}/api/cron/${agentName}/trigger`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GATEWAY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!res.ok) {
      logger.warn({ status: res.status, agent: agentName }, 'Trigger failed');
      return NextResponse.json(
        { error: 'Failed to trigger agent', code: 'TRIGGER_FAILED' },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, agent: agentName });
  } catch (error) {
    return errorResponse(error);
  }
}
