// Serwist service worker (compiled to public/sw.js at build time).
// Precaches the Next.js app shell and caches App Router navigations so
// RememberOne opens offline, shows cached people/data, and lets you move
// between pages with no network. See next.config.mjs.
//
// The triple-slash header swaps in the WebWorker lib for this file only; the
// file is excluded from the app tsconfig (Serwist compiles it on its own).
/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { ExpirationPlugin, Serwist, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected by @serwist/next at build time.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// ── App Router navigation caching ────────────────────────────────────────
// Next.js navigation arrives as three distinct request types. The default
// strategy (NetworkFirst) fails offline; StaleWhileRevalidate serves instantly
// from cache (and refreshes in the background when online). Because Next
// prefetches every <Link> in the viewport, caching RSC-PREFETCH requests means
// person pages get cached just by scrolling the people list — so you can open
// and navigate them offline without having visited each one first.
const pageExpiration = () => [
  new ExpirationPlugin({ maxEntries: 256, maxAgeSeconds: 7 * 24 * 60 * 60 }),
];

const navigationCaching: RuntimeCaching[] = [
  // 1. RSC prefetch (hovering / link in viewport): RSC=1 + Next-Router-Prefetch=1
  {
    matcher: ({ request, url: { pathname }, sameOrigin }) =>
      sameOrigin &&
      !pathname.startsWith("/api/") &&
      request.headers.get("RSC") === "1" &&
      request.headers.get("Next-Router-Prefetch") === "1",
    handler: new StaleWhileRevalidate({
      cacheName: "pages-rsc-prefetch",
      plugins: pageExpiration(),
    }),
  },
  // 2. RSC navigation (actual click): RSC=1
  {
    matcher: ({ request, url: { pathname }, sameOrigin }) =>
      sameOrigin &&
      !pathname.startsWith("/api/") &&
      request.headers.get("RSC") === "1",
    handler: new StaleWhileRevalidate({
      cacheName: "pages-rsc",
      plugins: pageExpiration(),
    }),
  },
  // 3. Full-page document navigation (first load / hard refresh / cold launch)
  {
    matcher: ({ request, url: { pathname }, sameOrigin }) =>
      sameOrigin &&
      !pathname.startsWith("/api/") &&
      request.destination === "document",
    handler: new StaleWhileRevalidate({
      cacheName: "pages",
      plugins: pageExpiration(),
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  // We serve navigations from cache (SWR), so navigation preload would be wasted.
  navigationPreload: false,
  // Custom navigation rules first; defaultCache still covers /_next/static,
  // images, fonts, etc.
  runtimeCaching: [...navigationCaching, ...defaultCache],
  // For a document request that has never been cached (e.g. a route whose link
  // never appeared online), show the offline page instead of a browser error.
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
