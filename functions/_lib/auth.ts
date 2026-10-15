import type { Env } from './types';
import { HttpError } from './http';
import { base64UrlDecode, base64UrlEncode, hmacSha256Hex, PasswordHashFormatError, safeEqual, verifyPbkdf2 } from './crypto';

export const SESSION_COOKIE = 'hi_studio_session';
export const SESSION_SECONDS = 8 * 60 * 60;

export const loginConfigured = (env: Env) => Boolean(env.JWT_SECRET && (env.ADMIN_PASSWORD_HASH || env.ADMIN_PASSWORD));

/** Checks the admin password. Throws 503 when login is not configured or the stored hash is malformed. */
export async function checkAdminPassword(env: Env, password: string): Promise<boolean> {
  if (!loginConfigured(env)) throw new HttpError(503, 'Admin login is not configured');
  if (env.ADMIN_PASSWORD_HASH) {
    try {
      return await verifyPbkdf2(password, env.ADMIN_PASSWORD_HASH);
    } catch (err) {
      if (err instanceof PasswordHashFormatError) {
        console.error('ADMIN_PASSWORD_HASH is malformed:', err.message);
        throw new HttpError(503, 'Admin login is not configured');
      }
      throw err;
    }
  }
  console.warn('Admin login is using plaintext ADMIN_PASSWORD. Set ADMIN_PASSWORD_HASH instead (npm run hash-password).');
  return safeEqual(password, env.ADMIN_PASSWORD as string);
}

export async function issueToken(secret: string): Promise<{ token: string; expiresAt: number }> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + SESSION_SECONDS;
  const body = `v1.${base64UrlEncode(JSON.stringify({ sub: 'admin', iat, exp }))}`;
  return { token: `${body}.${await hmacSha256Hex(secret, body)}`, expiresAt: exp * 1000 };
}

/** Returns the token's expiry (ms epoch) when it is valid, otherwise null. */
export async function verifyToken(token: string, secret: string): Promise<number | null> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1' || !/^[0-9a-f]{64}$/.test(parts[2])) return null;
  const expected = await hmacSha256Hex(secret, `v1.${parts[1]}`);
  if (!(await safeEqual(expected, parts[2]))) return null;
  const decoded = base64UrlDecode(parts[1]);
  if (!decoded) return null;
  try {
    const claims = JSON.parse(decoded) as { sub?: unknown; exp?: unknown };
    const now = Date.now() / 1000;
    if (claims.sub !== 'admin' || typeof claims.exp !== 'number' || claims.exp <= now) return null;
    return claims.exp * 1000;
  } catch {
    return null;
  }
}

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim() || null;
  }
  return null;
}

/** A session is valid when EITHER the cookie or the bearer token is valid. */
export async function getSession(request: Request, env: Env): Promise<{ expiresAt: number } | null> {
  if (!loginConfigured(env)) return null;
  const secret = env.JWT_SECRET as string;
  const bearer = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
  for (const token of [cookieValue(request, SESSION_COOKIE), bearer]) {
    if (!token) continue;
    const expiresAt = await verifyToken(token, secret);
    if (expiresAt) return { expiresAt };
  }
  return null;
}

export function sessionCookie(request: Request, token: string | null): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  const value = token ?? '';
  const maxAge = token ? SESSION_SECONDS : 0;
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
