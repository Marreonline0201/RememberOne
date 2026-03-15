/**
 * Captures all app screens:
 *  1. Phone PNG screenshots → /screenshots/*.png
 *  2. Figma capture → pushed to existing Figma file
 *
 * Auth strategy: create a test user via Supabase admin, sign in via UI form.
 */

const { chromium } = require('playwright');
const https = require('https');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://remember-one-1.vercel.app';
const SUPABASE_URL = 'https://vrmbqoboulibhtctibju.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Temporary test account we'll create
const TEST_EMAIL = 'playwright_test@rememberone-capture.app';
const TEST_PASS  = 'CaptureTest2026!';
const TEST_NAME  = 'Screenshot Bot';

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

const CAPTURES = [
  { name: '01-login',       url: `${BASE_URL}/login`,    captureId: 'c0ca0e30-6b85-4997-8395-61ca3e312c0b', auth: false },
  { name: '02-dashboard',   url: `${BASE_URL}/`,         captureId: '718f2f60-3969-4230-9261-0d448ec423d5', auth: true  },
  { name: '03-log-meeting', url: `${BASE_URL}/log`,      captureId: '647f3454-9441-48aa-b902-7986bae38d6b', auth: true  },
  { name: '04-calendar',    url: `${BASE_URL}/calendar`, captureId: 'e1a5714d-ec74-4b06-ab9a-7e4686c7f553', auth: true  },
  { name: '05-account',     url: `${BASE_URL}/account`,  captureId: 'c867deb3-721d-456b-a0fb-81daf63ecb02', auth: true  },
];

const PHONE = { width: 393, height: 852, deviceScaleFactor: 2 };
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// ── HTTP helpers ────────────────────────────────────────────────────────────
function apiRequest(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: {
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function ensureTestUser() {
  console.log('Creating test user...');
  const res = await apiRequest('POST', `${SUPABASE_URL}/auth/v1/admin/users`, {
    email: TEST_EMAIL,
    password: TEST_PASS,
    email_confirm: true,
    user_metadata: { full_name: TEST_NAME },
  }, {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  });
  if (res.id || res.email) {
    console.log('  ✓ test user ready:', res.email || res.id);
  } else if (res.msg?.includes('already') || res.code === 422) {
    console.log('  ✓ test user already exists');
  } else {
    console.log('  User creation response:', JSON.stringify(res).substring(0, 200));
  }
}

async function abortJunk(route) {
  const url = route.request().url();
  if (/\.well-known\/otel|otel\/metrics|sentry|beacon|gtm|doubleclick/.test(url)) {
    await route.abort();
    return true;
  }
  return false;
}

async function installCspStrip(page) {
  await page.unroute('**/*').catch(() => {});
  await page.route('**/*', async (route) => {
    if (await abortJunk(route)) return;
    let response;
    try { response = await route.fetch({ timeout: 20000 }); } catch { return route.abort(); }
    const headers = { ...response.headers() };
    delete headers['content-security-policy'];
    delete headers['content-security-policy-report-only'];
    await route.fulfill({ response, headers });
  });
}

async function signInViaForm(page) {
  console.log('Signing in via form...');
  await page.unroute('**/*').catch(() => {});
  await page.route('**/*', async (route) => {
    if (await abortJunk(route)) return;
    try { await route.continue(); } catch { await route.abort().catch(() => {}); }
  });

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Fill in the login form
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASS);
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard (away from /login)
  try {
    await page.waitForURL((url) => !url.href.includes('/login'), { timeout: 15000 });
    console.log('  ✓ signed in, redirected to:', page.url());
    return true;
  } catch {
    console.log('  still on:', page.url());
    return !page.url().includes('/login');
  }
}

async function capturePage(page, { name, url, captureId }) {
  console.log(`\n── ${name}`);

  await installCspStrip(page);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  if (page.url().includes('/login')) {
    console.log('  ⚠ Redirected to login');
    return;
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${name}.png`), fullPage: false });
  console.log('  ✓ screenshot saved');

  // Figma capture
  try {
    const scriptRes = await page.context().request.get(
      'https://mcp.figma.com/mcp/html-to-design/capture.js', { timeout: 10000 }
    );
    await page.evaluate((s) => {
      const el = document.createElement('script');
      el.textContent = s;
      document.head.appendChild(el);
    }, await scriptRes.text());
    await page.waitForTimeout(1000);
    const result = await page.evaluate(
      ({ cId, ep }) => window.figma?.captureForDesign({ captureId: cId, endpoint: ep, selector: 'body' }),
      { cId: captureId, ep: `https://mcp.figma.com/mcp/capture/${captureId}/submit` }
    );
    console.log('  ✓ Figma capture sent', result?.status ?? '');
  } catch (err) {
    console.warn('  ⚠ Figma capture skipped:', err.message.split('\n')[0]);
  }
}

async function main() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  await ensureTestUser();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, userAgent: UA });
  const page = await context.newPage();

  // ── Sign in ──────────────────────────────────────────────────────────────
  const authenticated = await signInViaForm(page);
  console.log('Authenticated:', authenticated);

  // ── Capture each screen ──────────────────────────────────────────────────
  for (const entry of CAPTURES) {
    if (entry.auth && !authenticated) {
      console.log(`Skipping ${entry.name}`);
      continue;
    }
    await capturePage(page, entry);
  }

  await browser.close();

  console.log('\n✅ Done!');
  const saved = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
  console.log('Screenshots:', saved.join(', '));
}

main().catch((err) => { console.error('Fatal:', err.message); process.exit(1); });
