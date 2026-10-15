-- Migration 0002: columns, tables and indexes used by API v2.
-- ALTER TABLE ADD COLUMN cannot use CURRENT_TIMESTAMP defaults, so timestamps are written by the API (ISO 8601, UTC).

-- Photos -------------------------------------------------------------------
ALTER TABLE photos ADD COLUMN subtitle TEXT;
ALTER TABLE photos ADD COLUMN url TEXT;
ALTER TABLE photos ADD COLUMN thumb_url TEXT;
ALTER TABLE photos ADD COLUMN responsive TEXT;   -- JSON: {"avif":{"480":url,...},"webp":{...}}
ALTER TABLE photos ADD COLUMN r2_prefix TEXT;    -- "photos/<id>/" for admin uploads; NULL for bundled /media photos
ALTER TABLE photos ADD COLUMN created_at TEXT;

-- Bundled photos follow the manifest layout <category>/<id>/<width>.<ext>; r2_key is "<category>/<id>/1200.avif".
UPDATE photos
SET
  url = '/media/' || substr(r2_key, 1, length(r2_key) - 9) || '1200.webp',
  thumb_url = '/media/' || substr(r2_key, 1, length(r2_key) - 9) || '480.webp',
  responsive = json_object(
    'avif', json_object(
      '480',  '/media/' || substr(r2_key, 1, length(r2_key) - 9) || '480.avif',
      '800',  '/media/' || substr(r2_key, 1, length(r2_key) - 9) || '800.avif',
      '1200', '/media/' || substr(r2_key, 1, length(r2_key) - 9) || '1200.avif',
      '1800', '/media/' || substr(r2_key, 1, length(r2_key) - 9) || '1800.avif',
      '2400', '/media/' || substr(r2_key, 1, length(r2_key) - 9) || '2400.avif'
    ),
    'webp', json_object(
      '480',  '/media/' || substr(r2_key, 1, length(r2_key) - 9) || '480.webp',
      '800',  '/media/' || substr(r2_key, 1, length(r2_key) - 9) || '800.webp',
      '1200', '/media/' || substr(r2_key, 1, length(r2_key) - 9) || '1200.webp',
      '1800', '/media/' || substr(r2_key, 1, length(r2_key) - 9) || '1800.webp',
      '2400', '/media/' || substr(r2_key, 1, length(r2_key) - 9) || '2400.webp'
    )
  )
WHERE url IS NULL AND r2_key LIKE '%/1200.avif';

UPDATE photos SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE created_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_photos_order ON photos(order_num);

-- Customer uploads (private bucket HI_UPLOADS) -------------------------------
ALTER TABLE customer_uploads ADD COLUMN mime TEXT;
ALTER TABLE customer_uploads ADD COLUMN size INTEGER;
ALTER TABLE customer_uploads ADD COLUMN original_name TEXT;
ALTER TABLE customer_uploads ADD COLUMN deleted_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_uploads_key ON customer_uploads(r2_key);
CREATE INDEX IF NOT EXISTS idx_customer_uploads_order ON customer_uploads(order_id);

-- Orders ---------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN paid_at TEXT;
-- Random id of the payment confirmation that moved the order from pending to paid.
-- Stock is decremented only by that confirmation, so replays never decrement twice.
ALTER TABLE orders ADD COLUMN stock_txn TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_razorpay_order ON orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Settings -------------------------------------------------------------------
ALTER TABLE settings ADD COLUMN updated_at TEXT;

-- Catalogue / inquiries --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);
CREATE INDEX IF NOT EXISTS idx_products_sort ON products(sort_order);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at);

-- Store all existing timestamps as ISO 8601 UTC so they sort and parse consistently.
UPDATE orders SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
WHERE created_at IS NOT NULL AND created_at NOT LIKE '%T%';
UPDATE inquiries SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
WHERE created_at IS NOT NULL AND created_at NOT LIKE '%T%';
UPDATE customer_uploads SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
WHERE created_at IS NOT NULL AND created_at NOT LIKE '%T%';

-- Rate limiting ----------------------------------------------------------------
-- One row per (bucket, ip). window_start is the ms epoch of the first hit in the current window.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT NOT NULL,
  ip TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, ip)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
