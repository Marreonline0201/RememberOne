/**
 * Pushes each already-captured app screen into Figma using the generate_figma_design capture IDs.
 * Strips CSP so the capture.js script can communicate with mcp.figma.com.
 */

const { chromium } = require('playwright');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://remember-one-1.vercel.app';
const SUPABASE_URL = 'https://vrmbqoboulibhtctibju.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_EMAIL = 'playwright_test@rememberone-capture.app';
const TEST_PASS  = 'CaptureTest2026!';

// Already-generated capture IDs (single-use, consumed by Figma)
const SCREENS = [
  { name: 'login',       url: `${BASE_URL}/login`,    captureId: 'c0ca0e30-6b85-4997-8395-61ca3e312c0b', auth: false },
  { name: 'dashboard',   url: `${BASE_URL}/`,         captureId: '718f2f60-3969-4230-9261-0d448ec423d5', auth: true  },
  { name: 'log-meeting', url: `${BASE_URL}/log`,      captureId: '647f3454-9441-48aa-b902-7986bae38d6b', auth: true  },
  { name: 'calendar',    url: `${BASE_URL}/calendar`, captureId: 'e1a5714d-ec74-4b06-ab9a-7e4686c7f553', auth: true  },
  { name: 'account',     url: `${BASE_URL}/account`,  captureId: 'c867deb3-721d-456b-a0fb-81daf63ecb02', auth: true  },
];

const PHONE = { width: 393, height: 852, deviceScaleFactor: 2 };
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function post(url, body, headers) {
  return new Promise((res, rej) => {
    const d = JSON.stringify(body);
    const u = new URL(url);
    const r = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d), ...headers }
    }, (resp) => { let s = ''; resp.on('data', c => s += c); resp.on('end', () => { try { res(JSON.parse(s)); } catch { res(s); } }); });
    r.on('error', rej); r.write(d); r.end();
  });
}

async function signIn(page) {
  // Ensure test user exists
  await post(`${SUPABASE_URL}/auth/v1/admin/users`,
    { email: TEST_EMAIL, password: TEST_PASS, email_confirm: true },
    { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
  ).catch(() => {});

  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (/otel|sentry|beacon/.test(url)) return route.abort();
    try { await route.continue(); } catch { route.abort().catch(() => {}); }
  });
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASS);
  await page.click('button[type="submit"]');
  try { await page.waitForURL(u => !u.href.includes('/login'), { timeout: 12000 }); } catch {}
  return !page.url().includes('/login');
}

async function capturePageToFigma(page, { name, url, captureId }) {
  console.log(`\n── ${name}`);

  // Strip CSP on every response so capture.js can POST to mcp.figma.com
  await page.unroute('**/*').catch(() => {});
  await page.route('**/*', async (route) => {
    const u = route.request().url();
    if (/otel|sentry|beacon|doubleclick/.test(u)) return route.abort();
    let response;
    try { response = await route.fetch({ timeout: 20000 }); }
    catch { return route.abort(); }
    const headers = { ...response.headers() };
    delete headers['content-security-policy'];
    delete headers['content-security-policy-report-only'];
    delete headers['x-frame-options'];
    await route.fulfill({ response, headers });
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  if (page.url().includes('/login')) { console.log('  ⚠ redirected to login'); return; }

  // Fetch and inject the Figma capture script
  const scriptRes = await page.context().request.get(
    'https://mcp.figma.com/mcp/html-to-design/capture.js', { timeout: 10000 }
  );
  const scriptText = await scriptRes.text();

  await page.evaluate((s) => {
    const el = document.createElement('script');
    el.textContent = s;
    document.head.appendChild(el);
  }, scriptText);

  // Wait for window.figma to be initialized (up to 5s)
  let figmaReady = false;
  for (let i = 0; i < 10; i++) {
    figmaReady = await page.evaluate(() => typeof window.figma !== 'undefined' && typeof window.figma.captureForDesign === 'function');
    if (figmaReady) break;
    await page.waitForTimeout(500);
  }

  if (!figmaReady) {
    console.log('  ⚠ window.figma not available — capture script may be blocked');
    return;
  }

  const endpoint = `https://mcp.figma.com/mcp/capture/${captureId}/submit`;
  const result = await page.evaluate(
    ({ cId, ep }) => window.figma.captureForDesign({ captureId: cId, endpoint: ep, selector: 'body' }),
    { cId: captureId, ep: endpoint }
  ).catch(err => ({ error: err.message }));

  console.log('  ✓ captureForDesign result:', JSON.stringify(result).substring(0, 100));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, userAgent: UA });
  const page = await context.newPage();

  console.log('Signing in...');
  const authed = await signIn(page);
  console.log('Authenticated:', authed);

  for (const screen of SCREENS) {
    if (screen.auth && !authed) { console.log(`skip ${screen.name}`); continue; }
    await capturePageToFigma(page, screen);
  }

  // Login page — use a fresh unauthenticated context
  const loginScreen = SCREENS[0];
  console.log('\n── login (unauthenticated context)');
  const anonCtx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, userAgent: UA });
  const anonPage = await anonCtx.newPage();
  await capturePageToFigma(anonPage, loginScreen);
  await anonCtx.close();

  await browser.close();
  console.log('\n✅ Figma captures submitted. Check your Figma file!');
}

main().catch(err => { console.error(err.message); process.exit(1); });
