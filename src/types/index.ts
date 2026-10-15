export type PhotoCategory = 'weddings' | 'baby' | 'candid' | 'portraits';

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
  responsive?: {
    avif: Record<number, string>;
    webp: Record<number, string>;
  };
}

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
  category: 'frames' | 'prints' | 'canvas' | 'albums' | 'diaries';
  base_price_paise: number;
  images: string[];
  active: number;
  featured: number;
  sort_order: number;
  variants?: ProductVariant[];
}

export interface CartItem {
  /**
   * Identifies the bag line. Plain products use their variantId (adding again merges);
   * lines with the customer's own photos get a unique id so each keeps its photos.
   * Optional for older carts — they fall back to variantId.
   */
  lineId?: string;
  variantId: string;
  productId: string;
  productName: string;
  /** Product URL slug, for linking the bag line back to its page. */
  productSlug?: string;
  variantSize: string;
  variantFinish: string;
  unitPricePaise: number;
  quantity: number;
  /** Product image URL (never a data URL). */
  image: string;
  /** Keys returned by POST /api/shop/uploads for the customer's photos (private bucket). */
  uploadKeys?: string[];
  /** One small (≤ 320px) WebP/JPEG data URL of the customer's photo, for display in the bag only. */
  previewUrl?: string;
  /** Options that have no variant of their own (e.g. "With white mat"); sent to the studio in the order notes. */
  note?: string;
  /**
   * @deprecated Older carts stored whole photos here as base64. Carts containing these are
   * dropped on load; never set them.
   */
  customPhotoUrl?: string;
  /** @deprecated see customPhotoUrl */
  customPhotos?: string[];
  /** @deprecated see customPhotoUrl */
  customUploadId?: string;
}

export interface OrderItem {
  variant_id: string;
  product_name: string;
  size: string;
  finish: string;
  unit_price_paise: number;
  quantity: number;
  total_paise: number;
  // Keys of customer photos in the private uploads bucket.
  upload_keys: string[];
  // Admin API only: download links for those photos.
  uploads?: { key: string; url: string }[];
}

export interface Order {
  id: string;
  order_no: string;
  customer_name: string;
  phone: string;
  email: string;
  shipping_address: {
    addressLine: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  status: 'pending' | 'paid' | 'packed' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  tracking_url?: string;
  notes?: string;
  created_at: string;
  paid_at?: string;
}

export interface StudioSettings {
  studio_profile: {
    name: string;
    legalName: string;
    tagline: string;
    phone: string;
    whatsapp: string;
    email: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    bio: string;
    instagram: string;
    hours: string;
    experienceYears: number;
    weddingsDocumented: number;
    awardsCount: number;
  };
  hero: HeroContent;
  story: StoryContent;
  process: ProcessContent;
  testimonials: Testimonial[];
  portfolio: Record<PhotoCategory, PortfolioCategoryContent>;
  shipping_rules: {
    baseStandardRatePaise: number;
    freeShippingThresholdPaise: number;
    expressDeliveryRatePaise: number;
    estimatedDeliveryDays: string;
  };
  gst_config: {
    ratePercentage: number;
    isPriceInclusive: boolean;
    gstin: string;
    hsnCode: string;
  };
  splash_config: {
    enabled: boolean;
    tagline: string;
    shutterSound: boolean;
  };
  shop_config: {
    codEnabled: boolean;
    currency: string;
    currencySymbol: string;
    lowStockThreshold: number;
    weddingMonographMinPhotos?: number;
    weddingDiaryMinPhotos?: number;
  };
}

export type SettingsKey = keyof StudioSettings;

export interface HeroContent {
  headline: string;
  subheading: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  // Photos shown as prints in the hero; empty means "use featured photos".
  photoIds: string[];
}

export interface StoryContent {
  heading: string;
  paragraphs: string[];
  photoId: string;
}

export interface ProcessStep {
  title: string;
  when: string;
  text: string;
}

export interface ProcessContent {
  heading: string;
  steps: ProcessStep[];
}

export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  event: string;
}

export interface PortfolioCategoryContent {
  label: string;
  description: string;
}

export interface Inquiry {
  id: string;
  name: string;
  phone: string;
  email?: string;
  shoot_type: string;
  event_date?: string;
  location?: string;
  message?: string;
  status: 'new' | 'contacted' | 'booked' | 'archived';
  created_at: string;
}
