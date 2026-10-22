// Captures the hero picture's screens and cards from /dev/hero-textures (served by `npm run dev`) as
// 4x PNGs with transparent rounded corners, for hero_scene.py to use as textures.
//
//   npm install --no-save playwright-core
//   node hero-render/capture-textures.cjs [dev server URL, default http://localhost:5173]
//
// Uses the Chrome installed on this machine, so playwright-core doesn't download a browser.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const BASE = process.argv[2] || 'http://localhost:5173';
const OUT = path.join(__dirname, 'textures');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await (await browser.newContext({ viewport: { width: 900, height: 1400 }, deviceScaleFactor: 4 })).newPage();
  await page.goto(`${BASE}/dev/hero-textures`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
  });
  await page.waitForTimeout(300);
  const names = await page.$$eval('[data-texture]', (els) => els.map((e) => e.dataset.texture));
  if (names.length === 0) throw new Error('No textures found: is the dev server running at ' + BASE + '?');
  for (const name of names) {
    const file = path.join(OUT, `${name}.png`);
    await page.locator(`[data-texture="${name}"]`).screenshot({ path: file, omitBackground: true });
    console.log('captured', path.relative(process.cwd(), file));
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
