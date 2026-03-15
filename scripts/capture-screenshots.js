/**
 * Takes phone-view screenshots of all app screens and saves to /screenshots/
 * Also submits Figma captures (fire-and-forget with timeout).
 */

const { chromium } = require('playwright');
const https = require('https');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://remember-one-1.vercel.app';
const SUPABASE_URL = 'https://vrmbqoboulibhtctibju.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TEST_EMAIL = 'playwright_test@rememberone-capture.app';
const TEST_PASS  = 'CaptureTest2026!';
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

const SCREENS = [
  { name: '01-login',       url: `${BASE_URL}/login`,    captureId: 'c0ca0e30-6b85-4997-8395-61ca3e312c0b', auth: false },
  { name: '02-dashboard',   url: `${BASE_URL}/`,         captureId: '718f2f60-3969-4230-9261-0d448ec423d5', auth: true  },
  { name: '03-log-meeting', url: `${BASE_URL}/log`,      captureId: '647f3454-9441-48aa-b902-7986bae38d6b', auth: true  },
  { name: '04-calendar',    url: `${BASE_URL}/calendar`, captureId: 'e1a5714d-ec74-4b06-ab9a-7e4686c7f553', auth: true  },
  { name: '05-account',     url: `${BASE_URL}/account`,  captureId: 'c867deb3-721d-456b-a0fb-81daf63ecb02', auth: true  },
];

const PHONE = { width: 393, height: 852, deviceScaleFactor: 2 };
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function post(url, body, headers) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers }
    }, (res) => { let r = ''; res.on('data', c => r += c); res.on('end', () => { try { resolve(JSON.parse(r)); } catch { resolve(r); } }); });
    req.on('error', reject); req.write(data); req.end();
  });
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
  ]);
}

async function setupRoute(page) {
  await page.unroute('**/*').catch(() => {});
  await page.route('**/*', async (route) => {
    const u = route.request().url();
    if (/otel|sentry|beacon|doubleclick/.test(u)) return route.abort();
    try { await route.continue(); } catch { await route.abort().catch(() => {}); }
  });
}

async function signIn(page) {
  // Make sure test user exists
  await post(`${SUPABASE_URL}/auth/v1/admin/users`,
    { email: TEST_EMAIL, password: TEST_PASS, email_confirm: true },
    { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
  ).catch(() => {});

  await setupRoute(page);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASS);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL(u => !u.href.includes('/login'), { timeout: 12000 });
    return true;
  } catch {
    return !page.url().includes('/login');
  }
}

async function figmaCapture(page, captureId) {
  const endpoint = `https://mcp.figma.com/mcp/capture/${captureId}/submit`;
  try {
    const res = await withTimeout(
      page.context().request.get('https://mcp.figma.com/mcp/html-to-design/capture.js'),
      8000, 'fetch capture.js'
    );
    const scriptText = await res.text();
    await page.evaluate((s) => {
      const el = document.createElement('script'); el.textContent = s; document.head.appendChild(el);
    }, scriptText);
    await page.waitForTimeout(800);
    await withTimeout(
      page.evaluate(({ cId, ep }) => window.figma?.captureForDesign({ captureId: cId, endpoint: ep, selector: 'body' }),
        { cId: captureId, ep: endpoint }),
      6000, 'captureForDesign'
    );
    console.log('    ✓ Figma capture queued');
  } catch (err) {
    console.log('    ⚠ Figma capture skipped:', err.message.split('\n')[0]);
  }
}

async function captureScreen(page, { name, url, captureId, auth }, authenticated) {
  if (auth && !authenticated) { console.log(`  skip ${name}`); return; }
  console.log(`\n── ${name}`);

  const already = fs.existsSync(path.join(SCREENSHOTS_DIR, `${name}.png`));

  if (!already) {
    await setupRoute(page);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    if (page.url().includes('/login')) { console.log('  ⚠ redirected to login'); return; }
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${name}.png`), fullPage: false });
    console.log('  ✓ screenshot saved');
  } else {
    console.log('  ✓ screenshot already exists, skipping re-capture');
    // Still navigate for Figma capture
    await setupRoute(page);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    if (page.url().includes('/login')) return;
  }

  await figmaCapture(page, captureId);
}

async function main() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, userAgent: UA });
  const page = await context.newPage();

  console.log('Signing in...');
  const authenticated = await signIn(page);
  console.log('Authenticated:', authenticated);

  for (const screen of SCREENS) {
    await captureScreen(page, screen, authenticated);
  }

  // Capture the login page separately with a fresh unauthenticated context
  const loginScreen = SCREENS[0];
  if (!fs.existsSync(path.join(SCREENSHOTS_DIR, `${loginScreen.name}.png`))) {
    console.log('\n── capturing login (unauthenticated)');
    const anonCtx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, userAgent: UA });
    const anonPage = await anonCtx.newPage();
    await setupRoute(anonPage);
    await anonPage.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await anonPage.waitForTimeout(2000);
    await anonPage.screenshot({ path: path.join(SCREENSHOTS_DIR, `${loginScreen.name}.png`), fullPage: false });
    console.log('  ✓ login screenshot saved');
    await figmaCapture(anonPage, loginScreen.captureId);
    await anonCtx.close();
  }

  await browser.close();
  console.log('\n✅ Done!');
  const saved = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
  console.log('Files:', saved.join(', '));
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
