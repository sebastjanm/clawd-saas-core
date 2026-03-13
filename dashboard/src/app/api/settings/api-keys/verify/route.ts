import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse, ValidationError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await requireAuth(request);

    const body = await request.json();
    const { provider, apiKey } = body as { provider: string; apiKey: string };

    if (!provider || !apiKey) {
      throw new ValidationError('provider and apiKey are required');
    }

    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });

      if (res.ok || res.status === 400) {
        // 400 can mean model error but key is valid
        return NextResponse.json({ valid: true });
      }

      const data = await res.json().catch(() => ({}));
      return NextResponse.json({
        valid: false,
        error: (data as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`,
      });
    }

    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });

      if (res.ok) {
        return NextResponse.json({ valid: true });
      }

      const data = await res.json().catch(() => ({}));
      return NextResponse.json({
        valid: false,
        error: (data as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`,
      });
    }

    throw new ValidationError('provider must be "anthropic" or "openai"');
  } catch (error) {
    return errorResponse(error);
  }
}
