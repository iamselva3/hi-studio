import sharp from 'sharp';

async function makeCleanLogo() {
  const { data, info } = await sharp('Logo.jpeg').raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const rgba = Buffer.alloc(w * h * 4);

  // Exact Ivory box boundaries in Logo.jpeg (including its thin black outline)
  const boxLeft = 318;
  const boxRight = 923;
  const boxTop = 272;
  const boxBottom = 821;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 3;
      const dstIdx = (y * w + x) * 4;
      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];
      const brightness = r * 0.299 + g * 0.587 + b * 0.114;

      const insideBox = x >= boxLeft && x <= boxRight && y >= boxTop && y <= boxBottom;

      if (insideBox) {
        // Keep inside box exactly as in original Logo.jpeg: solid opaque
        rgba[dstIdx] = r;
        rgba[dstIdx + 1] = g;
        rgba[dstIdx + 2] = b;
        rgba[dstIdx + 3] = 255;
      } else {
        // Outside the box:
        // Everything bright is ivory text/flourishes ("STUDIO", flourishes, top bar, underline)
        // Everything dark is background
        if (brightness < 18) {
          rgba[dstIdx] = 0;
          rgba[dstIdx + 1] = 0;
          rgba[dstIdx + 2] = 0;
          rgba[dstIdx + 3] = 0;
        } else {
          // Un-multiply with ivory tint
          const alpha = Math.min(255, Math.max(0, Math.round((brightness / 235) * 255)));
          rgba[dstIdx] = 250;     // Ivory R
          rgba[dstIdx + 1] = 244; // Ivory G
          rgba[dstIdx + 2] = 231; // Ivory B
          rgba[dstIdx + 3] = alpha;
        }
      }
    }
  }

  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .png({ quality: 100 })
    .toFile('public/brand/logo-clean.png');

  await sharp('public/brand/logo-clean.png')
    .resize(512, 512)
    .png()
    .toFile('public/brand/logo-badge.png');

  await sharp('public/brand/logo-clean.png')
    .png()
    .toFile('public/brand/logo.png');

  console.log('Clean logo generated successfully!');
}

makeCleanLogo();
