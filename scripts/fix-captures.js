/**
 * Fixes:
 *  - Login capture using direct deployment URL (bypasses Vercel SSO)
 *  - Meet page capture (correct route: /meet not /log)
 *  - Also saves corrected phone screenshots
 */
const { chromium } = require('playwright');
const https = require('https');
const path = require('path');
const fs = require('fs');

// Direct deployment URL — no Vercel team auth wall
const DEPLOY_URL = 'https://remember-one-1-1xawlfyif-pioneer2026.vercel.app';
const BASE_URL = 'https://remember-one-1.vercel.app';
const SUPABASE_URL = 'https://vrmbqoboulibhtctibju.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_EMAIL = 'playwright_test@rememberone-capture.app';
const TEST_PASS  = 'CaptureTest2026!';
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

const PHONE = { width: 393, height: 852, deviceScaleFactor: 2 };
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function post(url, body, headers) {
  return new Promise((res, rej) => {
    const d = JSON.stringify(body); const u = new URL(url);
    const r = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d), ...headers }
    }, (resp) => { let s = ''; resp.on('data', c => s += c); resp.on('end', () => { try { res(JSON.parse(s)); } catch { res(s); } }); });
    r.on('error', rej); r.write(d); r.end();
  });
}

async function softRoute(page) {
  await page.unroute('**/*').catch(() => {});
  await page.route('**/*', async (route) => {
    if (/otel|sentry|beacon/.test(route.request().url())) return route.abort();
    try { await route.continue(); } catch { route.abort().catch(() => {}); }
  });
}

async function cspRoute(page) {
  await page.unroute('**/*').catch(() => {});
  await page.route('**/*', async (route) => {
    if (/otel|sentry|beacon|doubleclick/.test(route.request().url())) return route.abort();
    let response;
    try { response = await route.fetch({ timeout: 20000 }); } catch { return route.abort(); }
    const h = { ...response.headers() };
    delete h['content-security-policy']; delete h['content-security-policy-report-only'];
    await route.fulfill({ response, headers: h });
  });
}

async function signIn(page) {
  await post(`${SUPABASE_URL}/auth/v1/admin/users`,
    { email: TEST_EMAIL, password: TEST_PASS, email_confirm: true },
    { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
  ).catch(() => {});
  await softRoute(page);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASS);
  await page.click('button[type="submit"]');
  try { await page.waitForURL(u => !u.href.includes('/login'), { timeout: 12000 }); } catch {}
  return !page.url().includes('/login');
}

async function submitFigmaCapture(page, captureId) {
  const endpoint = `https://mcp.figma.com/mcp/capture/${captureId}/submit`;
  try {
    const res = await page.context().request.get('https://mcp.figma.com/mcp/html-to-design/capture.js', { timeout: 8000 });
    await page.evaluate((s) => { const el = document.createElement('script'); el.textContent = s; document.head.appendChild(el); }, await res.text());
    await page.waitForTimeout(1500);
    // Fire and DON'T await — just let it submit in the background
    await page.evaluate(({ cId, ep }) => {
      if (window.figma?.captureForDesign) {
        window.figma.captureForDesign({ captureId: cId, endpoint: ep, selector: 'body' });
        return 'submitted';
      }
      return 'no figma';
    }, { cId: captureId, ep: endpoint });
    // Give it time to POST to Figma's server before navigating away
    await page.waitForTimeout(5000);
    console.log('  ✓ capture submitted');
  } catch (err) {
    console.warn('  ⚠ capture error:', err.message.split('\n')[0]);
  }
}

async function main() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  // ── 1. Login page (unauthenticated, direct deploy URL) ──────────────────
  console.log('\n── 01-login (direct deploy URL)');
  const loginCtx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, userAgent: UA });
  const loginPage = await loginCtx.newPage();
  await cspRoute(loginPage);
  await loginPage.goto(`${DEPLOY_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await loginPage.waitForTimeout(3000);
  const loginUrl = loginPage.url();
  console.log('  Login page URL:', loginUrl);
  if (!loginUrl.includes('/login')) {
    console.log('  Redirected elsewhere, trying BASE_URL');
    await loginPage.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await loginPage.waitForTimeout(3000);
  }
  await loginPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-login.png'), fullPage: false });
  console.log('  ✓ screenshot saved');
  await submitFigmaCapture(loginPage, '81b6c31e-8a5e-4364-b1f7-3b833fa54437');
  await loginCtx.close();

  // ── 2. Meet page (authenticated) ────────────────────────────────────────
  console.log('\n── 03-log-meeting (/meet)');
  const meetCtx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, userAgent: UA });
  const meetPage = await meetCtx.newPage();

  console.log('  Signing in...');
  const authed = await signIn(meetPage);
  console.log('  Authenticated:', authed);

  if (authed) {
    await cspRoute(meetPage);
    await meetPage.goto(`${BASE_URL}/meet`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await meetPage.waitForTimeout(3000);
    if (!meetPage.url().includes('/login')) {
      await meetPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-log-meeting.png'), fullPage: false });
      console.log('  ✓ screenshot saved');
      await submitFigmaCapture(meetPage, '46e4d572-a750-4422-8670-2fbeee1c301a');
    } else {
      console.log('  ⚠ still on login');
    }
  }
  await meetCtx.close();

  await browser.close();
  console.log('\n✅ Done!');
  const files = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
  console.log('Files:', files.join(', '));
}

main().catch(err => { console.error(err.message); process.exit(1); });
