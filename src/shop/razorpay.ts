/** Minimal typings for Razorpay Standard Checkout (https://checkout.razorpay.com/v1/checkout.js). */
export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailure {
  error: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: { order_id?: string; payment_id?: string };
  };
}

export interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void; escape?: boolean; confirm_close?: boolean };
  retry?: { enabled: boolean; max_count?: number };
}

export interface RazorpayInstance {
  open: () => void;
  close: () => void;
  on: (event: 'payment.failed', cb: (response: RazorpayFailure) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let loading: Promise<NonNullable<Window['Razorpay']>> | null = null;

/** Loads checkout.js once, on first use. A failed load can be retried. */
export function loadRazorpay(): Promise<NonNullable<Window['Razorpay']>> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SRC;
    script.async = true;
    const fail = () => {
      script.remove();
      loading = null;
      reject(new Error('Could not load the payment window. Check your connection (or any ad blocker) and try again.'));
    };
    const timer = window.setTimeout(fail, 20000);
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.Razorpay) resolve(window.Razorpay);
      else fail();
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      fail();
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Razorpay needs a hex colour; use the site's accent. */
export const themeColor = () => {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  return /^#[0-9a-f]{3,8}$/i.test(v) ? v : '#9A7B48';
};
