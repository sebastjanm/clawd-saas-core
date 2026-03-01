import 'server-only';
import { randomBytes, createHmac } from 'node:crypto';

export const SESSION_COOKIE = 'saas_session';

// Derive a signing key from the dashboard token (so no extra env var needed)
function getSigningKey(): string {
  const token = process.env.DASHBOARD_TOKEN;
  if (!token) throw new Error('DASHBOARD_TOKEN not set');
  return createHmac('sha256', 'clawd-saas-session-key').update(token).digest('hex');
}

/** Create a signed session token. Not the raw dashboard token — a separate value. */
export function createSessionToken(): string {
  const payload = randomBytes(32).toString('hex');
  const key = getSigningKey();
  const sig = createHmac('sha256', key).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

/** Validate a session token's signature. */
export function validateSessionToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const key = getSigningKey();
  const expected = createHmac('sha256', key).update(payload).digest('hex');
  // Constant-time comparison
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}
