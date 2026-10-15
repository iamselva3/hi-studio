import sharp from 'sharp';

async function traceAll() {
  const { data, info } = await sharp('public/brand/hi-monogram-exact.png').raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  function getAlpha(x, y) {
    if (x < 0 || x >= w || y < 0 || y >= h) return 0;
    return data[(Math.floor(y) * w + Math.floor(x)) * 4 + 3];
  }

  // 1. Left loop:
  // Starts at x=265, y=525, goes up to top at (505, 305), goes down to teardrop at (365, 675), goes back up-right to (620, 440)
  // Let's trace it in 3 segments:
  // Seg 1A: upward from x=265 to 505
  const seg1A = [];
  for (let x = 265; x <= 505; x += 15) {
    let sumY = 0, count = 0;
    for (let y = 295; y <= 550; y++) {
      if (getAlpha(x, y) > 160) {
        // We want the upper stroke
        if (y < 460 || x < 330) {
          sumY += y; count++;
        }
      }
    }
    if (count > 0) seg1A.push([x, Math.round(sumY / count)]);
  }

  // Seg 1B: downward from top (505) through right side down to teardrop (around x=365, y=675)
  const seg1B = [];
  for (let y = 320; y <= 675; y += 18) {
    let sumX = 0, count = 0;
    for (let x = 340; x <= 540; x++) {
      if (getAlpha(x, y) > 160) {
        // descending stroke
        if (y > 600 || x > 420) {
          sumX += x; count++;
        }
      }
    }
    if (count > 0) seg1B.push([Math.round(sumX / count), y]);
  }

  // Seg 1C: bottom teardrop turning up-right from (365, 675) to (630, 435)
  const seg1C = [];
  for (let x = 370; x <= 630; x += 18) {
    let sumY = 0, count = 0;
    for (let y = 425; y <= 680; y++) {
      if (getAlpha(x, y) > 160) {
        // the upward stroke
        const expectedY = 675 - ((x - 370) / 260) * 240;
        if (Math.abs(y - expectedY) < 40) {
          sumY += y; count++;
        }
      }
    }
    if (count > 0) seg1C.push([x, Math.round(sumY / count)]);
  }

  // 2. Vertical stem
  const stem = [];
  for (let y = 300; y <= 805; y += 20) {
    let sumX = 0, count = 0;
    const approxX = 675 - ((y - 300) / 505) * 100;
    for (let x = Math.floor(approxX - 35); x <= Math.floor(approxX + 35); x++) {
      if (getAlpha(x, y) > 180) { sumX += x; count++; }
    }
    if (count > 0) stem.push([Math.round(sumX / count), y]);
  }

  // 3. Lower sweep flourish
  const sweep = [];
  for (let x = 345; x <= 995; x += 25) {
    let sumY = 0, count = 0;
    const approxY = 790 - ((x - 345) / 650) * 220;
    for (let y = Math.floor(approxY - 30); y <= Math.floor(approxY + 30); y++) {
      if (getAlpha(x, y) > 180) { sumY += y; count++; }
    }
    if (count > 0) sweep.push([x, Math.round(sumY / count)]);
  }

  // 4. 'i' curve:
  // Starts at (640, 440) -> goes down to (655, 555) -> goes up and right to (995, 450)
  const iDown = [];
  for (let y = 430; y <= 560; y += 15) {
    let sumX = 0, count = 0;
    for (let x = 620; x <= 675; x++) {
      if (getAlpha(x, y) > 180) { sumX += x; count++; }
    }
    if (count > 0) iDown.push([Math.round(sumX / count), y]);
  }

  const iWave = [];
  for (let x = 665; x <= 995; x += 20) {
    let sumY = 0, count = 0;
    for (let y = 380; y <= 560; y++) {
      if (getAlpha(x, y) > 160) {
        // avoid lower sweep flourish which is below y=550 at this x
        if (y < 520 || x < 720) {
          sumY += y; count++;
        }
      }
    }
    if (count > 0) iWave.push([x, Math.round(sumY / count)]);
  }

  function toPath(pts) {
    if (!pts.length) return '';
    return 'M ' + pts[0][0] + ' ' + pts[0][1] + ' ' + pts.slice(1).map(p => 'L ' + p[0] + ' ' + p[1]).join(' ');
  }

  console.log('--- PATHS ---');
  console.log('Path H Loop:', toPath([...seg1A, ...seg1B, ...seg1C]));
  console.log('Path H Stem:', toPath(stem));
  console.log('Path Sweep:', toPath(sweep));
  console.log('Path i Wave:', toPath([...iDown, ...iWave]));
}

traceAll();
