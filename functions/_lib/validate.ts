import { badRequest } from './http';

export function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw badRequest(`${label} is missing or invalid`);
  return value as Record<string, unknown>;
}

export function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) throw badRequest(`${label} is required`);
  const text = value.trim();
  if (text.length > max) throw badRequest(`${label} must be ${max} characters or fewer`);
  return text;
}

/** Optional text: undefined/null/blank → null. */
export function optionalText(value: unknown, label: string, max: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw badRequest(`${label} must be text`);
  const text = value.trim();
  if (!text) return null;
  if (text.length > max) throw badRequest(`${label} must be ${max} characters or fewer`);
  return text;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
}

export function integer(value: unknown, label: string, min: number, max: number): number {
  const n = toNumber(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw badRequest(`${label} must be a whole number between ${min} and ${max}`);
  }
  return n;
}

/** Money in paise: any finite non-negative number, rounded to an integer. */
export function paise(value: unknown, label: string): number {
  const n = toNumber(value);
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000_000) throw badRequest(`${label} must be a valid amount in paise`);
  return Math.round(n);
}

export function flag(value: unknown, label: string, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 0 || value === 1) return value === 1;
  throw badRequest(`${label} must be true or false`);
}

export function oneOf<T extends string>(value: unknown, label: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw badRequest(`${label} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

export const digitsOnly = (value: string) => value.replace(/\D/g, '');

export function phone(value: unknown, label: string, minDigits: number, maxDigits: number): string {
  const text = requiredText(value, label, 30);
  const digits = digitsOnly(text);
  if (!/^\+?[\d\s().-]+$/.test(text) || digits.length < minDigits || digits.length > maxDigits) {
    throw badRequest(`${label} must have ${minDigits}–${maxDigits} digits`);
  }
  return text;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function email(value: unknown, label: string, required: boolean): string | null {
  const text = required ? requiredText(value, label, 254) : optionalText(value, label, 254);
  if (text !== null && !EMAIL_RE.test(text)) throw badRequest(`${label} is not a valid email address`);
  return text;
}

export function slugify(text: string, maxLength = 50): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return slug;
}

/** Splits a list into chunks so each IN (...) stays under D1's 100 bound-parameter limit. */
export function chunk<T>(items: T[], size = 90): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');

export const nowIso = () => new Date().toISOString();
