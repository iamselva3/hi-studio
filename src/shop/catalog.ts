import { Product, ProductVariant, StudioSettings } from '@/types';
import { formatINR } from '@/lib/api';

export const CUSTOM_FRAME_SLUG = 'custom-fine-art-framing';
export const CUSTOM_FRAME_ID = 'prod-custom-frame-service';

export const isCustomFrameProduct = (p: Pick<Product, 'id' | 'slug'>) =>
  p.slug === CUSTOM_FRAME_SLUG || p.id === CUSTOM_FRAME_ID;

export const productHref = (p: Pick<Product, 'id' | 'slug'>) =>
  isCustomFrameProduct(p) ? '/shop/custom-frame' : `/shop/${p.slug}`;

const CATEGORY_LABELS: Record<string, string> = {
  frames: 'Frames',
  prints: 'Prints',
  canvas: 'Canvas',
  albums: 'Albums',
  diaries: 'Diaries',
};

export const categoryLabel = (c: string) =>
  CATEGORY_LABELS[c] || c.charAt(0).toUpperCase() + c.slice(1).replace(/[-_]/g, ' ');

/** Categories that show a framed 3D preview and take a single photo to print. */
export const isWallCategory = (c: string) => c === 'frames' || c === 'canvas' || c === 'prints';
/** Categories that are made from many of the customer's photos. */
export const isBookCategory = (c: string) => c === 'albums' || c === 'diaries';

export const activeVariants = (p: Product): ProductVariant[] => (p.variants || []).filter((v) => v.active !== 0);

export const priceRange = (p: Product) => {
  const prices = activeVariants(p).map((v) => v.price_paise);
  if (!prices.length) return { min: p.base_price_paise, max: p.base_price_paise };
  return { min: Math.min(...prices), max: Math.max(...prices) };
};

/** "₹4,500" or "from ₹4,500" when options differ in price. */
export const priceLabel = (p: Product) => {
  const { min, max } = priceRange(p);
  return min === max ? formatINR(min) : `from ${formatINR(min)}`;
};

export const uniq = <T,>(list: T[]) => Array.from(new Set(list));

/** Parses sizes such as "12x18 in (A3+)", "16 × 24 in" or "30x45 cm" into inches. */
export const parseSizeInches = (size: string): [number, number] | null => {
  const m = size.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const k = /cm\b/i.test(size) ? 1 / 2.54 : /mm\b/i.test(size) ? 1 / 25.4 : 1;
  const a = parseFloat(m[1]) * k;
  const b = parseFloat(m[2]) * k;
  return a > 0 && b > 0 ? [a, b] : null;
};

/** Short display label for a size: drops the bracketed note ("12x18 in (A3+)" → "12x18 in"). */
export const sizeShort = (size: string) => size.replace(/\s*\(.*\)\s*$/, '');

export const MIN_PRINT_DPI = 150;

/**
 * Print sharpness of a photo at a print size. The photo is cropped to the print's shape in the same
 * orientation, so the tighter side decides.
 */
export const printDpi = (imgW: number, imgH: number, size: string): number | null => {
  const inches = parseSizeInches(size);
  if (!inches || !imgW || !imgH) return null;
  const longIn = Math.max(...inches);
  const shortIn = Math.min(...inches);
  return Math.floor(Math.min(Math.max(imgW, imgH) / longIn, Math.min(imgW, imgH) / shortIn));
};

/** Pixels needed for a size at the minimum DPI, as "2,700 × 1,800 px" (landscape first when the photo is). */
export const requiredPixelsLabel = (size: string, landscape = false, dpi = MIN_PRINT_DPI) => {
  const inches = parseSizeInches(size);
  if (!inches) return '';
  const [short, long] = [Math.min(...inches), Math.max(...inches)].map((n) => Math.ceil(n * dpi).toLocaleString('en-IN'));
  return landscape ? `${long} × ${short} px` : `${short} × ${long} px`;
};

/** Print aspect (w/h) for a size, turned to match the photo's orientation. */
export const printAspect = (size: string, imgW?: number, imgH?: number): number | null => {
  const inches = parseSizeInches(size);
  if (!inches) return null;
  const longIn = Math.max(...inches);
  const shortIn = Math.min(...inches);
  const landscape = imgW && imgH ? imgW > imgH : false;
  return landscape ? longIn / shortIn : shortIn / longIn;
};

export type ShippingMethod = 'standard' | 'express';

/** Same rule as the server: express → express rate; otherwise free above the threshold, else the base rate. */
export const shippingFor = (
  subtotalPaise: number,
  method: ShippingMethod,
  rules: StudioSettings['shipping_rules']
) => {
  if (method === 'express') return rules.expressDeliveryRatePaise;
  if (rules.freeShippingThresholdPaise > 0 && subtotalPaise >= rules.freeShippingThresholdPaise) return 0;
  return rules.baseStandardRatePaise;
};

/** One line about delivery for the bag and product pages. */
export const deliveryNote = (rules: StudioSettings['shipping_rules'], subtotalPaise?: number) => {
  const threshold = rules.freeShippingThresholdPaise;
  if (subtotalPaise !== undefined && threshold > 0 && subtotalPaise >= threshold) return 'Free standard delivery on this order.';
  if (rules.baseStandardRatePaise <= 0) return 'Free standard delivery.';
  const base = `Standard delivery ${formatINR(rules.baseStandardRatePaise)}`;
  return threshold > 0 ? `${base}, free on orders over ${formatINR(threshold)}.` : `${base}.`;
};

export const gstNote = (gst: StudioSettings['gst_config']) =>
  gst.isPriceInclusive && gst.ratePercentage > 0 ? `Prices include ${gst.ratePercentage}% GST.` : '';

export const whatsappLink = (number: string, text?: string) => {
  const digits = (number || '').replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};
