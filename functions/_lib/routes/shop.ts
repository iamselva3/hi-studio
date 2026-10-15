import type { Router } from '../router';
import type { Env, OrderItem, OrderRow, ShippingAddress } from '../types';
import { HttpError, badRequest, fileField, json, notFound, readForm, readJson } from '../http';
import { CUSTOMER_KEY_RE, IMAGE_EXT, readImage } from '../files';
import { enforce } from '../rate-limit';
import { getShippingRules } from '../settings';
import { createRazorpayOrder, markPaid, paymentsConfigured } from '../payments';
import { hmacSha256Hex, randomChars, safeEqual } from '../crypto';
import { isoTime, parseAddress, parseOrderItems } from '../mappers';
import {
  asObject,
  chunk,
  digitsOnly,
  email,
  integer,
  nowIso,
  oneOf,
  optionalText,
  phone,
  placeholders,
  requiredText,
} from '../validate';

const MB = 1024 * 1024;
const MINUTE = 60 * 1000;

/** HI-YYMMDD-XXXX using the date in India. */
function makeOrderNo(): string {
  const d = new Date(Date.now() + 330 * MINUTE);
  const ymd = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `HI-${ymd}-${randomChars(4, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')}`;
}

async function unusedOrderNo(env: Env): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const candidate = makeOrderNo();
    const taken = await env.DB.prepare('SELECT 1 FROM orders WHERE order_no = ?').bind(candidate).first();
    if (!taken) return candidate;
  }
  throw new Error('Could not find an unused order number');
}

const last10 = (value: string) => digitsOnly(value).slice(-10);

interface VariantForOrder {
  id: string;
  size: string;
  finish: string;
  price_paise: number;
  stock: number;
  variant_active: number;
  product_active: number;
  product_name: string;
}

export function registerShopRoutes(router: Router) {
  router.post('/api/shop/uploads', async ({ env, request, ip }) => {
    await enforce(env, 'shop-upload', ip, 300, 60 * MINUTE, 'Too many uploads from your connection. Please try again later.');
    const form = await readForm(request, 26 * MB);
    const file = fileField(form, 'file');
    if (!file) throw badRequest('Choose a photo to upload');
    const { bytes, type } = await readImage(file, ['image/jpeg', 'image/png', 'image/webp'], 25 * MB, 'Photo');

    const now = nowIso();
    const key = `customer/${now.slice(0, 10)}/${crypto.randomUUID()}.${IMAGE_EXT[type]}`;
    const originalName = file.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200) || null;
    await env.UPLOADS.put(key, bytes, { httpMetadata: { contentType: type } });
    try {
      await env.DB.prepare(
        `INSERT INTO customer_uploads (id, order_id, r2_key, mime, size, original_name, created_at)
         VALUES (?, NULL, ?, ?, ?, ?, ?)`
      )
        .bind(crypto.randomUUID(), key, type, bytes.byteLength, originalName, now)
        .run();
    } catch (err) {
      await env.UPLOADS.delete(key).catch((e) => console.error('Failed to remove orphaned upload', key, e));
      throw err;
    }
    return json({ key }, 201);
  });

  router.post('/api/shop/create-order', async ({ env, request }) => {
    if (!paymentsConfigured(env)) throw new HttpError(503, 'Online payments are not configured yet');
    const body = await readJson(request);

    const customerName = requiredText(body.customerName, 'Name', 120);
    const phoneText = phone(body.phone, 'Phone', 10, 15);
    const emailText = email(body.email, 'Email', true) as string;
    const addr = asObject(body.shippingAddress, 'Shipping address');
    const pincode = typeof addr.pincode === 'string' || typeof addr.pincode === 'number' ? String(addr.pincode).trim() : '';
    if (!/^\d{6}$/.test(pincode)) throw badRequest('Pincode must be 6 digits');
    const shippingAddress: ShippingAddress = {
      addressLine: requiredText(addr.addressLine, 'Address', 300),
      city: requiredText(addr.city, 'City', 80),
      state: requiredText(addr.state, 'State', 80),
      pincode,
      country: optionalText(addr.country, 'Country', 60) ?? 'India',
    };
    const shippingMethod =
      body.shippingMethod === undefined || body.shippingMethod === null
        ? 'standard'
        : oneOf(body.shippingMethod, 'Shipping method', ['standard', 'express'] as const);
    const notes = optionalText(body.notes, 'Notes', 1000);

    if (!Array.isArray(body.items) || body.items.length === 0) throw badRequest('Your cart is empty');
    if (body.items.length > 20) throw badRequest('Too many items in one order (max 20)');
    const requested = body.items.map((raw: unknown, i: number) => {
      const item = asObject(raw, `Item ${i + 1}`);
      const variantId = requiredText(item.variantId, `Item ${i + 1}`, 100);
      const qty = integer(item.qty, 'Quantity', 1, 10);
      const keys = item.uploadKeys ?? [];
      if (!Array.isArray(keys) || keys.some((k) => typeof k !== 'string' || !CUSTOMER_KEY_RE.test(k))) {
        throw badRequest('One of your photos is invalid. Please upload it again.');
      }
      return { variantId, qty, uploadKeys: keys as string[] };
    });
    const allKeys = requested.flatMap((r) => r.uploadKeys);
    if (allKeys.length > 200) throw badRequest('Too many photos in one order (max 200)');
    if (new Set(allKeys).size !== allKeys.length) throw badRequest('The same photo is attached more than once');

    const variantIds = [...new Set(requested.map((r) => r.variantId))];
    const { results: variantRows } = await env.DB.prepare(
      `SELECT v.id, v.size, v.finish, v.price_paise, v.stock, v.active AS variant_active,
              p.active AS product_active, p.name AS product_name
       FROM variants v JOIN products p ON p.id = v.product_id
       WHERE v.id IN (${placeholders(variantIds.length)})`
    )
      .bind(...variantIds)
      .all<VariantForOrder>();
    const variants = new Map(variantRows.map((v) => [v.id, v]));
    for (const r of requested) {
      const v = variants.get(r.variantId);
      if (!v || !v.variant_active || !v.product_active) {
        throw badRequest('This item is no longer available', { variantId: r.variantId });
      }
    }
    const qtyByVariant = new Map<string, number>();
    for (const r of requested) qtyByVariant.set(r.variantId, (qtyByVariant.get(r.variantId) ?? 0) + r.qty);
    for (const [id, qty] of qtyByVariant) {
      const v = variants.get(id) as VariantForOrder;
      if (v.stock < qty) {
        const label = `${v.product_name} (${v.size}, ${v.finish})`;
        throw new HttpError(409, v.stock > 0 ? `Only ${v.stock} left of ${label}` : `${label} is out of stock`, {
          variantId: id,
        });
      }
    }

    const abandonedOrderIds = new Set<string>();
    if (allKeys.length) {
      const found = new Set<string>();
      for (const part of chunk(allKeys)) {
        // A photo is free if it isn't in any order yet, or only in an unpaid one the customer abandoned
        // (e.g. they closed the payment window and changed their address).
        const { results } = await env.DB.prepare(
          `SELECT cu.r2_key, cu.order_id FROM customer_uploads cu
           LEFT JOIN orders o ON o.id = cu.order_id
           WHERE cu.deleted_at IS NULL AND cu.r2_key IN (${placeholders(part.length)})
             AND (cu.order_id IS NULL OR o.status = 'pending')`
        )
          .bind(...part)
          .all<{ r2_key: string; order_id: string | null }>();
        results.forEach((r) => {
          found.add(r.r2_key);
          if (r.order_id) abandonedOrderIds.add(r.order_id);
        });
      }
      if (found.size !== allKeys.length) throw badRequest('One of your photos could not be found. Please upload it again.');
    }

    const items: OrderItem[] = requested.map((r) => {
      const v = variants.get(r.variantId) as VariantForOrder;
      const unit = Math.round(v.price_paise);
      return {
        variant_id: v.id,
        product_name: v.product_name,
        size: v.size,
        finish: v.finish,
        unit_price_paise: unit,
        quantity: r.qty,
        total_paise: unit * r.qty,
        upload_keys: r.uploadKeys,
      };
    });
    const subtotal = items.reduce((sum, it) => sum + it.total_paise, 0);
    const rules = await getShippingRules(env);
    const shipping =
      shippingMethod === 'express'
        ? rules.expressDeliveryRatePaise
        : // A threshold of 0 means "no free delivery", matching the shop UI.
          rules.freeShippingThresholdPaise > 0 && subtotal >= rules.freeShippingThresholdPaise
          ? 0
          : rules.baseStandardRatePaise;
    const total = subtotal + shipping;
    if (total < 100) throw badRequest('Order total is too low for online payment');

    // Razorpay first: if it fails nothing has been written, so there is no half-created order.
    const orderId = crypto.randomUUID();
    let orderNo = await unusedOrderNo(env);
    const rzp = await createRazorpayOrder(env, { amount: total, receipt: orderNo, notes: { order_id: orderId } });

    let results: D1Result[] = [];
    for (let attempt = 0; ; attempt++) {
      const insert = env.DB.prepare(
        `INSERT INTO orders (id, order_no, customer_name, phone, email, shipping_address, items, subtotal, shipping, total,
                             status, razorpay_order_id, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
      ).bind(
        orderId,
        orderNo,
        customerName,
        phoneText,
        emailText,
        JSON.stringify(shippingAddress),
        JSON.stringify(items),
        subtotal,
        shipping,
        total,
        rzp.id,
        notes,
        nowIso()
      );
      const attach = chunk(allKeys).map((part) =>
        env.DB.prepare(
          `UPDATE customer_uploads SET order_id = ?
           WHERE deleted_at IS NULL AND r2_key IN (${placeholders(part.length)})
             AND (order_id IS NULL OR order_id IN (SELECT id FROM orders WHERE status = 'pending'))`
        ).bind(orderId, ...part)
      );
      try {
        results = await env.DB.batch([insert, ...attach]);
        break;
      } catch (err) {
        if (attempt < 3 && /UNIQUE constraint failed: orders\.order_no/.test(String(err))) {
          console.warn(`Order number ${orderNo} was taken; Razorpay receipt ${rzp.id} keeps the old number`);
          orderNo = await unusedOrderNo(env);
          continue;
        }
        throw err;
      }
    }

    const attached = results.slice(1).reduce((sum, r) => sum + (r.meta.changes ?? 0), 0);
    if (attached !== allKeys.length) {
      // Another order claimed one of the photos between the check and the insert.
      await env.DB.batch([
        env.DB.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").bind(orderId),
        env.DB.prepare('UPDATE customer_uploads SET order_id = NULL WHERE order_id = ?').bind(orderId),
      ]);
      throw new HttpError(409, 'One of your photos is already part of another order. Please upload it again.');
    }

    if (abandonedOrderIds.size) {
      // Leave the earlier unpaid order as it is, but say where its photos went.
      const ids = [...abandonedOrderIds];
      await env.DB.prepare(
        `UPDATE orders SET notes = TRIM(COALESCE(notes, '') || ' [Photos moved to ' || ? || ' when the customer checked out again]')
         WHERE status = 'pending' AND id IN (${placeholders(ids.length)})`
      )
        .bind(orderNo, ...ids)
        .run();
    }

    return json(
      {
        orderId,
        orderNo,
        subtotal,
        shipping,
        total,
        currency: 'INR',
        items,
        razorpay: { keyId: env.RAZORPAY_KEY_ID, orderId: rzp.id, amount: rzp.amount, currency: rzp.currency },
      },
      201
    );
  });

  router.post('/api/shop/verify-payment', async ({ env, request }) => {
    if (!env.RAZORPAY_KEY_SECRET) throw new HttpError(503, 'Online payments are not configured yet');
    const body = await readJson(request);
    const orderId = requiredText(body.orderId, 'Order', 100);
    const razorpayOrderId = requiredText(body.razorpayOrderId, 'Razorpay order id', 100);
    const razorpayPaymentId = requiredText(body.razorpayPaymentId, 'Razorpay payment id', 100);
    const signature = requiredText(body.razorpaySignature, 'Razorpay signature', 200);

    const expected = await hmacSha256Hex(env.RAZORPAY_KEY_SECRET, `${razorpayOrderId}|${razorpayPaymentId}`);
    if (!(await safeEqual(expected, signature))) throw badRequest('Payment could not be verified');

    const order = await env.DB.prepare('SELECT id, order_no, items, razorpay_order_id FROM orders WHERE id = ?')
      .bind(orderId)
      .first<Pick<OrderRow, 'id' | 'order_no' | 'items' | 'razorpay_order_id'>>();
    if (!order) throw notFound('Order not found');
    if (order.razorpay_order_id !== razorpayOrderId) throw badRequest('Payment does not belong to this order');

    await markPaid(env, order, razorpayPaymentId);
    const current = await env.DB.prepare('SELECT status FROM orders WHERE id = ?').bind(order.id).first<{ status: string }>();
    if (current?.status !== 'paid') {
      console.warn(`Verified payment ${razorpayPaymentId} for order ${order.order_no} in status ${current?.status}`);
    }
    return json({ orderNo: order.order_no, status: current?.status ?? 'pending' });
  });

  router.post('/api/shop/webhook/razorpay', async ({ env, request }) => {
    if (!env.RAZORPAY_WEBHOOK_SECRET) throw new HttpError(503, 'Webhook is not configured');
    const signature = request.headers.get('X-Razorpay-Signature');
    if (!signature) throw badRequest('Missing signature');
    const raw = await request.arrayBuffer();
    if (raw.byteLength > 1024 * 1024) throw new HttpError(413, 'Payload too large');
    const expected = await hmacSha256Hex(env.RAZORPAY_WEBHOOK_SECRET, raw);
    if (!(await safeEqual(expected, signature))) throw badRequest('Invalid signature');

    let event: {
      event?: string;
      payload?: {
        payment?: { entity?: { id?: string; order_id?: string; amount?: number } };
        order?: { entity?: { id?: string } };
      };
    };
    try {
      event = JSON.parse(new TextDecoder().decode(raw));
    } catch {
      throw badRequest('Malformed payload');
    }
    if (event.event !== 'payment.captured' && event.event !== 'order.paid') return json({ ok: true, ignored: true });

    const payment = event.payload?.payment?.entity;
    const razorpayOrderId = payment?.order_id ?? event.payload?.order?.entity?.id;
    if (!razorpayOrderId) return json({ ok: true, ignored: true });

    const order = await env.DB.prepare('SELECT id, order_no, items, total FROM orders WHERE razorpay_order_id = ?')
      .bind(razorpayOrderId)
      .first<Pick<OrderRow, 'id' | 'order_no' | 'items' | 'total'>>();
    if (!order) {
      console.warn(`Webhook ${event.event} for unknown Razorpay order ${razorpayOrderId}`);
      return json({ ok: true, ignored: true });
    }
    if (typeof payment?.amount === 'number' && payment.amount !== order.total) {
      console.error(`Webhook amount ${payment.amount} does not match order ${order.order_no} total ${order.total}`);
      return json({ ok: true, ignored: true });
    }
    await markPaid(env, order, payment?.id ?? null);
    return json({ ok: true });
  });

  router.get('/api/shop/orders/lookup', async ({ env, url, ip }) => {
    const orderNo = (url.searchParams.get('orderNo') || '').trim().toUpperCase();
    const phoneText = (url.searchParams.get('phone') || '').trim();
    if (!orderNo || !phoneText) throw badRequest('Enter your order number and the phone number used for the order');
    await enforce(env, 'order-lookup', ip, 20, 10 * MINUTE, 'Too many lookups. Please try again in a few minutes.');
    if (orderNo.length > 40 || digitsOnly(phoneText).length < 10) throw notFound('Order not found');

    const row = await env.DB.prepare(
      'SELECT order_no, status, tracking_url, total, created_at, shipping_address, items, phone FROM orders WHERE order_no = ?'
    )
      .bind(orderNo)
      .first<Pick<OrderRow, 'order_no' | 'status' | 'tracking_url' | 'total' | 'created_at' | 'shipping_address' | 'items' | 'phone'>>();
    if (!row || !(await safeEqual(last10(row.phone), last10(phoneText)))) throw notFound('Order not found');

    // Deliberately minimal: no customer details, prices per line only, and no photos or upload keys.
    return json({
      order_no: row.order_no,
      status: row.status,
      tracking_url: row.tracking_url,
      total: row.total,
      created_at: isoTime(row.created_at),
      city: parseAddress(row.shipping_address).city,
      items: parseOrderItems(row.items).map((it) => ({
        product_name: it.product_name,
        size: it.size,
        finish: it.finish,
        quantity: it.quantity,
        total_paise: it.total_paise,
      })),
    });
  });
}
