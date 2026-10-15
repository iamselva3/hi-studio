import type { Router } from '../router';
import type { PhotoRow, ProductRow, VariantRow } from '../types';
import { json, notFound, readJson } from '../http';
import { toPhoto } from '../mappers';
import { parseSettingsRows } from '../settings';
import { productStatements, publicProducts } from '../queries';
import { enforce } from '../rate-limit';
import { email, nowIso, optionalText, phone, requiredText } from '../validate';

const MEDIA_KEY_RE = /^(photos|products)\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

export function registerPublicRoutes(router: Router) {
  router.get('/api/site', async ({ env }) => {
    const [settings, photos, products, variants] = await env.DB.batch([
      env.DB.prepare('SELECT key, value FROM settings'),
      env.DB.prepare('SELECT * FROM photos WHERE visible = 1 ORDER BY order_num ASC, id ASC'),
      ...productStatements(env, false),
    ]);
    return json(
      {
        settings: parseSettingsRows(settings.results as { key: string; value: string }[]),
        photos: (photos.results as PhotoRow[]).map(toPhoto),
        products: publicProducts(products.results as ProductRow[], variants.results as VariantRow[]),
      },
      200,
      { 'Cache-Control': 'no-cache' }
    );
  });

  router.get('/api/products', async ({ env }) => {
    const [products, variants] = await env.DB.batch(productStatements(env, false));
    return json(publicProducts(products.results as ProductRow[], variants.results as VariantRow[]), 200, {
      'Cache-Control': 'no-cache',
    });
  });

  router.get('/api/media/*key', async ({ env, params, request }) => {
    const key = params.key;
    if (!MEDIA_KEY_RE.test(key) || key.split('/').some((s) => s === '.' || s === '..')) throw notFound();
    const object = await env.MEDIA.get(key, { onlyIf: request.headers });
    if (!object) throw notFound();
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/octet-stream');
    headers.set('ETag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('X-Content-Type-Options', 'nosniff');
    if (!('body' in object)) return new Response(null, { status: 304, headers });
    headers.set('Content-Length', String(object.size));
    return new Response(object.body, { headers });
  });

  router.post('/api/inquiries', async ({ env, request, ip }) => {
    const body = await readJson(request);
    const name = requiredText(body.name, 'Name', 120);
    const phoneText = phone(body.phone, 'Phone', 7, 15);
    const emailText = email(body.email, 'Email', false);
    const shootType = optionalText(body.shootType, 'Shoot type', 80) ?? '';
    const eventDate = optionalText(body.eventDate, 'Event date', 40);
    const location = optionalText(body.location, 'Location', 200);
    const message = optionalText(body.message, 'Message', 4000);
    await enforce(env, 'inquiry', ip, 5, 10 * 60 * 1000, 'Too many enquiries from your connection. Please try again in a few minutes.');

    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO inquiries (id, name, phone, email, shoot_type, event_date, location, message, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`
    )
      .bind(id, name, phoneText, emailText, shootType, eventDate, location, message, nowIso())
      .run();
    return json({ id }, 201);
  });
}
