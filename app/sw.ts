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

// ── Per-build cache version ──────────────────────────────────────────────
// The navigation caches below hold App Router page shells. A shell references
// the build's client-chunk filenames, so a shell cached by build A renders
// BLANK if served into build B (B's chunks have different hashed names). To
// avoid serving a cross-build-stale shell after a deploy, the cache names carry
// a per-build revision derived from the injected precache manifest — which
// includes the content-hashed _next/static/chunks/* and the Next build id, so
// it changes on exactly the builds that change client chunks. A new build thus
// starts with an EMPTY page cache and fetches the matching shell from the
// network (online), instead of the previous build's broken one.
function buildRev(manifest: (PrecacheEntry | string)[] | undefined): string {
  if (!manifest || manifest.length === 0) return "dev";
  let acc = "";
  for (const e of manifest) {
    acc += typeof e === "string" ? e : `${e.url}:${e.revision ?? ""}`;
  }
  // FNV-1a 32-bit → base36. Math.imul keeps the multiply 32-bit.
  let h = 0x811c9dc5;
  for (let i = 0; i < acc.length; i++) {
    h ^= acc.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
// Read the injected manifest ONCE — the Serwist build replaces the single
// `self.__SW_MANIFEST` token, and it errors if the token appears more than once.
const swManifest = self.__SW_MANIFEST;
// `ro-` prefix keeps OUR cache names clear of Serwist's defaultCache, which
// already owns `pages`, `pages-rsc`, and `pages-rsc-prefetch` — so the activate
// cleanup below can match `ro-pages-*` and never touch a Serwist-managed cache.
const REV = buildRev(swManifest);
const RSC_CACHE = `ro-pages-rsc-${REV}`;
const DOC_CACHE = `ro-pages-doc-${REV}`;

// ── App Router navigation caching ────────────────────────────────────────
// Next.js navigation arrives as RSC requests and full document loads. The
// default strategy (NetworkFirst) fails offline; StaleWhileRevalidate serves
// instantly from cache (and refreshes in the background when online).
const pageExpiration = () => [
  new ExpirationPlugin({ maxEntries: 256, maxAgeSeconds: 7 * 24 * 60 * 60 }),
];

const navigationCaching: RuntimeCaching[] = [
  // 1. App Router RSC navigation. Next sends several RSC request shapes per
  //    route: a real NAVIGATION (RSC=1, no prefetch header — the FULL render), a
  //    FULL-page prefetch (RSC=1, Next-Router-Prefetch=1 — which for a route
  //    with a loading.tsx is only the PARTIAL loading shell), and a tiny
  //    SEGMENT-tree prefetch (Next-Router-Segment-Prefetch present, ~300B). We
  //    cache ONLY real navigations (and the offline warmer, which fetches with a
  //    bare RSC=1 header and no prefetch header — see lib/offline-warm.ts), so a
  //    route opened/warmed online is served on an offline tap. Both prefetch
  //    shapes are EXCLUDED: a prefetch can be a partial loading shell, and with
  //    ignoreVary below it would otherwise be handed back on a real navigation as
  //    a blank/never-resolving content area (the intermittent "white screen on
  //    screen change"). They're a perf hint Next keeps in its own router cache
  //    anyway; not caching them in the SW costs nothing.
  //
  //    matchOptions ignoreSearch+ignoreVary are REQUIRED, not cosmetic: a real
  //    navigation's URL carries a different `_rsc` token and its router headers
  //    differ between requests, and RSC responses `Vary` on those headers
  //    (rsc, next-router-state-tree, next-router-prefetch, …) — so an exact match
  //    MISSES offline (verified at the Cache API layer: only ignoreSearch+
  //    ignoreVary hits). Ignoring both serves the path's cached full render for
  //    any RSC request to it. Safe ONLY because no prefetch/partial ever enters
  //    this cache — otherwise ignoreVary could hand back a partial shell.
  {
    matcher: ({ request, url: { pathname }, sameOrigin }) =>
      sameOrigin &&
      !pathname.startsWith("/api/") &&
      request.headers.get("RSC") === "1" &&
      !request.headers.has("Next-Router-Prefetch") &&
      !request.headers.has("Next-Router-Segment-Prefetch"),
    handler: new StaleWhileRevalidate({
      // Per-build name (see buildRev): a new deploy starts fresh so a stale
      // cross-build shell can never be served (it would render blank).
      cacheName: RSC_CACHE,
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
      cacheName: DOC_CACHE,
      plugins: pageExpiration(),
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: swManifest,
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

// On activate, drop every page cache that isn't THIS build's, so a stale
// cross-build shell can't be served and old per-build caches don't accumulate.
// We only ever delete OUR caches: the current `ro-pages-*` scheme (any earlier
// build's `ro-pages-rsc-*`/`ro-pages-doc-*`) plus our own pre-rename names
// (`pages-rsc-full`, `pages-rsc-full-v2`). We deliberately do NOT touch
// Serwist's `pages` / `pages-rsc` / `pages-rsc-prefetch` defaultCache caches.
// (Our old doc cache was literally `pages`, shared with Serwist's — it's now
// shadowed by the new matcher and left to Serwist's expiration, never served.)
const OWN_LEGACY_CACHES = ["pages-rsc-full", "pages-rsc-full-v2"];
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([RSC_CACHE, DOC_CACHE]);
      const names = await caches.keys();
      const stale = names.filter(
        (n) =>
          !keep.has(n) &&
          (n.startsWith("ro-pages-") || OWN_LEGACY_CACHES.includes(n)),
      );
      await Promise.all(stale.map((n) => caches.delete(n)));
    })().catch(() => false),
  );
});

serwist.addEventListeners();
