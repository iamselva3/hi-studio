import sharp from 'sharp';

async function test() {
  const { data, info } = await sharp('Logo.jpeg').raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  
  // Find top-left of the actual ivory box:
  let tlX = 0, tlY = 0;
  for (let y = 250; y < 350; y++) {
    for (let x = 300; x < 400; x++) {
      const idx = (y * w + x) * 3;
      if (data[idx] > 220 && data[idx+1] > 210 && data[idx+2] > 190) {
        tlX = x;
        tlY = y;
        break;
      }
    }
    if (tlX > 0) break;
  }

  // Find bottom-right of the actual ivory box:
  let brX = 0, brY = 0;
  for (let y = 850; y > 750; y--) {
    for (let x = 950; x > 850; x--) {
      const idx = (y * w + x) * 3;
      if (data[idx] > 220 && data[idx+1] > 210 && data[idx+2] > 190) {
        brX = x;
        brY = y;
        break;
      }
    }
    if (brX > 0) break;
  }

  console.log({ tlX, tlY, brX, brY });
}

test();
