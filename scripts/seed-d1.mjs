// Seeds D1 with the bundled portfolio photos, the starter catalogue and a few settings.
// Non-destructive: rows that already exist are never changed (photos only get empty columns filled),
// so re-running it keeps every admin edit. Note: rows an admin deleted will be added back.
//
//   npm run seed                 local database (.wrangler/state)
//   npm run seed:remote          production database (needs `wrangler login` and a real database_id)
//   node scripts/seed-d1.mjs --persist-to <dir>   any extra flags are passed to `wrangler d1 execute`
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const remote = args.includes('--remote');
const passthrough = args.filter((a) => a !== '--remote');

const manifestPath = path.resolve('public/data/manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('public/data/manifest.json not found. Run `npm run images` first.');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

function sql(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Not a finite number: ${value}`);
    return String(value);
  }
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/'/g, "''")}'`;
}
const row = (values) => values.map(sql).join(', ');
const now = new Date().toISOString();
const statements = [];

// 1. Bundled photos (served as static files from /media). Existing rows only get empty columns filled.
for (const p of manifest) {
  const cols = {
    id: p.id,
    category: p.category,
    title: p.title ?? '',
    subtitle: p.subtitle ?? null,
    caption: p.caption ?? null,
    alt: p.alt ?? '',
    r2_key: p.r2Key,
    thumb_key: p.thumbR2Key,
    orientation: p.width > p.height ? 'landscape' : 'portrait',
    width: p.width,
    height: p.height,
    color: p.dominantColor ?? '#141312',
    lqip: p.lqip ?? '',
    featured: Boolean(p.featured),
    order_num: p.order ?? 0,
    visible: p.visible !== false,
    url: p.url,
    thumb_url: p.thumbnailUrl,
    responsive: p.responsive ? JSON.stringify(p.responsive) : null,
    created_at: now,
  };
  statements.push(
    `INSERT INTO photos (${Object.keys(cols).join(', ')}) VALUES (${row(Object.values(cols))})
ON CONFLICT(id) DO UPDATE SET
  subtitle = COALESCE(photos.subtitle, excluded.subtitle),
  url = COALESCE(photos.url, excluded.url),
  thumb_url = COALESCE(photos.thumb_url, excluded.thumb_url),
  responsive = COALESCE(photos.responsive, excluded.responsive),
  created_at = COALESCE(photos.created_at, excluded.created_at);`
  );
}

// 2. Starter catalogue. Prices are in paise. Descriptions are plain on purpose: edit them in the admin.
const PRODUCTS = [
  {
    id: 'prod-heritage-teak-frame',
    slug: 'heritage-teak-archival-frame',
    name: 'Teak frame',
    description: 'A solid teak frame with a glass front. We print the photograph you choose and frame it in our workshop.',
    category: 'frames',
    images: [
      '/media/products/teak-frame.jpg',
      '/media/weddings/hi-wedding-sacred-gaze/1200.webp',
      '/media/weddings/hi-wedding-mandap-embrace/1200.webp',
    ],
    featured: 1,
    sort_order: 1,
    variants: [
      ['var-teak-12x18-nat', '12x18 in', 'Natural teak', 450000, 'HTF-1218-NAT', 15],
      ['var-teak-16x24-nat', '16x24 in', 'Natural teak', 680000, 'HTF-1624-NAT', 12],
      ['var-teak-20x30-nat', '20x30 in', 'Natural teak', 950000, 'HTF-2030-NAT', 8],
      ['var-teak-12x18-wal', '12x18 in', 'Walnut stain', 480000, 'HTF-1218-WAL', 10],
      ['var-teak-16x24-wal', '16x24 in', 'Walnut stain', 720000, 'HTF-1624-WAL', 14],
      ['var-teak-20x30-wal', '20x30 in', 'Walnut stain', 990000, 'HTF-2030-WAL', 6],
    ],
  },
  {
    id: 'prod-gallery-float-frame',
    slug: 'architectural-gallery-float-frame',
    name: 'Float frame',
    description: 'A deep frame in which the print is mounted slightly forward, leaving a small gap around its edges.',
    category: 'frames',
    images: ['/media/weddings/hi-couple-laughing-lehenga/1200.webp', '/media/candid/hi-candid-golden-bokeh/1200.webp'],
    featured: 1,
    sort_order: 2,
    variants: [
      ['var-float-12x18-ivory', '12x18 in', 'Ivory', 380000, 'GFF-1218-IVY', 20],
      ['var-float-16x24-ivory', '16x24 in', 'Ivory', 560000, 'GFF-1624-IVY', 15],
      ['var-float-20x30-ivory', '20x30 in', 'Ivory', 820000, 'GFF-2030-IVY', 10],
      ['var-float-12x18-obs', '12x18 in', 'Matte black', 380000, 'GFF-1218-OBS', 18],
      ['var-float-16x24-obs', '16x24 in', 'Matte black', 560000, 'GFF-1624-OBS', 12],
    ],
  },
  {
    id: 'prod-heirloom-linen-album',
    slug: 'heirloom-linen-wedding-album',
    name: 'Linen wedding album',
    description: 'A lay-flat wedding album with a linen cover, printed from the photographs you choose.',
    category: 'albums',
    images: [
      '/media/products/heirloom-album.jpg',
      '/media/weddings/hi-wedding-mandap-embrace/1200.webp',
      '/media/weddings/hi-wedding-sacred-gaze/1200.webp',
    ],
    featured: 1,
    sort_order: 3,
    variants: [
      ['var-album-10x10-sand', '10x10 in', 'Sand linen', 1450000, 'HLA-1010-SND', 25],
      ['var-album-12x12-sand', '12x12 in', 'Sand linen', 1950000, 'HLA-1212-SND', 15],
      ['var-album-12x15-sand', '12x15 in', 'Sand linen', 2450000, 'HLA-1215-SND', 10],
      ['var-album-12x12-charcoal', '12x12 in', 'Charcoal', 2100000, 'HLA-1212-CHR', 12],
    ],
  },
  {
    id: 'prod-archival-canvas-shadowbox',
    slug: 'masterpiece-archival-canvas',
    name: 'Canvas print',
    description: 'Your photograph printed on canvas, stretched over a wooden frame and set in a box frame.',
    category: 'canvas',
    images: [
      '/media/products/canvas-shadowbox.jpg',
      '/media/portraits/hi-portrait-emerald-glow/1200.webp',
      '/media/baby/hi-baby-father-forehead-kiss/1200.webp',
    ],
    featured: 1,
    sort_order: 4,
    variants: [
      ['var-canvas-16x24-teak', '16x24 in', 'Teak box frame', 520000, 'MAC-1624-TEAK', 15],
      ['var-canvas-24x36-teak', '24x36 in', 'Teak box frame', 840000, 'MAC-2436-TEAK', 10],
      ['var-canvas-30x40-teak', '30x40 in', 'Teak box frame', 1280000, 'MAC-3040-TEAK', 5],
      ['var-canvas-24x36-ebony', '24x36 in', 'Black box frame', 860000, 'MAC-2436-EBN', 8],
    ],
  },
  {
    id: 'prod-custom-frame-service',
    slug: 'custom-fine-art-framing',
    name: 'Frame your own photo',
    description: 'Upload your own photograph and we print and frame it in the size and finish you choose.',
    category: 'frames',
    images: ['/media/candid/hi-candid-golden-bokeh/1200.webp', '/media/baby/hi-baby-held-high/1200.webp'],
    featured: 1,
    sort_order: 5,
    variants: [
      ['var-custom-8x12', '8x12 in', 'Natural teak', 320000, 'CUS-0812-TEAK', 50],
      ['var-custom-12x18', '12x18 in', 'Natural teak', 440000, 'CUS-1218-TEAK', 40],
      ['var-custom-16x24', '16x24 in', 'Natural teak', 650000, 'CUS-1624-TEAK', 30],
      ['var-custom-20x30', '20x30 in', 'Natural teak', 920000, 'CUS-2030-TEAK', 25],
      ['var-custom-12x18-obs', '12x18 in', 'Matte black', 440000, 'CUS-1218-OBS', 35],
      ['var-custom-16x24-obs', '16x24 in', 'Matte black', 650000, 'CUS-1624-OBS', 30],
    ],
  },
  {
    id: 'prod-fine-art-diary',
    slug: 'fine-art-keepsake-diary',
    name: 'Keepsake diary',
    description: 'A linen-covered diary with your photographs printed on its pages.',
    category: 'diaries',
    images: ['/media/products/fine-diary.jpg'],
    featured: 0,
    sort_order: 6,
    variants: [
      ['var-diary-a5-linen', 'A5 (6x8.5 in)', 'Oatmeal linen', 280000, 'FAD-A5-LIN', 25],
      ['var-diary-desk-linen', '8x10.5 in', 'Oatmeal linen', 380000, 'FAD-DSK-LIN', 18],
      ['var-diary-a5-gold', 'A5 (6x8.5 in)', 'Linen with gold-foil name', 340000, 'FAD-A5-GLD', 20],
    ],
  },
  {
    id: 'prod-mini-pocket-diary',
    slug: 'artisanal-mini-pocket-diary',
    name: 'Pocket diary',
    description: 'A small diary with your photographs printed inside, sized to carry in a bag.',
    category: 'diaries',
    images: ['/media/products/mini-diary.jpg'],
    featured: 0,
    sort_order: 7,
    variants: [
      ['var-mini-pocket-46', '4x6 in', 'Leather and linen', 165000, 'PMD-46-LEA', 40],
      ['var-mini-palm-35', '3.5x5 in', 'Leather and linen', 125000, 'PMD-35-LEA', 35],
    ],
  },
];

for (const p of PRODUCTS) {
  const basePrice = Math.min(...p.variants.map((v) => v[3]));
  // OR IGNORE: skip if the id or slug already exists.
  statements.push(
    `INSERT OR IGNORE INTO products (id, slug, name, description, category, base_price_paise, images, active, featured, sort_order)
VALUES (${row([p.id, p.slug, p.name, p.description, p.category, basePrice, JSON.stringify(p.images), 1, p.featured, p.sort_order])});`
  );
  for (const [id, size, finish, price, sku, stock] of p.variants) {
    statements.push(
      `INSERT OR IGNORE INTO variants (id, product_id, size, finish, price_paise, sku, stock, active)
SELECT ${row([id, p.id, size, finish, price, sku, stock, 1])}
WHERE EXISTS (SELECT 1 FROM products WHERE id = ${sql(p.id)});`
    );
  }
}

// 3. Settings the server also uses (same values as the built-in defaults). Never overwritten.
const SETTINGS = {
  shipping_rules: {
    baseStandardRatePaise: 25000,
    freeShippingThresholdPaise: 499900,
    expressDeliveryRatePaise: 55000,
    estimatedDeliveryDays: '5–7 business days for custom frames',
  },
  shop_config: { codEnabled: false, currency: 'INR', currencySymbol: '₹', lowStockThreshold: 3 },
};
for (const [key, value] of Object.entries(SETTINGS)) {
  statements.push(
    `INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (${row([key, JSON.stringify(value), now])});`
  );
}

// Written outside migrations/ (wrangler would run any .sql there as a migration). .wrangler/ is gitignored.
const outDir = path.resolve('.wrangler');
fs.mkdirSync(outDir, { recursive: true });
const seedPath = path.join(outDir, 'seed.sql');
fs.writeFileSync(seedPath, statements.join('\n') + '\n');
console.log(`Wrote ${statements.length} statements to ${path.relative(process.cwd(), seedPath)}`);

const isWindows = process.platform === 'win32';
const wranglerArgs = ['wrangler', 'd1', 'execute', 'hi-studio-db', remote ? '--remote' : '--local', '--file=.wrangler/seed.sql', '--yes', ...passthrough]
  .map((a) => (/\s/.test(a) ? `"${a}"` : a));
console.log(`Running: npx ${wranglerArgs.join(' ')}`);
// npx is a .cmd on Windows, which needs a shell.
const result = isWindows
  ? spawnSync(`npx ${wranglerArgs.join(' ')}`, { stdio: 'inherit', shell: true })
  : spawnSync('npx', wranglerArgs.map((a) => a.replace(/^"(.*)"$/, '$1')), { stdio: 'inherit' });
if (result.status !== 0) {
  console.error('Seeding failed.');
  process.exit(result.status ?? 1);
}
console.log('Seeding complete.');
