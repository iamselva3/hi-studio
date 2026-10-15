import type { Env } from './types';
import { HttpError } from './http';
import { parseOrderItems } from './mappers';
import { chunk, nowIso, placeholders } from './validate';

const PAYMENT_START_FAILED = 'Could not start the payment. Please try again.';

export const paymentsConfigured = (env: Env) => Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

/** Creates an order with the Razorpay Orders API. Any failure becomes a 502 for the client. */
export async function createRazorpayOrder(
  env: Env,
  input: { amount: number; receipt: string; notes: Record<string, string> }
): Promise<{ id: string; amount: number; currency: string }> {
  const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
  let res: Response;
  try {
    res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: input.amount, currency: 'INR', receipt: input.receipt, notes: input.notes }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error('Razorpay order request failed', err);
    throw new HttpError(502, PAYMENT_START_FAILED);
  }
  const text = await res.text();
  if (!res.ok) {
    console.error(`Razorpay order creation returned ${res.status}: ${text.slice(0, 500)}`);
    throw new HttpError(502, PAYMENT_START_FAILED);
  }
  let data: { id?: unknown; amount?: unknown; currency?: unknown };
  try {
    data = JSON.parse(text);
  } catch {
    console.error('Razorpay order response was not JSON');
    throw new HttpError(502, PAYMENT_START_FAILED);
  }
  if (typeof data.id !== 'string' || !data.id.startsWith('order_') || data.amount !== input.amount) {
    console.error('Unexpected Razorpay order response', text.slice(0, 500));
    throw new HttpError(502, PAYMENT_START_FAILED);
  }
  return { id: data.id, amount: input.amount, currency: 'INR' };
}

/**
 * Moves a pending order to paid and decrements stock, atomically and at most once.
 * The status UPDATE only matches a pending order and stamps it with a fresh `stock_txn`; the stock
 * UPDATEs only run when the order carries that same stamp, i.e. when this call made the transition.
 * Returns true when this call changed the order.
 */
export async function markPaid(
  env: Env,
  order: { id: string; items: string },
  paymentId: string | null
): Promise<boolean> {
  const txn = crypto.randomUUID();
  const items = parseOrderItems(order.items).filter((it) => it.variant_id && it.quantity > 0);
  const statements = [
    env.DB.prepare(
      `UPDATE orders SET status = 'paid', razorpay_payment_id = COALESCE(?, razorpay_payment_id), paid_at = ?, stock_txn = ?
       WHERE id = ? AND status = 'pending'`
    ).bind(paymentId, nowIso(), txn, order.id),
    ...items.map((it) =>
      env.DB.prepare(
        `UPDATE variants SET stock = MAX(0, stock - ?)
         WHERE id = ? AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND stock_txn = ?)`
      ).bind(it.quantity, it.variant_id, order.id, txn)
    ),
    // A paid order keeps its photos, even if they were since moved to a newer unpaid checkout.
    // Photos already belonging to another paid order are never taken.
    ...chunk([...new Set(items.flatMap((it) => it.upload_keys))]).map((keys) =>
      env.DB.prepare(
        `UPDATE customer_uploads SET order_id = ?
         WHERE deleted_at IS NULL AND r2_key IN (${placeholders(keys.length)})
           AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND stock_txn = ?)
           AND (order_id IS NULL OR order_id IN (SELECT id FROM orders WHERE status = 'pending'))`
      ).bind(order.id, ...keys, order.id, txn)
    ),
  ];
  const results = await env.DB.batch(statements);
  return results[0].meta.changes === 1;
}
