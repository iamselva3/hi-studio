import {
  INQUIRY_STATUSES,
  ORDER_STATUSES,
  PHOTO_CATEGORIES,
  PRODUCT_CATEGORIES,
  type Inquiry,
  type InquiryRow,
  type InquiryStatus,
  type Order,
  type OrderItem,
  type OrderRow,
  type OrderStatus,
  type PhotoCategory,
  type PhotoItem,
  type PhotoRow,
  type Product,
  type ProductCategory,
  type ProductRow,
  type ShippingAddress,
  type VariantRow,
} from './types';

function parseJson(text: string | null, what: string): unknown {
  if (text === null || text === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    console.error(`Stored ${what} is not valid JSON`);
    return null;
  }
}

/** SQLite CURRENT_TIMESTAMP ("YYYY-MM-DD HH:MM:SS", UTC) → ISO 8601. */
export function isoTime(value: string | null): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(' ', 'T')}Z` : value;
}

function urlMap(value: unknown): Record<number, string> {
  const out: Record<number, string> = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [width, url] of Object.entries(value)) {
      if (/^\d+$/.test(width) && typeof url === 'string') out[Number(width)] = url;
    }
  }
  return out;
}

export function toPhoto(r: PhotoRow): PhotoItem {
  // Uploaded photos live in R2 (served by /api/media); bundled ones are static files under /media.
  const fallbackUrl = (key: string) => (r.r2_prefix ? `/api/media/${key}` : `/media/${key.replace(/\.avif$/, '.webp')}`);
  const photo: PhotoItem = {
    id: r.id,
    category: (PHOTO_CATEGORIES as readonly string[]).includes(r.category) ? (r.category as PhotoCategory) : 'weddings',
    title: r.title,
    alt: r.alt,
    width: r.width,
    height: r.height,
    orientation: r.width > r.height ? 'landscape' : 'portrait',
    dominantColor: r.color,
    lqip: r.lqip ?? '',
    featured: r.featured === 1,
    order: r.order_num,
    visible: r.visible === 1,
    url: r.url ?? fallbackUrl(r.r2_key),
    thumbnailUrl: r.thumb_url ?? fallbackUrl(r.thumb_key),
    r2Key: r.r2_key,
    thumbR2Key: r.thumb_key,
  };
  if (r.subtitle) photo.subtitle = r.subtitle;
  if (r.caption) photo.caption = r.caption;
  const responsive = parseJson(r.responsive, `responsive for photo ${r.id}`) as { avif?: unknown; webp?: unknown } | null;
  if (responsive && typeof responsive === 'object') {
    photo.responsive = { avif: urlMap(responsive.avif), webp: urlMap(responsive.webp) };
  }
  return photo;
}

export function toProduct(r: ProductRow, variants: VariantRow[]): Product {
  const images = parseJson(r.images, `images for product ${r.id}`);
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description ?? '',
    category: (PRODUCT_CATEGORIES as readonly string[]).includes(r.category) ? (r.category as ProductCategory) : 'frames',
    base_price_paise: r.base_price_paise,
    images: Array.isArray(images) ? images.filter((x): x is string => typeof x === 'string') : [],
    active: r.active ? 1 : 0,
    featured: r.featured ? 1 : 0,
    sort_order: r.sort_order,
    variants: variants.map((v) => ({
      id: v.id,
      product_id: v.product_id,
      size: v.size,
      finish: v.finish,
      price_paise: v.price_paise,
      sku: v.sku,
      stock: v.stock,
      active: v.active ? 1 : 0,
    })),
  };
}

/** Groups variant rows under their products (rows keep their query order). */
export function assembleProducts(products: ProductRow[], variants: VariantRow[], dropEmpty: boolean): Product[] {
  const byProduct = new Map<string, VariantRow[]>();
  for (const v of variants) {
    const list = byProduct.get(v.product_id) ?? [];
    list.push(v);
    byProduct.set(v.product_id, list);
  }
  return products
    .map((p) => toProduct(p, byProduct.get(p.id) ?? []))
    .filter((p) => !dropEmpty || p.variants.length > 0);
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function parseOrderItems(text: string): OrderItem[] {
  const raw = parseJson(text, 'order items');
  if (!Array.isArray(raw)) return [];
  return raw.map((it: Record<string, unknown>) => ({
    variant_id: str(it.variant_id),
    product_name: str(it.product_name),
    size: str(it.size),
    finish: str(it.finish),
    unit_price_paise: num(it.unit_price_paise),
    quantity: num(it.quantity),
    total_paise: num(it.total_paise),
    upload_keys: Array.isArray(it.upload_keys) ? it.upload_keys.filter((k): k is string => typeof k === 'string') : [],
  }));
}

export function parseAddress(text: string): ShippingAddress {
  const raw = (parseJson(text, 'shipping address') ?? {}) as Record<string, unknown>;
  return {
    addressLine: str(raw.addressLine),
    city: str(raw.city),
    state: str(raw.state),
    pincode: str(raw.pincode),
    country: str(raw.country),
  };
}

export const customerUploadUrl = (key: string) => `/api/admin/customer-uploads/${key}`;

/** `liveUploads` (admin only) = keys of this order's files still present in the uploads bucket. */
export function toOrder(r: OrderRow, liveUploads?: Set<string>): Order {
  let items = parseOrderItems(r.items);
  if (liveUploads) {
    items = items.map((it) => ({
      ...it,
      uploads: it.upload_keys.filter((k) => liveUploads.has(k)).map((key) => ({ key, url: customerUploadUrl(key) })),
    }));
  }
  const order: Order = {
    id: r.id,
    order_no: r.order_no,
    customer_name: r.customer_name,
    phone: r.phone,
    email: r.email,
    shipping_address: parseAddress(r.shipping_address),
    items,
    subtotal: r.subtotal,
    shipping: r.shipping,
    total: r.total,
    status: (ORDER_STATUSES as readonly string[]).includes(r.status) ? (r.status as OrderStatus) : 'pending',
    created_at: isoTime(r.created_at) ?? '',
  };
  if (r.razorpay_order_id) order.razorpay_order_id = r.razorpay_order_id;
  if (r.razorpay_payment_id) order.razorpay_payment_id = r.razorpay_payment_id;
  if (r.tracking_url) order.tracking_url = r.tracking_url;
  if (r.notes) order.notes = r.notes;
  if (r.paid_at) order.paid_at = isoTime(r.paid_at) ?? undefined;
  return order;
}

export function toInquiry(r: InquiryRow): Inquiry {
  const inquiry: Inquiry = {
    id: r.id,
    name: r.name,
    phone: r.phone,
    shoot_type: r.shoot_type,
    status: (INQUIRY_STATUSES as readonly string[]).includes(r.status) ? (r.status as InquiryStatus) : 'new',
    created_at: isoTime(r.created_at) ?? '',
  };
  if (r.email) inquiry.email = r.email;
  if (r.event_date) inquiry.event_date = r.event_date;
  if (r.location) inquiry.location = r.location;
  if (r.message) inquiry.message = r.message;
  return inquiry;
}
