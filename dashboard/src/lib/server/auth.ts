import 'server-only';
import { cookies } from 'next/headers';
import { AuthError } from '../errors';
import { SESSION_COOKIE, validateSessionToken } from './session';

/**
 * Authenticate a request via:
 * 1. Bearer token (API/external calls)
 * 2. Session cookie (browser/dashboard)
 */
export async function requireAuth(request: Request): Promise<void> {
  // Method 1: Bearer token (for API clients, curl, external tools)
  const header = request.headers.get('Authorization');
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);
    const expected = process.env.DASHBOARD_TOKEN;
    if (expected && token === expected) return;
  }

  // Method 2: Session cookie (for browser dashboard)
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE);
    if (sessionCookie && validateSessionToken(sessionCookie.value)) return;
  } catch {
    // cookies() can throw in certain contexts, fall through to error
  }

  throw new AuthError();
}
