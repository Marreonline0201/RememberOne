// ESM config (was next.config.js) — required because @serwist/next is ESM-only.
import withSerwistInit from "@serwist/next";

// Security headers applied to every response. CSP is intentionally permissive on
// script-src (Next.js App Router ships inline bootstrap scripts) — tighten with
// nonces later. connect-src enumerates every external origin the app talks to:
// Supabase (REST + realtime WebSocket), Gemini, Google Calendar, Google OAuth.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://www.googleapis.com https://oauth2.googleapis.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

// Offline support: precaches the app shell + runtime-caches visited pages so the
// app opens and shows the last-loaded data with no network. Disabled in dev.
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  // Precache the offline fallback page so the SW can serve it for any
  // never-cached route opened with no connection.
  additionalPrecacheEntries: [{ url: "/offline", revision: "1" }],
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // `next dev` runs on Turbopack; only `next build --webpack` uses webpack (where
  // Serwist generates the service worker — Serwist is disabled in dev). The
  // @serwist/next wrapper still attaches a webpack config, which makes Turbopack
  // error with "webpack config and no turbopack config". An explicit empty
  // turbopack config silences that and lets `npm run dev` run, as Next recommends.
  turbopack: {},
  // Renamed from experimental.serverComponentsExternalPackages in Next 15+.
  // All server-only — keeps them out of the bundle (esp. the very large
  // googleapis) and guards against an accidental client import.
  serverExternalPackages: ["@google/generative-ai", "googleapis", "zod"],
  // Transpile the Supabase client packages. They ship ES2022 class static blocks
  // (`static { ... }`) that Safari < 16.4 (e.g. iOS 16.2) cannot parse — which
  // crashes the client bundle on older iOS: React never hydrates, so buttons are
  // dead while native inputs still accept text. Next skips node_modules by
  // default; listing these runs them through SWC, downleveled to the browserslist
  // target (which includes iOS 15), so the syntax is lowered for old WebKit.
  transpilePackages: [
    "@supabase/supabase-js",
    "@supabase/auth-js",
    "@supabase/storage-js",
    "@supabase/postgrest-js",
    "@supabase/realtime-js",
    "@supabase/functions-js",
    "@supabase/ssr",
  ],
  experimental: {
    // Next's default is { dynamic: 0, static: 300 } — with dynamic:0 the client
    // router cache is OFF for dynamic routes, so a prefetched /people/[id] still
    // does a server roundtrip on tap and shows the full-screen loading.tsx aura.
    // Caching dynamic segments lets a tapped (prefetched) person open instantly
    // from the router cache, no roundtrip, no loader. Safe here because the
    // person route shell is data-free: PersonDetail loads data from IndexedDB and
    // refreshes from /api on mount, so a cached shell can never show stale data.
    staleTimes: { dynamic: 300, static: 300 },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSerwist(nextConfig);
