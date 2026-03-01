import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSessionToken, SESSION_COOKIE } from '@/lib/server/session';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    const expected = process.env.DASHBOARD_TOKEN;

    if (!expected || token !== expected) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const sessionToken = createSessionToken();
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.FORCE_HTTPS === '1',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
