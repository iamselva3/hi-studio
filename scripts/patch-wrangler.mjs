import fs from 'node:fs';
import path from 'node:path';

const wranglerBin = path.resolve('node_modules/wrangler/bin/wrangler.js');

if (fs.existsSync(wranglerBin)) {
  let content = fs.readFileSync(wranglerBin, 'utf-8');
  const target = '...process.argv.slice(2),';
  const replacement = `...(process.argv.slice(2)[0] === 'deploy' ? ['pages', 'deploy', 'dist', ...process.argv.slice(3)] : process.argv.slice(2)),`;
  
  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(wranglerBin, content, 'utf-8');
    console.log('[patch-wrangler] Successfully aliased `wrangler deploy` to `wrangler pages deploy dist` for Cloudflare CI.');
  }
}
