import 'server-only';
import { AuthError } from '../errors';

export function requireAuth(request: Request): void {
  const header = request.headers.get('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const expected = process.env.DASHBOARD_TOKEN;

  if (!expected || token !== expected) {
    throw new AuthError();
  }
}
