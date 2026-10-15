/**
 * Hi Studio API (Cloudflare Pages Functions). Every /api/* request lands here; see functions/_lib for the pieces.
 */
import type { Env } from '../_lib/types';
import { HttpError, clientIp, corsHeaders, errorResponse, json } from '../_lib/http';
import { Router } from '../_lib/router';
import { getSession } from '../_lib/auth';
import { pruneRateLimits } from '../_lib/rate-limit';
import { registerPublicRoutes } from '../_lib/routes/public';
import { registerAuthRoutes } from '../_lib/routes/auth';
import { registerShopRoutes } from '../_lib/routes/shop';
import { registerAdminContentRoutes } from '../_lib/routes/admin-content';
import { registerAdminShopRoutes } from '../_lib/routes/admin-shop';

const router = new Router();
registerPublicRoutes(router);
registerAuthRoutes(router);
registerShopRoutes(router);
registerAdminContentRoutes(router);
registerAdminShopRoutes(router);

async function handle(context: EventContext<Env, string, unknown>, url: URL, method: string): Promise<Response> {
  const { request, env } = context;

  if (url.pathname === '/api/admin' || url.pathname.startsWith('/api/admin/')) {
    if (!(await getSession(request, env))) return json({ error: 'Please sign in again' }, 401);
  }

  const match = router.match(method, url.pathname);
  if (!match) return json({ error: 'Not found' }, 404);
  if ('methodNotAllowed' in match) return json({ error: 'Method not allowed' }, 405);

  return match.handler({
    request,
    env,
    url,
    params: match.params,
    ip: clientIp(request),
    waitUntil: (p) => context.waitUntil(p),
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors ?? {} });

  const isHead = request.method === 'HEAD';
  let response: Response;
  try {
    response = await handle(context, url, isHead ? 'GET' : request.method);
  } catch (err) {
    if (err instanceof HttpError) {
      response = errorResponse(err);
    } else {
      console.error(`${request.method} ${url.pathname} failed:`, err instanceof Error ? (err.stack ?? err.message) : err);
      response = json({ error: 'Something went wrong' }, 500);
    }
  }

  if (Math.random() < 0.01) context.waitUntil(pruneRateLimits(env));

  if (cors || isHead) {
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(cors ?? {})) headers.set(k, v);
    response = new Response(isHead ? null : response.body, { status: response.status, headers });
  }
  return response;
};
