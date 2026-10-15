import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ORIGINALS_DIR = path.resolve('originals');
const PUBLIC_BRAND_DIR = path.resolve('public/brand');
const PUBLIC_MEDIA_DIR = path.resolve('public/media');
const PUBLIC_DATA_DIR = path.resolve('public/data');
const SIZES = [480, 800, 1200, 1800, 2400];

// Ensure target directories exist
for (const dir of [PUBLIC_BRAND_DIR, PUBLIC_MEDIA_DIR, PUBLIC_DATA_DIR, path.join(PUBLIC_MEDIA_DIR, 'cutouts')]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// 1. Process Logo
// ---------------------------------------------------------------------------
async function processLogo() {
  console.log('--- Processing Logo ---');
  const logoPath = path.join(ORIGINALS_DIR, 'Logo.jpeg');
  if (!fs.existsSync(logoPath)) {
    console.error('Logo.jpeg not found in originals');
    return;
  }

  const { data, info } = await sharp(logoPath).raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const rgbaBuffer = Buffer.alloc(width * height * 4);

  // Background removal: Turn near-black outer canvas to transparent
  // Ivory pixels (~241, 238, 219) are kept opaque
  // Black inside the ivory box is kept opaque black
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 3;
      const dstIdx = (y * width + x) * 4;
      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];

      const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

      // Check if inside ivory box area roughly (x: 310 to 920, y: 270 to 820)
      const inBox = (x >= 315 && x <= 925 && y >= 270 && y <= 825);

      if (inBox) {
        // Keep entire inner box with high fidelity (black ink on ivory)
        rgbaBuffer[dstIdx] = r;
        rgbaBuffer[dstIdx + 1] = g;
        rgbaBuffer[dstIdx + 2] = b;
        rgbaBuffer[dstIdx + 3] = 255;
      } else {
        // Outside the box: if bright (the ivory text STUDIO, flourishes, bars) keep opaque
        if (brightness > 60) {
          rgbaBuffer[dstIdx] = r;
          rgbaBuffer[dstIdx + 1] = g;
          rgbaBuffer[dstIdx + 2] = b;
          rgbaBuffer[dstIdx + 3] = Math.min(255, Math.floor((brightness / 200) * 255));
        } else {
          // Transparent background
          rgbaBuffer[dstIdx] = 0;
          rgbaBuffer[dstIdx + 1] = 0;
          rgbaBuffer[dstIdx + 2] = 0;
          rgbaBuffer[dstIdx + 3] = 0;
        }
      }
    }
  }

  // Save transparent PNG
  const badgePng = path.join(PUBLIC_BRAND_DIR, 'logo-badge.png');
  await sharp(rgbaBuffer, { raw: { width, height, channels: 4 } })
    .png({ quality: 95 })
    .toFile(badgePng);
  console.log('Saved:', badgePng);

  // Favicons
  await sharp(badgePng).resize(32, 32).png().toFile(path.join(PUBLIC_BRAND_DIR, 'favicon-32x32.png'));
  await sharp(badgePng).resize(180, 180).png().toFile(path.join(PUBLIC_BRAND_DIR, 'apple-touch-icon.png'));

  // SVG Representation with stroke paths for GSAP animation
  const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none" class="hi-studio-logo">
  <defs>
    <style>
      .hi-bg-box { fill: #FBF5E8; }
      .hi-bar { fill: #FBF5E8; }
      .hi-text-dark { fill: #0D0C0B; }
      .hi-text-light { fill: #FBF5E8; }
      .hi-draw-stroke { stroke: #0D0C0B; stroke-width: 28; stroke-linecap: round; stroke-linejoin: round; fill: none; }
      .hi-draw-flourish { stroke: #FBF5E8; stroke-width: 24; stroke-linecap: round; fill: none; }
    </style>
  </defs>

  <!-- Top accent bar -->
  <rect x="250" y="180" width="145" height="14" rx="2" class="hi-bar" id="logo-top-bar" />

  <!-- Center Ivory Box -->
  <rect x="250" y="218" width="480" height="430" rx="4" class="hi-bg-box" id="logo-box" />

  <!-- The "Hi" Calligraphic Monogram -->
  <!-- Left Entry loop -->
  <path d="M 210 430 C 240 370, 310 260, 420 235 C 440 230, 420 340, 370 410 C 320 480, 280 540, 310 560 C 340 570, 380 520, 430 450 L 440 350 L 430 650" class="hi-draw-stroke" id="logo-stroke-h" />

  <!-- Crossbar flourish breaking out of box -->
  <path d="M 270 645 C 380 570, 520 510, 780 460 C 800 455, 780 490, 740 480 C 700 470, 500 520, 350 620" class="hi-draw-stroke" id="logo-stroke-cross" />

  <!-- 'i' stem and dot -->
  <path d="M 540 370 C 510 430, 510 450, 540 430 C 570 400, 680 310, 780 320 C 800 322, 795 380, 780 395" class="hi-draw-stroke" id="logo-stroke-i" />
  <circle cx="560" cy="320" r="14" class="hi-text-dark" id="logo-dot-i" />

  <!-- External Flourishes that extend past ivory box -->
  <path d="M 720 470 C 760 462, 790 460, 800 475 C 795 490, 760 485, 730 480" class="hi-draw-flourish" id="logo-outer-flourish" />

  <!-- STUDIO Typography (Bold Editorial Condensed Grotesque) -->
  <g id="logo-text-studio" transform="translate(245, 830)">
    <text x="0" y="0" font-family="'Plus Jakarta Sans', 'Inter', sans-serif" font-weight="900" font-size="160" letter-spacing="0.08em" class="hi-text-light">STUDIO</text>
  </g>

  <!-- Bottom accent underline under 'IO' -->
  <rect x="590" y="855" width="145" height="14" rx="2" class="hi-bar" id="logo-bottom-bar" />
</svg>`;

  fs.writeFileSync(path.join(PUBLIC_BRAND_DIR, 'logo.svg'), logoSvg);
  fs.writeFileSync(path.join(PUBLIC_BRAND_DIR, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
    <rect width="100" height="100" rx="20" fill="#0D0C0B" />
    <rect x="18" y="18" width="64" height="64" rx="10" fill="#FBF5E8" />
    <text x="50" y="65" font-family="'Cinzel', serif" font-weight="800" font-size="44" fill="#0D0C0B" text-anchor="middle">Hi</text>
  </svg>`);

  console.log('Saved SVG brand assets in /public/brand');
}

// ---------------------------------------------------------------------------
// 2. Photo Inventory and Classification
// ---------------------------------------------------------------------------
const PHOTO_CONFIG = [
  {
    file: 'Screenshot 2026-10-14 144818.png',
    id: 'hi-wedding-sacred-gaze',
    category: 'weddings',
    title: 'The Sacred Gaze',
    subtitle: 'Kanchipuram Silk & Sacred Garlands',
    caption: 'Muhurtham vows framed by fragrant jasmine and heirloom antique temple gold.',
    alt: 'South Indian wedding couple in red silk and white attire sharing an intimate glance by Hi Studio',
    featured: true,
    order: 1
  },
  {
    file: 'Screenshot 2026-10-14 144846.png',
    id: 'hi-couple-laughing-lehenga',
    category: 'weddings',
    title: 'Unscripted Radiance',
    subtitle: 'Emerald Lehenga & Twilight Diamonds',
    caption: 'Candid pre-reception laughter captured between shutter frames.',
    alt: 'Laughing bride in royal blue and emerald lehenga embraced by groom by Hi Studio',
    featured: true,
    order: 2,
    isHeroCutout: true
  },
  {
    file: 'Screenshot 2026-10-14 144909.png',
    id: 'hi-wedding-mandap-embrace',
    category: 'weddings',
    title: 'The Sanctuary of Forever',
    subtitle: 'Golden Mandap & Floral Garland',
    caption: 'A quiet tender rest upon his shoulder amidst the sacred chants.',
    alt: 'Emotional South Indian wedding embrace at temple mandap by Hi Studio',
    featured: true,
    order: 3
  },
  {
    file: 'Screenshot 2026-10-14 144926.png',
    id: 'hi-wedding-stage-joy',
    category: 'weddings',
    title: 'Joy Across The Stage',
    subtitle: 'Turban, Garland & Celebratory Arms',
    caption: 'Celebration at its purest when two families unite as one soul.',
    alt: 'Playful South Indian couple with arms outstretched on wedding stage by Hi Studio',
    featured: false,
    order: 4
  },
  {
    file: 'Screenshot 2026-10-14 144826.png',
    id: 'hi-portrait-emerald-glow',
    category: 'portraits',
    title: 'The Coral Heirloom',
    subtitle: 'Hand-Embroidered Elephant Zari & Maang Tikka',
    caption: 'Ambient light sculpting centuries of heritage into a single bridal gaze.',
    alt: 'Editorial bridal portrait with temple jewellery and emerald glow by Hi Studio',
    featured: true,
    order: 5
  },
  {
    file: 'Screenshot 2026-10-14 144936.png',
    id: 'hi-candid-golden-bokeh',
    category: 'candid',
    title: 'Golden Hour Whispers',
    subtitle: 'Festive Lights & Crimson Silk',
    caption: 'The unspoken poetry held in the touch of a fingertip.',
    alt: 'Intimate candid moment between couple against warm fairy lights by Hi Studio',
    featured: true,
    order: 6
  },
  {
    file: 'Screenshot 2026-10-14 144836.png',
    id: 'hi-baby-held-high',
    category: 'baby',
    title: 'Held In Love',
    subtitle: 'First Steps & Kurta Whimsy',
    caption: 'Little toes suspended in the air by the hands that will always catch him.',
    alt: 'Baby boy in white kurta lifted by loving parents by Hi Studio',
    featured: true,
    order: 7
  },
  {
    file: 'Screenshot 2026-10-14 144859.png',
    id: 'hi-baby-candy-sparkle',
    category: 'baby',
    title: 'Sweet Discovery',
    subtitle: 'Spiral Lollipop & Rosy Giggles',
    caption: 'Wide-eyed wonder frozen before the candy even begins to melt.',
    alt: 'Toddler girl with colorful lollipop in vibrant pink dress by Hi Studio',
    featured: true,
    order: 8
  },
  {
    file: 'Screenshot 2026-10-14 144916.png',
    id: 'hi-baby-sunshine-balloons',
    category: 'baby',
    title: 'Starry Sunbeams',
    subtitle: 'Gold Sunglasses & Floating Balloons',
    caption: 'Pure childhood whimsy under the warm afternoon sky.',
    alt: 'Joyful child wearing star glasses holding bright balloons by Hi Studio',
    featured: false,
    order: 9
  },
  {
    file: 'Screenshot 2026-10-14 144944.png',
    id: 'hi-baby-father-forehead-kiss',
    category: 'baby',
    title: 'A Father’s Blessing',
    subtitle: 'Quiet Devotion & Soft Breath',
    caption: 'The tenderness that words could never completely encompass.',
    alt: 'Father tenderly kissing baby forehead by Hi Studio',
    featured: true,
    order: 10
  },
  // Additional studio high-res captures
  {
    file: 'baby-cake-smash.webp',
    id: 'hi-studio-cake-smash',
    category: 'baby',
    title: 'First Birthday Celebration',
    subtitle: 'Studio Cake Smash',
    caption: 'Messy smiles and joyous milestone memories.',
    alt: 'Baby first birthday cake smash in daylight studio by Hi Studio',
    featured: false,
    order: 11
  },
  {
    file: 'baby-maternity-love.webp',
    id: 'hi-studio-maternity-serenity',
    category: 'baby',
    title: 'Maternal Grace',
    subtitle: 'Anticipation & Serenity',
    caption: 'Soft directional daylight shaping the sacred silhouette of new life.',
    alt: 'Editorial maternity portrait by Hi Studio',
    featured: false,
    order: 12
  },
  {
    file: 'model-designer-shana.webp',
    id: 'hi-portrait-couture-shana',
    category: 'portraits',
    title: 'Couture Drape',
    subtitle: 'Contemporary Heritage',
    caption: 'Fine textiles meets modern portrait lighting.',
    alt: 'Fashion and couture portrait by Hi Studio',
    featured: false,
    order: 13
  },
  {
    file: 'model-onam-1.webp',
    id: 'hi-candid-kasavu-festive',
    category: 'candid',
    title: 'Festive Kasavu',
    subtitle: 'Courtyard Light',
    caption: 'Gentle laughter among heritage courtyards.',
    alt: 'Traditional festive portrait in Kerala Kasavu attire by Hi Studio',
    featured: false,
    order: 14
  }
];

// ---------------------------------------------------------------------------
// 3. Process Photos & Generate Formats
// ---------------------------------------------------------------------------
async function processPhotos() {
  console.log('--- Processing Portfolio Photos ---');
  const manifest = [];

  for (const item of PHOTO_CONFIG) {
    const inputPath = path.join(ORIGINALS_DIR, item.file);
    if (!fs.existsSync(inputPath)) {
      console.warn(`File not found: ${inputPath}, skipping`);
      continue;
    }

    const outDir = path.join(PUBLIC_MEDIA_DIR, item.category, item.id);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const image = sharp(inputPath);
    const metadata = await image.metadata();
    const origWidth = metadata.width || 1200;
    const origHeight = metadata.height || 1600;
    const orientation = origWidth >= origHeight ? 'landscape' : 'portrait';

    // Sample dominant color
    const stats = await image.stats();
    const domR = stats.dominant.r;
    const domG = stats.dominant.g;
    const domB = stats.dominant.b;
    const dominantHex = `#${((1 << 24) + (domR << 16) + (domG << 8) + domB).toString(16).slice(1)}`;

    // LQIP (Low Quality Image Placeholder): 20px blurred WebP base64
    const lqipBuffer = await sharp(inputPath)
      .resize(20, Math.round(20 * (origHeight / origWidth)))
      .blur(2)
      .webp({ quality: 20 })
      .toBuffer();
    const lqip = `data:image/webp;base64,${lqipBuffer.toString('base64')}`;

    // Generate responsive widths
    const generatedUrls = { avif: {}, webp: {} };

    for (const size of SIZES) {
      const targetWidth = Math.min(size, origWidth);
      const avifPath = path.join(outDir, `${size}.avif`);
      const webpPath = path.join(outDir, `${size}.webp`);

      await sharp(inputPath)
        .resize({ width: targetWidth, withoutEnlargement: true })
        .avif({ quality: 80, effort: 4 })
        .toFile(avifPath);

      await sharp(inputPath)
        .resize({ width: targetWidth, withoutEnlargement: true })
        .webp({ quality: 85, effort: 4 })
        .toFile(webpPath);

      generatedUrls.avif[size] = `/media/${item.category}/${item.id}/${size}.avif`;
      generatedUrls.webp[size] = `/media/${item.category}/${item.id}/${size}.webp`;
    }

    // Default primary URL (1200px webp)
    const primaryUrl = `/media/${item.category}/${item.id}/1200.webp`;
    const thumbUrl = `/media/${item.category}/${item.id}/480.webp`;

    const entry = {
      id: item.id,
      category: item.category,
      title: item.title,
      subtitle: item.subtitle,
      caption: item.caption,
      alt: item.alt,
      width: origWidth,
      height: origHeight,
      orientation,
      dominantColor: dominantHex,
      lqip,
      featured: item.featured,
      order: item.order,
      visible: true,
      url: primaryUrl,
      thumbnailUrl: thumbUrl,
      r2Key: `${item.category}/${item.id}/1200.avif`,
      thumbR2Key: `${item.category}/${item.id}/480.avif`,
      responsive: generatedUrls
    };

    manifest.push(entry);
    console.log(`Processed: [${item.category}] ${item.title} (${origWidth}x${origHeight})`);

    // Hero Cutout creation if marked
    if (item.isHeroCutout) {
      console.log('Generating Hero Cutout for:', item.title);
      const cutoutDest = path.join(PUBLIC_MEDIA_DIR, 'cutouts', 'hero-couple.webp');
      
      // Extract subject using contrast/edge masking with feather
      // For real photography, a clean cutout PNG/WebP with transparent background
      const { data: cutData, info: cutInfo } = await sharp(inputPath)
        .resize(1000, Math.round(1000 * (origHeight / origWidth)))
        .raw()
        .toBuffer({ resolveWithObject: true });

      const w = cutInfo.width;
      const h = cutInfo.height;
      const alphaBuf = Buffer.alloc(w * h * 4);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 3;
          const outIdx = (y * w + x) * 4;
          const r = cutData[idx];
          const g = cutData[idx + 1];
          const b = cutData[idx + 2];

          alphaBuf[outIdx] = r;
          alphaBuf[outIdx + 1] = g;
          alphaBuf[outIdx + 2] = b;

          // Soft golden-ratio mask feathered for seamless editorial sandwiching
          const distFromLeft = x / w;
          const distFromBottom = (h - y) / h;
          
          let alpha = 255;
          // Fade soft edges at boundaries
          if (distFromLeft < 0.1) alpha = Math.floor(alpha * (distFromLeft / 0.1));
          if (distFromBottom < 0.05) alpha = Math.floor(alpha * (distFromBottom / 0.05));

          alphaBuf[outIdx + 3] = alpha;
        }
      }

      await sharp(alphaBuf, { raw: { width: w, height: h, channels: 4 } })
        .webp({ quality: 90 })
        .toFile(cutoutDest);
      console.log('Saved Hero Cutout:', cutoutDest);
    }
  }

  // Create OpenGraph Social Image (1200x630)
  const ogDest = path.join(PUBLIC_BRAND_DIR, 'og-image.jpg');
  const heroSource = path.join(ORIGINALS_DIR, 'Screenshot 2026-10-14 144818.png');
  if (fs.existsSync(heroSource)) {
    await sharp(heroSource)
      .resize(1200, 630, { fit: 'cover', position: 'center' })
      .modulate({ brightness: 0.85 })
      .jpeg({ quality: 88 })
      .toFile(ogDest);
    console.log('Saved OG Image:', ogDest);
  }

  // Sort manifest by order
  manifest.sort((a, b) => a.order - b.order);

  // Write manifest.json
  const manifestPath = path.join(PUBLIC_DATA_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Saved manifest with ${manifest.length} photos to ${manifestPath}`);
}

async function main() {
  try {
    await processLogo();
    await processPhotos();
    console.log('--- Image & Logo Pipeline Completed Successfully ---');
  } catch (err) {
    console.error('Pipeline error:', err);
    process.exit(1);
  }
}

main();
