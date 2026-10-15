import type { Env } from './types';

export const SETTINGS_KEYS = [
  'studio_profile',
  'hero',
  'story',
  'process',
  'testimonials',
  'portfolio',
  'splash_config',
  'shipping_rules',
  'gst_config',
  'shop_config',
] as const;
export type SettingsKey = (typeof SETTINGS_KEYS)[number];

/** Keys whose value is a JSON array; every other key holds a JSON object. */
export const ARRAY_SETTINGS: readonly SettingsKey[] = ['testimonials'];

export const isSettingsKey = (key: unknown): key is SettingsKey =>
  typeof key === 'string' && (SETTINGS_KEYS as readonly string[]).includes(key);

export function parseSettingsRows(rows: { key: string; value: string }[]): Partial<Record<SettingsKey, unknown>> {
  const out: Partial<Record<SettingsKey, unknown>> = {};
  for (const row of rows) {
    if (!isSettingsKey(row.key)) continue;
    try {
      out[row.key] = JSON.parse(row.value);
    } catch {
      console.error(`Setting ${row.key} is not valid JSON; ignoring it`);
    }
  }
  return out;
}

export async function getSetting(env: Env, key: SettingsKey): Promise<Record<string, unknown>> {
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>();
  if (!row) return {};
  try {
    const value = JSON.parse(row.value);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    console.error(`Setting ${key} is not valid JSON; using defaults`);
    return {};
  }
}

function nonNegativeInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback;
}

export const SHIPPING_DEFAULTS = {
  baseStandardRatePaise: 25000,
  freeShippingThresholdPaise: 499900,
  expressDeliveryRatePaise: 55000,
};

export async function getShippingRules(env: Env) {
  const saved = await getSetting(env, 'shipping_rules');
  return {
    baseStandardRatePaise: nonNegativeInt(saved.baseStandardRatePaise, SHIPPING_DEFAULTS.baseStandardRatePaise),
    freeShippingThresholdPaise: nonNegativeInt(saved.freeShippingThresholdPaise, SHIPPING_DEFAULTS.freeShippingThresholdPaise),
    expressDeliveryRatePaise: nonNegativeInt(saved.expressDeliveryRatePaise, SHIPPING_DEFAULTS.expressDeliveryRatePaise),
  };
}

export async function getLowStockThreshold(env: Env): Promise<number> {
  const saved = await getSetting(env, 'shop_config');
  return nonNegativeInt(saved.lowStockThreshold, 3);
}
