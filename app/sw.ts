// Serwist service worker (compiled to public/sw.js at build time).
// Precaches the Next.js app shell and runtime-caches navigations so RememberOne
// opens offline and shows the last-loaded pages/data. See next.config.mjs.
//
// This file is excluded from the app's tsconfig (Serwist compiles it on its own
// via the next.config swSrc entry), so the webworker `self` typing below does not
// leak into — or conflict with — the main app's DOM types.
/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected by @serwist/next at build time.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Next.js-aware runtime caching (static assets, RSC, pages). Combined with
  // cacheOnNavigation, visited routes render from cache when offline.
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
