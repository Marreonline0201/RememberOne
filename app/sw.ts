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
// Next.js navigation arrives as RSC requests and full document loads. The
// default strategy (NetworkFirst) fails offline; StaleWhileRevalidate serves
// instantly from cache (and refreshes in the background when online).
const pageExpiration = () => [
  new ExpirationPlugin({ maxEntries: 256, maxAgeSeconds: 7 * 24 * 60 * 60 }),
];

const navigationCaching: RuntimeCaching[] = [
  // 1. App Router RSC navigation. Next sends three RSC request shapes per route:
  //    a FULL-page prefetch (RSC=1, Next-Router-Prefetch=1), a real NAVIGATION
  //    (RSC=1, no prefetch), and a tiny SEGMENT-tree prefetch
  //    (Next-Router-Segment-Prefetch present, ~300B — NOT the full page). We
  //    cache only the full ones (segment prefetches are excluded by the matcher)
  //    in ONE cache, so a route warmed online is served on an offline tap —
  //    that's what lets person/account/meet open with no network.
  //
  //    matchOptions ignoreSearch+ignoreVary are REQUIRED, not cosmetic: a real
  //    navigation's URL carries a different `_rsc` token and its router headers
  //    differ from the cached prefetch, and RSC responses `Vary` on those headers
  //    (rsc, next-router-state-tree, next-router-prefetch, …) — so an exact match
  //    MISSES offline (verified at the Cache API layer: only ignoreSearch+
  //    ignoreVary hits). Ignoring both serves the path's cached full render for
  //    any RSC request to it. Safe ONLY because segment-tree partials never enter
  //    this cache — otherwise ignoreVary could hand back a ~300B loading shell
  //    that never resolves offline.
  {
    matcher: ({ request, url: { pathname }, sameOrigin }) =>
      sameOrigin &&
      !pathname.startsWith("/api/") &&
      request.headers.get("RSC") === "1" &&
      !request.headers.has("Next-Router-Segment-Prefetch"),
    handler: new StaleWhileRevalidate({
      // -v2: bumped when the cached shells changed shape (calendar/account/meet
      // became data-free client shells) so stale server-data RSCs aren't served.
      cacheName: "pages-rsc-full-v2",
      matchOptions: { ignoreSearch: true, ignoreVary: true },
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

// Drop legacy navigation caches from earlier SW versions so a stale entry can't
// be served offline: `pages-rsc` (pre-unify, could hold loading-shell partials)
// and `pages-rsc-full` (held calendar/account/meet RSCs with server data baked
// in, before they became data-free client shells). The current SW reads/writes
// `pages-rsc-full-v2`, so the first online load after this update re-warms the
// new shells instead of serving stale server-rendered HTML.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.delete("pages-rsc"),
      caches.delete("pages-rsc-full"),
    ]).catch(() => false),
  );
});

serwist.addEventListeners();
