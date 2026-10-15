import type { Router } from '../router';
import {
  INQUIRY_STATUSES,
  ORDER_STATUSES,
  PAID_STATUSES,
  PRODUCT_CATEGORIES,
  type InquiryRow,
  type OrderRow,
} from '../types';
import { HttpError, badRequest, json, notFound, readJson } from '../http';
import { CUSTOMER_KEY_RE } from '../files';
import { toInquiry, toOrder } from '../mappers';
import { loadAdminOrder, loadAllProducts, loadProduct } from '../queries';
import { getLowStockThreshold } from '../settings';
import { markPaid } from '../payments';
import {
  asObject,
  chunk,
  flag,
  integer,
  nowIso,
  oneOf,
  optionalText,
  paise,
  placeholders,
  requiredText,
  slugify,
} from '../validate';

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_TAKEN = 'That URL slug is already used';

function parseProductPayload(raw: unknown) {
  const p = asObject(raw, 'Product');
  const id = requiredText(p.id, 'Product id', 80);
  if (!ID_RE.test(id)) throw badRequest('Product id may only contain letters, numbers, - and _');
  const name = requiredText(p.name, 'Name', 120);
  const slug = optionalText(p.slug, 'URL slug', 80) ?? slugify(name, 80);
  if (!SLUG_RE.test(slug)) throw badRequest('URL slug may only contain lowercase letters, numbers and single hyphens');

  let images: string[] = [];
  if (p.images !== undefined && p.images !== null) {
    if (!Array.isArray(p.images) || p.images.length > 20) throw badRequest('Images must be a list of up to 20 URLs');
    images = p.images.map((u) => {
      if (typeof u !== 'string' || u.length > 500 || !(/^\/[^/]/.test(u) || /^https:\/\//.test(u))) {
        throw badRequest('Each image must be a site path (/...) or an https:// URL');
      }
      return u;
    });
  }

  if (!Array.isArray(p.variants)) throw badRequest('variants must be a list (send [] to remove all variants)');
  if (p.variants.length > 60) throw badRequest('A product can have at most 60 variants');
  const variants = p.variants.map((rawVariant, i) => {
    const v = asObject(rawVariant, `Variant ${i + 1}`);
    const variantId = optionalText(v.id, 'Variant id', 80) ?? `var-${crypto.randomUUID().slice(0, 13)}`;
    if (!ID_RE.test(variantId)) throw badRequest('Variant id may only contain letters, numbers, - and _');
    return {
      id: variantId,
      size: requiredText(v.size, `Variant ${i + 1} size`, 80),
      finish: requiredText(v.finish, `Variant ${i + 1} finish`, 80),
      price_paise: paise(v.price_paise, `Variant ${i + 1} price`),
      sku: optionalText(v.sku, `Variant ${i + 1} SKU`, 60) ?? '',
      stock: integer(v.stock ?? 0, `Variant ${i + 1} stock`, 0, 1_000_000),
      active: flag(v.active, `Variant ${i + 1} active`, true) ? 1 : 0,
    };
  });
  const variantIds = variants.map((v) => v.id);
  if (new Set(variantIds).size !== variantIds.length) throw badRequest('Two variants have the same id');

  return {
    id,
    slug,
    name,
    description: optionalText(p.description, 'Description', 4000) ?? '',
    category: oneOf(p.category, 'Category', PRODUCT_CATEGORIES),
    base_price_paise: paise(p.base_price_paise ?? 0, 'Base price'),
    images,
    active: flag(p.active, 'Active', true) ? 1 : 0,
    featured: flag(p.featured, 'Featured', false) ? 1 : 0,
    sort_order: p.sort_order === undefined || p.sort_order === null ? 0 : integer(p.sort_order, 'Sort order', -1_000_000, 1_000_000),
    variants,
  };
}

export function registerAdminShopRoutes(router: Router) {
  router.get('/api/admin/summary', async ({ env }) => {
    const paid = PAID_STATUSES.map(() => '?').join(', ');
    const threshold = await getLowStockThreshold(env);
    const [counts, lowStock] = await env.DB.batch([
      env.DB.prepare(
        `SELECT
           (SELECT COUNT(*) FROM orders WHERE status IN (${paid})) AS ordersPaid,
           (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status IN (${paid})) AS revenuePaise,
           (SELECT COUNT(*) FROM orders WHERE status = 'pending') AS ordersPending,
           (SELECT COUNT(*) FROM inquiries WHERE status = 'new') AS inquiriesNew,
           (SELECT COUNT(*) FROM photos) AS photos`
      ).bind(...PAID_STATUSES, ...PAID_STATUSES),
      env.DB.prepare(
        `SELECT p.name AS productName, v.size, v.finish, v.stock
         FROM variants v JOIN products p ON p.id = v.product_id
         WHERE v.active = 1 AND p.active = 1 AND v.stock <= ?
         ORDER BY v.stock ASC, p.name ASC LIMIT 100`
      ).bind(threshold),
    ]);
    const c = counts.results[0] as Record<string, number>;
    return json({
      ordersPaid: c.ordersPaid,
      revenuePaise: c.revenuePaise,
      ordersPending: c.ordersPending,
      inquiriesNew: c.inquiriesNew,
      photos: c.photos,
      lowStock: lowStock.results,
    });
  });

  // Products ---------------------------------------------------------------

  router.get('/api/admin/products', async ({ env }) => json(await loadAllProducts(env)));

  router.post('/api/admin/products', async ({ env, request }) => {
    const body = await readJson(request);
    const product = parseProductPayload(body.product);

    const slugOwner = await env.DB.prepare('SELECT id FROM products WHERE slug = ? AND id != ?')
      .bind(product.slug, product.id)
      .first();
    if (slugOwner) throw new HttpError(409, SLUG_TAKEN);
    if (product.variants.length) {
      const ids = product.variants.map((v) => v.id);
      const clash = await env.DB.prepare(
        `SELECT id FROM variants WHERE id IN (${placeholders(ids.length)}) AND product_id != ? LIMIT 1`
      )
        .bind(...ids, product.id)
        .first<{ id: string }>();
      if (clash) throw new HttpError(409, `Variant id ${clash.id} is already used by another product`);
    }

    const keepIds = product.variants.map((v) => v.id);
    const statements = [
      env.DB.prepare(
        `INSERT INTO products (id, slug, name, description, category, base_price_paise, images, active, featured, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           slug = excluded.slug, name = excluded.name, description = excluded.description, category = excluded.category,
           base_price_paise = excluded.base_price_paise, images = excluded.images, active = excluded.active,
           featured = excluded.featured, sort_order = excluded.sort_order`
      ).bind(
        product.id,
        product.slug,
        product.name,
        product.description,
        product.category,
        product.base_price_paise,
        JSON.stringify(product.images),
        product.active,
        product.featured,
        product.sort_order
      ),
      keepIds.length
        ? env.DB.prepare(`DELETE FROM variants WHERE product_id = ? AND id NOT IN (${placeholders(keepIds.length)})`).bind(
            product.id,
            ...keepIds
          )
        : env.DB.prepare('DELETE FROM variants WHERE product_id = ?').bind(product.id),
      ...product.variants.map((v) =>
        env.DB.prepare(
          `INSERT INTO variants (id, product_id, size, finish, price_paise, sku, stock, active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             size = excluded.size, finish = excluded.finish, price_paise = excluded.price_paise, sku = excluded.sku,
             stock = excluded.stock, active = excluded.active
           WHERE variants.product_id = excluded.product_id`
        ).bind(v.id, product.id, v.size, v.finish, v.price_paise, v.sku, v.stock, v.active)
      ),
    ];
    try {
      await env.DB.batch(statements);
    } catch (err) {
      if (/UNIQUE constraint failed: products\.slug/.test(String(err))) throw new HttpError(409, SLUG_TAKEN);
      throw err;
    }
    return json(await loadProduct(env, product.id));
  });

  router.delete('/api/admin/products/:id', async ({ env, params }) => {
    const [, deleted] = await env.DB.batch([
      env.DB.prepare('DELETE FROM variants WHERE product_id = ?').bind(params.id),
      env.DB.prepare('DELETE FROM products WHERE id = ?').bind(params.id),
    ]);
    if (!deleted.meta.changes) throw notFound('Product not found');
    return json({ ok: true });
  });

  // Orders -------------------------------------------------------------------

  router.get('/api/admin/orders', async ({ env }) => {
    const [orders, uploads] = await env.DB.batch([
      env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200'),
      env.DB.prepare(
        `SELECT order_id, r2_key FROM customer_uploads
         WHERE deleted_at IS NULL AND order_id IN (SELECT id FROM orders ORDER BY created_at DESC LIMIT 200)`
      ),
    ]);
    const live = new Map<string, Set<string>>();
    for (const u of uploads.results as { order_id: string; r2_key: string }[]) {
      const set = live.get(u.order_id) ?? new Set<string>();
      set.add(u.r2_key);
      live.set(u.order_id, set);
    }
    return json((orders.results as OrderRow[]).map((o) => toOrder(o, live.get(o.id) ?? new Set())));
  });

  router.patch('/api/admin/orders/:id', async ({ env, request, params }) => {
    const body = await readJson(request);
    const status = body.status === undefined ? undefined : oneOf(body.status, 'Status', ORDER_STATUSES);
    let trackingUrl: string | null | undefined;
    if ('trackingUrl' in body) {
      if (body.trackingUrl === null || body.trackingUrl === '') trackingUrl = null;
      else {
        trackingUrl = requiredText(body.trackingUrl, 'Tracking URL', 500);
        let parsed: URL | null = null;
        try {
          parsed = new URL(trackingUrl);
        } catch {
          /* handled below */
        }
        if (!parsed || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) {
          throw badRequest('Tracking URL must start with https://');
        }
      }
    }
    if (status === undefined && trackingUrl === undefined) throw badRequest('Nothing to update');

    const order = await env.DB.prepare('SELECT id, status, items FROM orders WHERE id = ?')
      .bind(params.id)
      .first<Pick<OrderRow, 'id' | 'status' | 'items'>>();
    if (!order) throw notFound('Order not found');

    const sets: string[] = [];
    const values: unknown[] = [];
    if (status === 'paid' && order.status === 'pending') {
      // Same path as a confirmed payment, so stock is decremented exactly once.
      await markPaid(env, order, null);
    } else if (status !== undefined && status !== order.status) {
      sets.push('status = ?');
      values.push(status);
      if (status === 'paid') {
        sets.push('paid_at = COALESCE(paid_at, ?)');
        values.push(nowIso());
      }
    }
    if (trackingUrl !== undefined) {
      sets.push('tracking_url = ?');
      values.push(trackingUrl);
    }
    if (sets.length) {
      await env.DB.prepare(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`)
        .bind(...values, order.id)
        .run();
    }
    return json(await loadAdminOrder(env, order.id));
  });

  router.get('/api/admin/customer-uploads/*key', async ({ env, params }) => {
    const key = params.key;
    if (!CUSTOMER_KEY_RE.test(key)) throw notFound('File not found');
    const row = await env.DB.prepare('SELECT original_name FROM customer_uploads WHERE r2_key = ? AND deleted_at IS NULL')
      .bind(key)
      .first<{ original_name: string | null }>();
    if (!row) throw notFound('File not found');
    const object = await env.UPLOADS.get(key);
    if (!object) throw notFound('File not found');

    const fallbackName = key.split('/').pop() as string;
    const name = row.original_name || fallbackName;
    const asciiName = name.replace(/[^A-Za-z0-9._ -]/g, '_').trim() || fallbackName;
    const encodedName = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
    headers.set('Content-Length', String(object.size));
    headers.set('Cache-Control', 'private, no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(object.body, { headers });
  });

  router.delete('/api/admin/orders/:id/uploads', async ({ env, params }) => {
    const order = await env.DB.prepare('SELECT id FROM orders WHERE id = ?').bind(params.id).first();
    if (!order) throw notFound('Order not found');
    // Keys come only from our own records for this order, and only the private uploads bucket is touched.
    const { results } = await env.DB.prepare(
      'SELECT r2_key FROM customer_uploads WHERE order_id = ? AND deleted_at IS NULL'
    )
      .bind(params.id)
      .all<{ r2_key: string }>();
    const keys = results.map((r) => r.r2_key).filter((k) => CUSTOMER_KEY_RE.test(k));
    if (keys.length !== results.length) console.error(`Order ${params.id} has upload records with unexpected keys; skipped`);
    if (!keys.length) return json({ deleted: 0 });

    for (const part of chunk(keys, 1000)) await env.UPLOADS.delete(part);
    const now = nowIso();
    await env.DB.batch(
      chunk(keys).map((part) =>
        env.DB.prepare(
          `UPDATE customer_uploads SET deleted_at = ? WHERE order_id = ? AND r2_key IN (${placeholders(part.length)})`
        ).bind(now, params.id, ...part)
      )
    );
    return json({ deleted: keys.length });
  });

  // Inquiries ------------------------------------------------------------------

  router.get('/api/admin/inquiries', async ({ env }) => {
    const { results } = await env.DB.prepare('SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 500').all<InquiryRow>();
    return json(results.map(toInquiry));
  });

  router.patch('/api/admin/inquiries/:id', async ({ env, request, params }) => {
    const body = await readJson(request);
    const status = oneOf(body.status, 'Status', INQUIRY_STATUSES);
    const result = await env.DB.prepare('UPDATE inquiries SET status = ? WHERE id = ?').bind(status, params.id).run();
    if (!result.meta.changes) throw notFound('Enquiry not found');
    const row = await env.DB.prepare('SELECT * FROM inquiries WHERE id = ?').bind(params.id).first<InquiryRow>();
    if (!row) throw notFound('Enquiry not found');
    return json(toInquiry(row));
  });

  router.delete('/api/admin/inquiries/:id', async ({ env, params }) => {
    const result = await env.DB.prepare('DELETE FROM inquiries WHERE id = ?').bind(params.id).run();
    if (!result.meta.changes) throw notFound('Enquiry not found');
    return json({ ok: true });
  });
}
