/**
 * Customer photo handling: read size, make a tiny thumbnail for the bag, shrink only files that are
 * over the upload limit, and upload to POST /api/shop/uploads (private bucket). Full photos are
 * never kept as data URLs.
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPT_ATTR = ACCEPTED_TYPES.join(',');
const MAX_LONG_EDGE = 6000;

export class UploadError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

/** Explains why a file can't be used, or returns null. */
export const rejectReason = (file: File): string | null => {
  if (ACCEPTED_TYPES.includes(file.type)) return null;
  if (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    return 'HEIC photos can’t be printed from here. Please choose a JPEG, PNG or WebP copy.';
  }
  return 'Please choose a JPEG, PNG or WebP photo.';
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new UploadError('This file could not be opened as a photo.'));
    img.src = src;
  });

const drawScaled = (img: HTMLImageElement, longEdge: number) => {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const scale = Math.min(1, longEdge / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new UploadError('Your browser could not process this photo.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new UploadError('Could not prepare this photo.'))), type, quality)
  );

/** WebP thumbnail where supported (JPEG otherwise), long edge ≤ 320px — a few KB. */
const thumbnail = (img: HTMLImageElement) => {
  const canvas = drawScaled(img, 320);
  const webp = canvas.toDataURL('image/webp', 0.72);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.78);
};

export interface PreparedPhoto {
  /** What gets uploaded: the original file, or a resized JPEG when the original is over 25 MB. */
  blob: Blob;
  fileName: string;
  /** Pixel size of the uploaded image (after any resize). */
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  resized: boolean;
  thumbUrl: string;
  /** Object URL of a ~1600px copy for large previews (revoke when done), when requested. */
  previewUrl?: string;
}

export async function preparePhoto(file: File, { withPreview = false } = {}): Promise<PreparedPhoto> {
  const reason = rejectReason(file);
  if (reason) throw new UploadError(reason, 415);
  const src = URL.createObjectURL(file);
  try {
    const img = await loadImage(src);
    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;
    const thumbUrl = thumbnail(img);

    let previewUrl: string | undefined;
    if (withPreview) {
      const previewBlob = await toBlob(drawScaled(img, 1600), 'image/jpeg', 0.86);
      previewUrl = URL.createObjectURL(previewBlob);
    }

    let blob: Blob = file;
    let fileName = file.name || 'photo.jpg';
    let width = originalWidth;
    let height = originalHeight;
    let resized = false;
    if (file.size > MAX_UPLOAD_BYTES) {
      // Keep as much detail as fits: lower the JPEG quality a little first, then the size.
      let fitted: Blob | null = null;
      let canvas: HTMLCanvasElement | null = null;
      for (const edge of [MAX_LONG_EDGE, 5000, 4000]) {
        canvas = drawScaled(img, edge);
        for (const q of [0.92, 0.85, 0.78]) {
          const candidate = await toBlob(canvas, 'image/jpeg', q);
          if (candidate.size <= MAX_UPLOAD_BYTES) {
            fitted = candidate;
            break;
          }
        }
        if (fitted) break;
      }
      if (!fitted || !canvas) {
        throw new UploadError('This photo is too large to upload, even after resizing. Please choose a smaller copy.', 413);
      }
      blob = fitted;
      width = canvas.width;
      height = canvas.height;
      fileName = fileName.replace(/\.[^.]+$/, '') + '.jpg';
      resized = true;
    }
    return { blob, fileName, width, height, originalWidth, originalHeight, resized, thumbUrl, previewUrl };
  } finally {
    URL.revokeObjectURL(src);
  }
}

const messageFor = (status: number, serverMessage?: string) => {
  switch (status) {
    case 0:
      return 'Upload failed. Check your connection and retry.';
    case 413:
      return 'This file is over the 25 MB limit.';
    case 415:
      return 'Only JPEG, PNG or WebP photos can be uploaded.';
    case 429:
      return 'Too many uploads from this connection. Please wait a while, then retry.';
    case 503:
      return 'Photo uploads are not available right now. Please try again later.';
    default:
      return serverMessage || 'Upload failed. Please retry.';
  }
};

/** Uploads one prepared photo with progress. Resolves to the private storage key. */
export function uploadPhoto(
  photo: Pick<PreparedPhoto, 'blob' | 'fileName'>,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/shop/uploads');
    xhr.responseType = 'text';
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(0.99, e.loaded / e.total));
    };
    xhr.onload = () => {
      let data: { key?: string; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        /* not JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && typeof data.key === 'string') {
        onProgress(1);
        resolve(data.key);
      } else {
        reject(new UploadError(messageFor(xhr.status, data.error), xhr.status));
      }
    };
    xhr.onerror = () => reject(new UploadError(messageFor(0), 0));
    xhr.onabort = () => reject(new UploadError('Upload cancelled.', -1));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    const form = new FormData();
    form.append('file', photo.blob, photo.fileName);
    xhr.send(form);
  });
}
