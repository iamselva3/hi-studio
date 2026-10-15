import sharp from 'sharp';

async function extract() {
  const { data, info } = await sharp('Logo.jpeg').raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  // Box bounds:
  const boxLeft = 318;
  const boxRight = 923;
  const boxTop = 272;
  const boxBottom = 821;

  const hiStrokesBuf = Buffer.alloc(w * h * 4);
  const studioBuf = Buffer.alloc(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 3;
      const dstIdx = (y * w + x) * 4;
      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];
      const brightness = r * 0.299 + g * 0.587 + b * 0.114;

      const insideBox = x >= boxLeft && x <= boxRight && y >= boxTop && y <= boxBottom;
      const isTopBar = y < 265 && x >= 300 && x <= 520;
      const isStudioArea = y >= 825;

      // 1. STUDIO text and underline
      if (isStudioArea && brightness > 40) {
        const a = Math.min(255, Math.max(0, Math.round((brightness / 235) * 255)));
        studioBuf[dstIdx] = 20;     // rich dark espresso
        studioBuf[dstIdx + 1] = 18;
        studioBuf[dstIdx + 2] = 16;
        studioBuf[dstIdx + 3] = a;
      }

      // 2. HI MONOGRAM:
      if (y >= 250 && y <= 830) {
        if (insideBox) {
          // Inside the box, the black ink is dark (brightness < 165)
          if (brightness < 170) {
            // Anti-aliased alpha
            const darkness = Math.min(255, Math.max(0, Math.round(((180 - brightness) / 165) * 255)));
            hiStrokesBuf[dstIdx] = 20;
            hiStrokesBuf[dstIdx + 1] = 18;
            hiStrokesBuf[dstIdx + 2] = 16;
            hiStrokesBuf[dstIdx + 3] = darkness;
          }
        } else {
          // Outside the box, the white flourishes on black bg (brightness > 40)
          if (brightness > 40 && !isTopBar) {
            const a = Math.min(255, Math.max(0, Math.round((brightness / 235) * 255)));
            hiStrokesBuf[dstIdx] = 20;
            hiStrokesBuf[dstIdx + 1] = 18;
            hiStrokesBuf[dstIdx + 2] = 16;
            hiStrokesBuf[dstIdx + 3] = a;
          }
        }
      }
    }
  }

  // Smooth edges with subtle blur/threshold for ultra crisp presentation
  await sharp(hiStrokesBuf, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile('public/brand/hi-monogram-exact.png');

  await sharp(studioBuf, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile('public/brand/studio-exact.png');

  console.log('Unbroken strokes extracted!');
}

extract();
