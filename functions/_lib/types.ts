export interface Env {
  DB: D1Database;
  /** Public bucket `hi-studio-media`: admin-uploaded portfolio photos and product images. */
  MEDIA: R2Bucket;
  /** Private bucket `hi-studio-uploads`: customer photos for orders. Never served publicly. */
  UPLOADS: R2Bucket;
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_PASSWORD?: string;
  JWT_SECRET?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  ALLOWED_ORIGIN?: string;
}

// API shapes (mirror src/types/index.ts).

export const PHOTO_CATEGORIES = ['weddings', 'baby', 'candid', 'portraits'] as const;
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

export interface PhotoItem {
  id: string;
  category: PhotoCategory;
  title: string;
  subtitle?: string;
  caption?: string;
  alt: string;
  width: number;
  height: number;
  orientation: 'landscape' | 'portrait';
  dominantColor: string;
  lqip: string;
  featured: boolean;
  order: number;
  visible: boolean;
  url: string;
  thumbnailUrl: string;
  r2Key: string;
  thumbR2Key: string;
  responsive?: { avif: Record<number, string>; webp: Record<number, string> };
}

export const PRODUCT_CATEGORIES = ['frames', 'prints', 'canvas', 'albums', 'diaries'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  finish: string;
  price_paise: number;
  sku: string;
  stock: number;
  active: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: ProductCategory;
  base_price_paise: number;
  images: string[];
  active: number;
  featured: number;
  sort_order: number;
  variants: ProductVariant[];
}

export const ORDER_STATUSES = ['pending', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
/** Statuses that mean the customer has paid (used for revenue). */
export const PAID_STATUSES: readonly OrderStatus[] = ['paid', 'packed', 'shipped', 'delivered'];

export interface OrderItem {
  variant_id: string;
  product_name: string;
  size: string;
  finish: string;
  unit_price_paise: number;
  quantity: number;
  total_paise: number;
  upload_keys: string[];
  uploads?: { key: string; url: string }[];
}

export interface ShippingAddress {
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface Order {
  id: string;
  order_no: string;
  customer_name: string;
  phone: string;
  email: string;
  shipping_address: ShippingAddress;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  tracking_url?: string;
  notes?: string;
  created_at: string;
  paid_at?: string;
}

export const INQUIRY_STATUSES = ['new', 'contacted', 'booked', 'archived'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export interface Inquiry {
  id: string;
  name: string;
  phone: string;
  email?: string;
  shoot_type: string;
  event_date?: string;
  location?: string;
  message?: string;
  status: InquiryStatus;
  created_at: string;
}

// D1 rows.

export interface PhotoRow {
  id: string;
  category: string;
  title: string;
  subtitle: string | null;
  caption: string | null;
  alt: string;
  r2_key: string;
  thumb_key: string;
  orientation: string;
  width: number;
  height: number;
  color: string;
  lqip: string | null;
  featured: number;
  order_num: number;
  visible: number;
  url: string | null;
  thumb_url: string | null;
  responsive: string | null;
  r2_prefix: string | null;
  created_at: string | null;
}

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  base_price_paise: number;
  images: string;
  active: number;
  featured: number;
  sort_order: number;
}

export interface VariantRow {
  id: string;
  product_id: string;
  size: string;
  finish: string;
  price_paise: number;
  sku: string;
  stock: number;
  active: number;
}

export interface OrderRow {
  id: string;
  order_no: string;
  customer_name: string;
  phone: string;
  email: string;
  shipping_address: string;
  items: string;
  subtotal: number;
  shipping: number;
  total: number;
  status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  tracking_url: string | null;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface InquiryRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  shoot_type: string;
  event_date: string | null;
  location: string | null;
  message: string | null;
  status: string;
  created_at: string;
}
