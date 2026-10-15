import { HttpError } from './http';

export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp';

export const IMAGE_EXT: Record<ImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Detects the image type from its first bytes (the declared Content-Type is not trusted). */
export function sniffImage(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/** Reads an uploaded image, enforcing size and type. Returns the bytes and the detected type. */
export async function readImage(
  file: File,
  allowed: readonly ImageType[],
  maxBytes: number,
  label = 'File'
): Promise<{ bytes: ArrayBuffer; type: ImageType }> {
  if (file.size === 0) throw new HttpError(400, `${label} is empty`);
  if (file.size > maxBytes) {
    throw new HttpError(413, `${label} is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)`);
  }
  const bytes = await file.arrayBuffer();
  const type = sniffImage(new Uint8Array(bytes, 0, Math.min(16, bytes.byteLength)));
  const names = allowed.map((t) => IMAGE_EXT[t].toUpperCase());
  const allowedText = names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0];
  if (!type || !allowed.includes(type)) throw new HttpError(415, `${label} must be a ${allowedText} image`);
  // The bytes decide the stored type; a generic declared type is fine, a conflicting image type is not.
  const declared = file.type.toLowerCase();
  if (declared.startsWith('image/') && declared !== type && !(declared === 'image/jpg' && type === 'image/jpeg')) {
    throw new HttpError(415, `${label} content does not match its type`);
  }
  return { bytes, type };
}

/** Customer upload keys look like customer/YYYY-MM-DD/<uuid>.<ext>. */
export const CUSTOMER_KEY_RE =
  /^customer\/\d{4}-\d{2}-\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
