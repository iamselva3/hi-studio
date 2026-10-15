import type { Router } from '../router';
import { PHOTO_CATEGORIES, type Env, type PhotoRow } from '../types';
import { HttpError, badRequest, fileField, json, notFound, readForm, readJson } from '../http';
import { IMAGE_EXT, readImage } from '../files';
import { toPhoto } from '../mappers';
import { loadPhoto } from '../queries';
import { ARRAY_SETTINGS, SETTINGS_KEYS, isSettingsKey } from '../settings';
import { randomChars } from '../crypto';
import { asObject, flag, integer, nowIso, oneOf, optionalText, requiredText, slugify } from '../validate';

const MB = 1024 * 1024;
const MAX_SETTING_BYTES = 100 * 1024;
const PHOTO_WIDTHS = [
  { field: 'w480', width: 480, required: true },
  { field: 'w1200', width: 1200, required: true },
  { field: 'w2000', width: 2000, required: false },
] as const;

const mediaUrl = (key: string) => `/api/media/${key}`;

async function deleteMediaPrefix(env: Env, prefix: string): Promise<void> {
  if (!/^photos\/[a-z0-9-]+\/$/.test(prefix)) throw new Error(`Refusing to delete unexpected media prefix ${prefix}`);
  let cursor: string | undefined;
  do {
    const listed = await env.MEDIA.list({ prefix, cursor });
    const keys = listed.objects.map((o) => o.key);
    if (keys.length) await env.MEDIA.delete(keys);
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}

export function registerAdminContentRoutes(router: Router) {
  router.post('/api/admin/settings', async ({ env, request }) => {
    const body = await readJson(request);
    if (!isSettingsKey(body.key)) throw badRequest(`Setting key must be one of: ${SETTINGS_KEYS.join(', ')}`);
    const key = body.key;
    const value = body.value;
    const isArray = Array.isArray(value);
    const isObject = !!value && typeof value === 'object' && !isArray;
    if (ARRAY_SETTINGS.includes(key) ? !isArray : !isObject) {
      throw badRequest(`${key} must be ${ARRAY_SETTINGS.includes(key) ? 'a list' : 'an object'}`);
    }
    const serialized = JSON.stringify(value);
    if (new TextEncoder().encode(serialized).byteLength > MAX_SETTING_BYTES) {
      throw new HttpError(413, 'This setting is too large (max 100 KB)');
    }
    await env.DB.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
      .bind(key, serialized, nowIso())
      .run();
    return json({ ok: true, key, value });
  });

  router.get('/api/admin/photos', async ({ env }) => {
    const { results } = await env.DB.prepare('SELECT * FROM photos ORDER BY order_num ASC, id ASC').all<PhotoRow>();
    return json(results.map(toPhoto));
  });

  router.post('/api/admin/photos', async ({ env, request }) => {
    const form = await readForm(request, 40 * MB);
    const metaText = form.get('meta');
    if (typeof metaText !== 'string') throw badRequest('Photo details (meta) are missing');
    let metaRaw: unknown;
    try {
      metaRaw = JSON.parse(metaText);
    } catch {
      throw badRequest('Photo details (meta) must be valid JSON');
    }
    const meta = asObject(metaRaw, 'Photo details');
    const title = requiredText(meta.title, 'Title', 120);
    const subtitle = optionalText(meta.subtitle, 'Subtitle', 200);
    const caption = optionalText(meta.caption, 'Caption', 1000);
    const alt = requiredText(meta.alt, 'Alt text', 300);
    const category = oneOf(meta.category, 'Category', PHOTO_CATEGORIES);
    const featured = flag(meta.featured, 'Featured', false);
    const visible = flag(meta.visible, 'Visible', true);
    const width = integer(meta.width, 'Width', 1, 20000);
    const height = integer(meta.height, 'Height', 1, 20000);
    const dominantColor = optionalText(meta.dominantColor, 'Dominant colour', 7) ?? '#141312';
    if (!/^#[0-9a-fA-F]{6}$/.test(dominantColor)) throw badRequest('Dominant colour must look like #1a2b3c');
    const lqip = optionalText(meta.lqip, 'Placeholder image', 20000);
    if (lqip && !/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(lqip)) {
      throw badRequest('Placeholder image must be a base64 data URL');
    }

    const files: { width: number; bytes: ArrayBuffer }[] = [];
    for (const spec of PHOTO_WIDTHS) {
      const file = fileField(form, spec.field);
      if (!file) {
        if (spec.required) throw badRequest(`The ${spec.width}px image (${spec.field}) is required`);
        continue;
      }
      const { bytes } = await readImage(file, ['image/webp'], 15 * MB, `The ${spec.width}px image`);
      files.push({ width: spec.width, bytes });
    }

    const base = slugify(title) || 'photo';
    let id = '';
    for (let i = 0; i < 5 && !id; i++) {
      const candidate = `${base}-${randomChars(4, 'abcdefghijklmnopqrstuvwxyz0123456789')}`;
      const taken = await env.DB.prepare('SELECT 1 FROM photos WHERE id = ?').bind(candidate).first();
      if (!taken) id = candidate;
    }
    if (!id) throw new Error('Could not find an unused photo id');

    const prefix = `photos/${id}/`;
    const webp: Record<number, string> = {};
    try {
      for (const f of files) {
        const key = `${prefix}${f.width}.webp`;
        await env.MEDIA.put(key, f.bytes, {
          httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
        });
        webp[f.width] = mediaUrl(key);
      }
      await env.DB.prepare(
        `INSERT INTO photos (id, category, title, subtitle, caption, alt, r2_key, thumb_key, orientation, width, height,
                             color, lqip, featured, order_num, visible, url, thumb_url, responsive, r2_prefix, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(order_num), 0) + 1 FROM photos), ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          id,
          category,
          title,
          subtitle,
          caption,
          alt,
          `${prefix}1200.webp`,
          `${prefix}480.webp`,
          width > height ? 'landscape' : 'portrait',
          width,
          height,
          dominantColor,
          lqip ?? '',
          featured ? 1 : 0,
          visible ? 1 : 0,
          mediaUrl(`${prefix}1200.webp`),
          mediaUrl(`${prefix}480.webp`),
          JSON.stringify({ webp, avif: {} }),
          prefix,
          nowIso()
        )
        .run();
    } catch (err) {
      await deleteMediaPrefix(env, prefix).catch((e) => console.error('Failed to clean up photo files', prefix, e));
      throw err;
    }
    return json(await loadPhoto(env, id), 201);
  });

  router.post('/api/admin/photos/reorder', async ({ env, request }) => {
    const body = await readJson(request);
    const ids = body.ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 5000 || ids.some((id) => typeof id !== 'string')) {
      throw badRequest('ids must be a list of photo ids');
    }
    if (new Set(ids).size !== ids.length) throw badRequest('ids contains duplicates');
    const { results } = await env.DB.prepare('SELECT id FROM photos').all<{ id: string }>();
    const known = new Set(results.map((r) => r.id));
    const unknown = (ids as string[]).find((id) => !known.has(id));
    if (unknown) throw badRequest(`Unknown photo id: ${unknown}`);
    await env.DB.batch(
      (ids as string[]).map((id, index) => env.DB.prepare('UPDATE photos SET order_num = ? WHERE id = ?').bind(index, id))
    );
    return json({ ok: true });
  });

  router.patch('/api/admin/photos/:id', async ({ env, request, params }) => {
    const body = await readJson(request);
    const sets: string[] = [];
    const values: unknown[] = [];
    const set = (column: string, value: unknown) => {
      sets.push(`${column} = ?`);
      values.push(value);
    };
    if (body.title !== undefined) set('title', requiredText(body.title, 'Title', 120));
    // A cleared subtitle is stored as '' (not NULL) so `npm run seed` never refills it from the manifest.
    if (body.subtitle !== undefined) set('subtitle', optionalText(body.subtitle, 'Subtitle', 200) ?? '');
    if (body.caption !== undefined) set('caption', optionalText(body.caption, 'Caption', 1000));
    if (body.alt !== undefined) set('alt', requiredText(body.alt, 'Alt text', 300));
    if (body.category !== undefined) set('category', oneOf(body.category, 'Category', PHOTO_CATEGORIES));
    if (body.featured !== undefined) set('featured', flag(body.featured, 'Featured', false) ? 1 : 0);
    if (body.visible !== undefined) set('visible', flag(body.visible, 'Visible', true) ? 1 : 0);
    if (body.order !== undefined) set('order_num', integer(body.order, 'Order', 0, 1_000_000));
    if (!sets.length) throw badRequest('Nothing to update');

    const result = await env.DB.prepare(`UPDATE photos SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...values, params.id)
      .run();
    if (!result.meta.changes) throw notFound('Photo not found');
    return json(await loadPhoto(env, params.id));
  });

  router.delete('/api/admin/photos/:id', async ({ env, params }) => {
    const row = await env.DB.prepare('SELECT r2_prefix FROM photos WHERE id = ?')
      .bind(params.id)
      .first<{ r2_prefix: string | null }>();
    if (!row) throw notFound('Photo not found');
    // Files first: if that fails the row stays and the delete can be retried.
    if (row.r2_prefix) await deleteMediaPrefix(env, row.r2_prefix);
    await env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(params.id).run();
    return json({ ok: true });
  });

  router.post('/api/admin/uploads', async ({ env, request }) => {
    const form = await readForm(request, 11 * MB);
    const file = fileField(form, 'file');
    if (!file) throw badRequest('Choose an image to upload');
    const { bytes, type } = await readImage(file, ['image/webp', 'image/jpeg', 'image/png'], 10 * MB, 'Image');
    const key = `products/${crypto.randomUUID()}.${IMAGE_EXT[type]}`;
    await env.MEDIA.put(key, bytes, {
      httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' },
    });
    return json({ url: mediaUrl(key) }, 201);
  });
}
