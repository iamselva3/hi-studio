import type { Router } from '../router';
import { HttpError, badRequest, json, readJson } from '../http';
import { checkAdminPassword, getSession, issueToken, loginConfigured, sessionCookie } from '../auth';
import { hit, reset } from '../rate-limit';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;

export function registerAuthRoutes(router: Router) {
  router.post('/api/auth/login', async ({ env, request, ip }) => {
    if (!loginConfigured(env)) throw new HttpError(503, 'Admin login is not configured');

    // Every attempt is counted; a successful login clears the counter, so only failures accumulate.
    const { count, retryAfterSeconds } = await hit(env, 'login', ip, LOGIN_WINDOW_MS);
    if (count > LOGIN_MAX_FAILURES) {
      throw new HttpError(429, 'Too many sign-in attempts. Please try again later.', {}, {
        'Retry-After': String(retryAfterSeconds),
      });
    }

    const body = await readJson(request);
    const password = body.password;
    if (typeof password !== 'string' || !password || password.length > 1024) throw badRequest('Password is required');

    if (!(await checkAdminPassword(env, password))) return json({ error: 'Incorrect password' }, 401);

    await reset(env, 'login', ip);
    const { token, expiresAt } = await issueToken(env.JWT_SECRET as string);
    return json({ ok: true, token, expiresAt }, 200, { 'Set-Cookie': sessionCookie(request, token) });
  });

  router.get('/api/auth/me', async ({ env, request }) => {
    const session = await getSession(request, env);
    if (!session) return json({ error: 'Not signed in' }, 401);
    return json({ authenticated: true, expiresAt: session.expiresAt });
  });

  router.post('/api/auth/logout', ({ request }) =>
    json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(request, null) })
  );
}
