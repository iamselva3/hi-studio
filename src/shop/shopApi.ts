import { ApiError } from '@/lib/api';
import { OrderItem, Order } from '@/types';
import { ShippingMethod } from './catalog';

/** ApiError that keeps the whole error body (create-order adds `variantId` to item errors). */
export class ShopApiError extends ApiError {
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message, status);
    this.data = data;
  }
  get variantId(): string | undefined {
    return typeof this.data.variantId === 'string' ? this.data.variantId : undefined;
  }
}

/** JSON request for the public shop endpoints. Network failures surface as status 0. */
export async function shopRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ShopApiError('Could not reach the shop. Check your connection and try again.', 0);
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const obj = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const message = typeof obj.error === 'string' && obj.error ? obj.error : `Request failed (${res.status})`;
    throw new ShopApiError(message, res.status, obj);
  }
  return data as T;
}

export interface CreateOrderBody {
  customerName: string;
  phone: string;
  email: string;
  shippingAddress: { addressLine: string; city: string; state: string; pincode: string; country: string };
  items: { variantId: string; qty: number; uploadKeys?: string[] }[];
  shippingMethod: ShippingMethod;
  notes?: string;
}

export interface CreateOrderResponse {
  orderId: string;
  orderNo: string;
  subtotal: number;
  shipping: number;
  total: number;
  currency: 'INR';
  items: OrderItem[];
  razorpay: { keyId: string; orderId: string; amount: number; currency: string };
}

export interface VerifyPaymentBody {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface VerifyPaymentResponse {
  orderNo: string;
  status: Order['status'];
}

export interface OrderLookup {
  order_no: string;
  status: Order['status'];
  tracking_url?: string | null;
  total: number;
  created_at: string;
  city?: string;
  items: { product_name: string; size: string; finish: string; quantity: number; total_paise: number }[];
}

export const createOrder = (body: CreateOrderBody) => shopRequest<CreateOrderResponse>('/api/shop/create-order', body);
export const verifyPayment = (body: VerifyPaymentBody) =>
  shopRequest<VerifyPaymentResponse>('/api/shop/verify-payment', body);
export const lookupOrder = (orderNo: string, phone: string, signal?: AbortSignal) =>
  shopRequest<OrderLookup>(
    `/api/shop/orders/lookup?orderNo=${encodeURIComponent(orderNo)}&phone=${encodeURIComponent(phone)}`,
    undefined,
    signal
  );
