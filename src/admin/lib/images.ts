/**
 * In-browser image processing for admin uploads: decode once, resize with good quality,
 * encode WebP. Nothing is upscaled beyond the source size.
 */

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type Source = ImageBitmap | HTMLImageElement;

const sourceSize = (src: Source) =>
  'naturalWidth' in src ? { w: src.naturalWidth, h: src.naturalHeight } : { w: src.width, h: src.height };

async function decode(file: File): Promise<{ source: Source; release: () => void }> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Only JPEG, PNG or WebP images can be uploaded.');
  }
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, release: () => bmp.close() };
    } catch {
      /* fall through to <img> decoding */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('This image could not be read. It may be damaged or in an unsupported format.');
  }
}

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process this image.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

/** Resize to `targetW` wide, halving in steps for large reductions so detail stays crisp. */
function resizeTo(src: CanvasImageSource, srcW: number, srcH: number, targetW: number): HTMLCanvasElement {
  let curSrc: CanvasImageSource = src;
  let curW = srcW;
  let curH = srcH;
  while (curW / 2 > targetW) {
    const { canvas, ctx } = makeCanvas(curW / 2, curH / 2);
    ctx.drawImage(curSrc, 0, 0, canvas.width, canvas.height);
    curSrc = canvas;
    curW = canvas.width;
    curH = canvas.height;
  }
  const targetH = Math.round((srcH * targetW) / srcW);
  const { canvas, ctx } = makeCanvas(targetW, targetH);
  ctx.drawImage(curSrc, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Could not encode the image.'));
        if (blob.type !== 'image/webp') {
          return reject(new Error('This browser cannot create WebP images. Please use a recent Chrome, Edge or Firefox.'));
        }
        resolve(blob);
      },
      'image/webp',
      quality
    );
  });
}

function averageColour(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) return '#141312';
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    r += data[i] * a;
    g += data[i + 1] * a;
    b += data[i + 2] * a;
    n += a;
  }
  if (!n) return '#141312';
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export interface ProcessedPhoto {
  files: { w480: Blob; w1200: Blob; w2000?: Blob };
  width: number;
  height: number;
  dominantColor: string;
  lqip: string;
}

/** Portfolio photo: WebP at 480 / 1200 / 2000 px wide (2000 only when the source is that large). */
export async function processPortfolioPhoto(file: File): Promise<ProcessedPhoto> {
  const { source, release } = await decode(file);
  try {
    const { w: srcW, h: srcH } = sourceSize(source);
    if (!srcW || !srcH) throw new Error('This image has no size information.');
    if (srcW < 300 || srcH < 300) throw new Error(`This image is too small (${srcW} × ${srcH}). Please use one at least 1200 pixels wide.`);

    const largestW = Math.min(srcW, srcW >= 2000 ? 2000 : 1200);
    const large = resizeTo(source, srcW, srcH, largestW);
    const w2000 = srcW >= 2000 ? await toWebp(large, 0.84) : undefined;
    const c1200 = largestW > 1200 ? resizeTo(large, large.width, large.height, 1200) : large;
    const w1200 = await toWebp(c1200, 0.82);
    const c480 = resizeTo(c1200, c1200.width, c1200.height, Math.min(480, c1200.width));
    const w480 = await toWebp(c480, 0.8);

    const tiny = resizeTo(c480, c480.width, c480.height, 16);
    const dominantColor = averageColour(tiny);
    const lqip = tiny.toDataURL('image/webp', 0.5);

    return {
      files: { w480, w1200, w2000 },
      width: large.width,
      height: large.height,
      dominantColor,
      lqip: lqip.startsWith('data:image/webp') ? lqip : '',
    };
  } finally {
    release();
  }
}

/** Product photo: a single WebP no wider/taller than `maxSide` px. */
export async function processProductImage(file: File, maxSide = 1600): Promise<File> {
  const { source, release } = await decode(file);
  try {
    const { w, h } = sourceSize(source);
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const canvas = resizeTo(source, w, h, Math.max(1, Math.round(w * scale)));
    const blob = await toWebp(canvas, 0.85);
    const base = file.name.replace(/\.[^.]+$/, '') || 'product';
    return new File([blob], `${base}.webp`, { type: 'image/webp' });
  } finally {
    release();
  }
}
