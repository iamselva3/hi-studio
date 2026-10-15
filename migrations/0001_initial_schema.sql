-- Studio Schema Migration 0001

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  base_price_paise INTEGER NOT NULL,
  images TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  finish TEXT NOT NULL,
  price_paise INTEGER NOT NULL,
  sku TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 10,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_no TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  items TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  shipping INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  tracking_url TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_uploads (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  r2_key TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  caption TEXT,
  alt TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  thumb_key TEXT NOT NULL,
  orientation TEXT NOT NULL DEFAULT 'portrait',
  width INTEGER NOT NULL DEFAULT 1200,
  height INTEGER NOT NULL DEFAULT 1600,
  color TEXT NOT NULL DEFAULT '#141312',
  lqip TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  order_num INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  shoot_type TEXT NOT NULL,
  event_date TEXT,
  location TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
