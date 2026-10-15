// Uploads public/media/** to Hi Studio's public R2 bucket (hi-studio-media) through the S3-compatible API.
// Optional: the site serves these files as static assets from the Pages deployment; this keeps a copy in R2.
//
// Needs, in the environment, .dev.vars or .env:
//   CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY  (an R2 API token with write access to the bucket)
//   HI_MEDIA_BUCKET  (optional, defaults to hi-studio-media)
import fs from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

function loadEnv() {
  const env = {};
  for (const file of ['.env', '.dev.vars']) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const [key, ...rest] = trimmed.split('=');
      env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
  return { ...env, ...process.env };
}

const env = loadEnv();
const bucket = env.HI_MEDIA_BUCKET || 'hi-studio-media';
const { CLOUDFLARE_ACCOUNT_ID: accountId, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey } = env;

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.error('Missing CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY (in .dev.vars, .env or the environment).');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

const CONTENT_TYPES = {
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

const mediaDir = path.resolve('public/media');
if (!fs.existsSync(mediaDir)) {
  console.error('public/media not found. Run `npm run images` first.');
  process.exit(1);
}

console.log(`Uploading public/media to R2 bucket "${bucket}" (account ${accountId.slice(0, 6)}…)`);
let uploaded = 0;
let failed = 0;
for (const file of listFiles(mediaDir)) {
  const contentType = CONTENT_TYPES[path.extname(file).toLowerCase()];
  const key = path.relative(mediaDir, file).replace(/\\/g, '/');
  if (!contentType) {
    console.log(`Skipped (not an image): ${key}`);
    continue;
  }
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fs.readFileSync(file),
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
    uploaded++;
    console.log(`Uploaded ${key}`);
  } catch (err) {
    failed++;
    console.error(`Failed ${key}: ${err.message}`);
  }
}

console.log(`Done: ${uploaded} uploaded, ${failed} failed.`);
if (failed) process.exit(1);
