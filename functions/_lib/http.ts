import type { Env } from './types';

/** An error whose message is safe to show to the client. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra: Record<string, unknown> = {},
    public headers: Record<string, string> = {}
  ) {
    super(message);
  }
}

export const badRequest = (message: string, extra?: Record<string, unknown>) => new HttpError(400, message, extra);
export const notFound = (message = 'Not found') => new HttpError(404, message);

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  const h = new Headers(headers);
  h.set('Content-Type', 'application/json; charset=utf-8');
  h.set('X-Content-Type-Options', 'nosniff');
  if (!h.has('Cache-Control')) h.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function errorResponse(err: HttpError): Response {
  return json({ error: err.message, ...err.extra }, err.status, err.headers);
}

const MAX_JSON_BYTES = 512 * 1024;

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > MAX_JSON_BYTES) throw new HttpError(413, 'Request body is too large');
  const buf = await request.arrayBuffer();
  if (buf.byteLength > MAX_JSON_BYTES) throw new HttpError(413, 'Request body is too large');
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder().decode(buf));
  } catch {
    throw badRequest('Request body must be valid JSON');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw badRequest('Request body must be a JSON object');
  return data as Record<string, unknown>;
}

export async function readForm(request: Request, maxBytes: number): Promise<FormData> {
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > maxBytes) throw new HttpError(413, 'Upload is too large');
  const type = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!type.startsWith('multipart/form-data')) throw new HttpError(415, 'Expected a multipart/form-data upload');
  try {
    return await request.formData();
  } catch {
    throw badRequest('Could not read the upload');
  }
}

export function fileField(form: FormData, name: string): File | null {
  const value = form.get(name);
  return value instanceof File ? value : null;
}

/** CORS headers, only when ALLOWED_ORIGIN names one specific origin and the request comes from it. */
export function corsHeaders(request: Request, env: Env): Record<string, string> | null {
  const allowed = env.ALLOWED_ORIGIN?.trim();
  if (!allowed || allowed === '*') return null;
  if (request.headers.get('Origin') !== allowed) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 'local';
}
