import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';

const SONIOX_API_URL = 'https://api.soniox.com/v1';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

    const apiKey = process.env.SONIX_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'SONIX_API_KEY not configured' }, { status: 500 });
    }

    const res = await fetch(`${SONIOX_API_URL}/auth/temporary-api-key`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        usage_type: 'transcribe_websocket',
        expires_in_seconds: 3600,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[Soniox TempKey] Error:', text);
      return NextResponse.json({ error: 'Failed to create temporary key' }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Soniox TempKey] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
