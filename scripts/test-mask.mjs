import sharp from 'sharp';
import fs from 'fs';

async function testMask() {
  const b64 = fs.readFileSync('public/brand/hi-monogram-exact.png').toString('base64');
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254">
    <defs>
      <mask id="m">
        <rect width="1254" height="1254" fill="black" />
        <rect x="318" y="272" width="605" height="549" fill="none" stroke="white" stroke-width="26" />
        <path d="M 260 525 C 280 430, 360 320, 480 305 C 530 300, 530 390, 490 480 C 440 580, 350 670, 390 675 C 440 680, 520 540, 625 435" fill="none" stroke="white" stroke-width="85" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M 672 295 C 650 380, 625 500, 576 700 L 582 805" fill="none" stroke="white" stroke-width="85" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M 345 795 C 480 720, 680 620, 920 570 L 995 580" fill="none" stroke="white" stroke-width="85" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M 645 430 C 655 510, 650 560, 675 550 C 710 535, 760 470, 840 425 C 900 395, 960 395, 995 445" fill="none" stroke="white" stroke-width="85" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="708" cy="400" r="35" fill="white" />
      </mask>
    </defs>
    <rect width="1254" height="1254" fill="#D6C098" />
    <!-- Ivory Box backing -->
    <rect x="318" y="272" width="605" height="549" fill="#FAF4E7" />
    <image href="data:image/png;base64,${b64}" width="1254" height="1254" mask="url(#m)" />
  </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile('public/brand/test-mask-result.png');
  console.log('Saved test-mask-result.png successfully');
}

testMask();
