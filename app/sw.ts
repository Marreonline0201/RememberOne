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
// Next.js navigation arrives as RSC requests (prefetch + click) and full
// document loads. The default strategy (NetworkFirst) fails offline;
// StaleWhileRevalidate serves instantly from cache (and refreshes in the
// background when online). Prefetch and navigation RSC share ONE cache so a
// route prefetched online (every <Link> here uses full prefetch) is served on
// an offline tap — that's what lets person/account/meet open with no network.
const pageExpiration = () => [
  new ExpirationPlugin({ maxEntries: 256, maxAgeSeconds: 7 * 24 * 60 * 60 }),
];

const navigationCaching: RuntimeCaching[] = [
  // 1. RSC requests — BOTH prefetch (RSC=1 + Next-Router-Prefetch=1) and actual
  //    navigation (RSC=1) into ONE cache. They MUST share: Next writes a
  //    prefetch and reads a navigation, so caching them separately means a
  //    prefetched page is never served for an offline tap (exactly why
  //    person/account/meet showed the offline page). A single RSC=1 matcher
  //    catches both. Links use full prefetch, so the cached RSC is the real
  //    page, not a loading-shell partial.
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
  // 2. Full-page document navigation (first load / hard refresh / cold launch)
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
