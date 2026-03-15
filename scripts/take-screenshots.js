const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://remember-one-1-1xawlfyif-pioneer2026.vercel.app';
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

// iPhone 14 Pro viewport
const PHONE = { width: 393, height: 852, deviceScaleFactor: 2 };

async function run() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: PHONE,
    deviceScaleFactor: PHONE.deviceScaleFactor,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  const page = await context.newPage();

  const publicPages = [
    { name: '01-login', url: `${BASE_URL}/login` },
    { name: '02-signup', url: `${BASE_URL}/signup` },
  ];

  for (const { name, url } of publicPages) {
    console.log(`Screenshotting ${name}...`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, `${name}.png`),
      fullPage: false,
    });
    console.log(`  ✓ saved ${name}.png`);
  }

  // Try root — may redirect to login or dashboard
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const rootUrl = page.url();
  console.log('Root redirects to:', rootUrl);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '00-home.png'), fullPage: false });
  console.log('  ✓ saved 00-home.png');

  await browser.close();
  console.log('\nDone! Public page screenshots saved to:', SCREENSHOTS_DIR);
}

run().catch(console.error);
