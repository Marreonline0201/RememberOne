import { chromium } from "playwright";

// Pixel 7 — Android
const viewport = { width: 393, height: 873 };
const UA = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

const pages = [
  { url: "http://localhost:3000/login",    captureId: "acb8d3c7-9e21-446c-9fe8-f46e9c2a210b" },
  { url: "http://localhost:3000/",         captureId: "84eb1df7-039b-4cab-b27a-152ed8930ecf" },
  { url: "http://localhost:3000/meet",     captureId: "886fd408-39c0-40c0-a389-ced7148e059d" },
  { url: "http://localhost:3000/calendar", captureId: "78449d45-13e1-4de9-8855-870efd374f88" },
  { url: "http://localhost:3000/account",  captureId: "5bfc766b-4611-4672-ad7a-4a8316f4f909" },
];

async function injectAndCapture(page, captureId) {
  const r = await page.context().request.get("https://mcp.figma.com/mcp/html-to-design/capture.js");
  const script = await r.text();
  await page.evaluate((s) => {
    const el = document.createElement("script");
    el.textContent = s;
    document.head.appendChild(el);
  }, script);
  await page.waitForTimeout(800);
  const endpoint = `https://mcp.figma.com/mcp/capture/${captureId}/submit`;
  page.evaluate(
    ({ cId, ep }) => window.figma?.captureForDesign({ captureId: cId, endpoint: ep, selector: "body" }),
    { cId: captureId, ep: endpoint }
  ).catch(() => {});
  await page.waitForTimeout(8000);
  console.log(`Sent: captureId=${captureId}`);
}

const browser = await chromium.launch({ headless: true });

// ── Shared context so cookies persist across pages ──────────
const ctx = await browser.newContext({ viewport, userAgent: UA });

// Strip CSP on all requests
await ctx.route("**/*", async (route) => {
  const response = await route.fetch();
  const headers = { ...response.headers() };
  delete headers["content-security-policy"];
  delete headers["content-security-policy-report-only"];
  await route.fulfill({ response, headers });
});

// ── 1. Capture login page ────────────────────────────────────
const loginPage = await ctx.newPage();
await loginPage.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await loginPage.waitForTimeout(1000);
await injectAndCapture(loginPage, pages[0].captureId);
await loginPage.close();

// ── 2. Log in ────────────────────────────────────────────────
const authPage = await ctx.newPage();
await authPage.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await authPage.fill("#email", "test@rememberone.app");
await authPage.fill("#password", "RememberOne2024!");
await authPage.click('button[type="submit"]');
await authPage.waitForURL("http://localhost:3000/", { timeout: 15000 });
console.log("Logged in successfully");
await authPage.close();

// ── 3. Capture authenticated pages ──────────────────────────
for (const { url, captureId } of pages.slice(1)) {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await injectAndCapture(page, captureId);
  await page.close();
}

await browser.close();
console.log("All done!");
