// Prints an ADMIN_PASSWORD_HASH value: pbkdf2_sha256$<iterations>$<base64 salt>$<base64 hash>.
//
//   npm run hash-password                       prompts twice (input hidden)
//   "secret" | npm run hash-password            (PowerShell) reads stdin when it is not a terminal
//   npm run hash-password -- "secret"           also works, but leaves the password in shell history
//
// Then: npx wrangler pages secret put ADMIN_PASSWORD_HASH   (paste the printed value)
// 100000 iterations is the maximum PBKDF2 count Cloudflare Workers accepts.
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const ITERATIONS = 100_000;
const MIN_LENGTH = 10;

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    const { stdin, stderr } = process;
    stderr.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stderr.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u0003') {
          stdin.setRawMode(false);
          stderr.write('\n');
          reject(new Error('Cancelled'));
          return;
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data.replace(/\r?\n$/, '');
}

async function getPassword() {
  if (process.argv[2] !== undefined) return process.argv[2];
  if (!process.stdin.isTTY) {
    console.error('Reading the password from stdin (end with Ctrl+D / Ctrl+Z)...');
    return readStdin();
  }
  const first = await readHidden('New admin password: ');
  const second = await readHidden('Repeat password: ');
  if (first !== second) throw new Error('The passwords do not match.');
  return first;
}

try {
  const password = await getPassword();
  if (password.length < MIN_LENGTH) throw new Error(`Use at least ${MIN_LENGTH} characters.`);
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
  process.stdout.write(`pbkdf2_sha256$${ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}\n`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
