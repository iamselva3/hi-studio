const encoder = new TextEncoder();

export function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export async function hmacSha256Hex(secret: string, data: string | ArrayBuffer): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const payload = typeof data === 'string' ? encoder.encode(data) : data;
  return toHex(await crypto.subtle.sign('HMAC', key, payload));
}

/** Constant-time comparison of two equal-length byte arrays (false if lengths differ). */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Constant-time string comparison: compares SHA-256 digests so neither content nor length leaks through timing. */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  return bytesEqual(new Uint8Array(da), new Uint8Array(db));
}

export function base64UrlEncode(text: string): string {
  let binary = '';
  for (const b of encoder.encode(text)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(input: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(input)) return null;
  try {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    return null;
  }
}

export function base64ToBytes(input: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input)) return null;
  try {
    return Uint8Array.from(atob(input), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Uniformly random string from `alphabet` (rejection sampling, no modulo bias). */
export function randomChars(length: number, alphabet: string): string {
  const limit = 256 - (256 % alphabet.length);
  let out = '';
  while (out.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (b < limit && out.length < length) out += alphabet[b % alphabet.length];
    }
  }
  return out;
}

const PBKDF2_MAX_ITERATIONS = 100_000; // Workers rejects higher counts.

export class PasswordHashFormatError extends Error {}

/**
 * Verifies `password` against `pbkdf2_sha256$<iterations>$<base64 salt>$<base64 hash>`.
 * Throws PasswordHashFormatError when the stored hash is malformed (a configuration problem).
 */
export async function verifyPbkdf2(password: string, stored: string): Promise<boolean> {
  const parts = stored.trim().split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') throw new PasswordHashFormatError('Unknown hash format');
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_MAX_ITERATIONS) {
    throw new PasswordHashFormatError(`Iterations must be between 1 and ${PBKDF2_MAX_ITERATIONS}`);
  }
  const salt = base64ToBytes(parts[2]);
  const expected = base64ToBytes(parts[3]);
  if (!salt || salt.length < 8 || !expected || expected.length < 16 || expected.length > 64) {
    throw new PasswordHashFormatError('Salt or hash is not valid base64');
  }
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    expected.length * 8
  );
  return bytesEqual(new Uint8Array(derived), expected);
}
