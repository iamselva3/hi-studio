import placeholders from './placeholders.json';
import { StudioSettings } from '@/types';

/**
 * Content shown until the admin saves their own version (stored in D1 `settings`).
 * Everything here is editable from Admin → Brand & Content / Studio Profile.
 */
export const DEFAULT_SETTINGS: StudioSettings = {
  studio_profile: {
    name: placeholders.brand.studio_name.value,
    legalName: placeholders.brand.legal_company_name.value,
    tagline: placeholders.brand.tagline.value,
    phone: placeholders.contact.phone.value,
    whatsapp: placeholders.contact.whatsapp_number.value,
    email: placeholders.contact.email.value,
    address: placeholders.contact.studio_address.street,
    city: placeholders.contact.studio_address.city,
    state: placeholders.contact.studio_address.state,
    pincode: placeholders.contact.studio_address.pincode,
    country: placeholders.contact.studio_address.country,
    bio: 'A small photography studio in Coimbatore. We photograph weddings, children and families, and print and frame the pictures in our own workshop.',
    instagram: placeholders.contact.instagram_handle.value,
    hours: 'Mon – Sat, 9:30 am – 8:00 pm',
    // Shown on the site only when set above zero.
    experienceYears: 0,
    weddingsDocumented: 0,
    awardsCount: 0,
  },
  hero: {
    headline: placeholders.brand.tagline.value,
    subheading: 'Weddings, children and portraits, photographed in Coimbatore — then printed, framed and bound by hand in our workshop.',
    primaryCtaLabel: 'Book a shoot',
    secondaryCtaLabel: 'Shop frames & albums',
    photoIds: [],
  },
  story: {
    heading: 'We stay out of the way, so the day stays yours.',
    paragraphs: [
      'Most of our work is quiet watching. We learn the order of your rituals beforehand, find the light early, and then let the families, priests and friends carry the day.',
      'After the shoot, every picture is colour-corrected by hand. The ones you choose are printed on cotton rag paper and framed or bound in our Coimbatore workshop.',
    ],
    photoId: 'hi-portrait-couture-shana',
  },
  process: {
    heading: 'From the first call to the frame on your wall',
    steps: [
      { title: 'Meet', when: 'Months before', text: 'We sit down with you, in person or on a call, to plan the rituals, timings and the people who matter.' },
      { title: 'Photograph', when: 'On the day', text: 'Two photographers cover the day quietly, from getting ready to the last goodbye.' },
      { title: 'Edit', when: '3–4 weeks', text: 'Each picture is colour-corrected by hand. You get an online gallery to view, download and choose favourites.' },
      { title: 'Print & frame', when: '6–8 weeks', text: 'Albums, prints and frames are made in our workshop and delivered to your door.' },
    ],
  },
  // Add real client words from the admin panel; the section stays hidden while this is empty.
  testimonials: [],
  portfolio: {
    weddings: { label: 'Weddings', description: 'Muhurthams, receptions and everything in between.' },
    baby: { label: 'Children & family', description: 'Newborns, first birthdays, maternity and family days.' },
    candid: { label: 'Candid', description: 'Unposed moments from celebrations and festivals.' },
    portraits: { label: 'Portraits', description: 'Bridal, fashion and personal portraits.' },
  },
  shipping_rules: {
    baseStandardRatePaise: placeholders.shop.standard_shipping_paise.value,
    freeShippingThresholdPaise: placeholders.shop.free_shipping_threshold_paise.value,
    expressDeliveryRatePaise: 55000,
    estimatedDeliveryDays: '5–7 business days for custom frames',
  },
  gst_config: {
    ratePercentage: 18,
    isPriceInclusive: true,
    gstin: placeholders.shop.gst_number.value,
    hsnCode: '49119100',
  },
  splash_config: {
    enabled: true,
    tagline: placeholders.brand.tagline.value,
    shutterSound: false,
  },
  shop_config: {
    codEnabled: false,
    currency: placeholders.shop.currency,
    currencySymbol: placeholders.shop.currency_symbol,
    lowStockThreshold: 3,
  },
};

/** Merge a saved value over its default so new fields added later still have values. */
export function mergeSetting<T>(fallback: T, saved: unknown): T {
  if (saved === undefined || saved === null) return fallback;
  if (Array.isArray(fallback)) return (Array.isArray(saved) ? saved : fallback) as T;
  if (typeof fallback === 'object' && typeof saved === 'object' && !Array.isArray(saved)) {
    return { ...fallback, ...(saved as object) } as T;
  }
  return saved as T;
}

export function mergeSettings(saved: Partial<Record<keyof StudioSettings, unknown>>): StudioSettings {
  const out = { ...DEFAULT_SETTINGS };
  (Object.keys(DEFAULT_SETTINGS) as (keyof StudioSettings)[]).forEach((key) => {
    (out as Record<string, unknown>)[key] = mergeSetting(DEFAULT_SETTINGS[key], saved[key]);
  });
  return out;
}
