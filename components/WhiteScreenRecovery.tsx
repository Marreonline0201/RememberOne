"use client";

// Auto-recovery for the intermittent "white content area" (top title + bottom
// nav stay, middle blank) that the Serwist service worker can produce on a
// screen change — either a chunk that fails to load, or a new service worker
// taking over the page mid-session. Both leave the chrome painted with empty
// content and do NOT reach React's error boundary, so they can't self-heal.
//
// This invisible component turns those into a single guarded reload, so the
// blank screen fixes itself instead of needing a manual re-navigation.

import { useEffect } from "react";

// Reload at most once per this window, so a build that is genuinely broken
// (e.g. a chunk truly missing from the server) reloads once and then falls
// through to app/error.tsx instead of looping forever.
const RELOAD_COOLDOWN_MS = 10_000;
const LAST_RELOAD_KEY = "ro:recovery:lastReload";

function reloadOnce(): void {
  try {
    const now = Date.now();
    const raw = sessionStorage.getItem(LAST_RELOAD_KEY);
    const last = raw ? Number(raw) : 0;
    if (Number.isFinite(last) && now - last < RELOAD_COOLDOWN_MS) {
      // A reload just happened and the failure recurred — stop, let it surface.
      return;
    }
    sessionStorage.setItem(LAST_RELOAD_KEY, String(now));
  } catch {
    // sessionStorage blocked/unavailable — fail safe by not reloading (a reload
    // loop with no cooldown guard would be worse than a single blank screen).
    return;
  }
  window.location.reload();
}

// A failed code-split chunk or dynamic import — the proximate cause of most of
// these blanks. Matches React/webpack and native dynamic-import messages.
function isChunkLoadError(value: unknown): boolean {
  if (!value) return false;
  const name = (value as { name?: unknown }).name;
  const message =
    typeof value === "string"
      ? value
      : ((value as { message?: unknown }).message ?? "");
  if (name === "ChunkLoadError") return true;
  const text = String(message);
  return (
    /Loading chunk [\d]+ failed/i.test(text) ||
    /Loading CSS chunk/i.test(text) ||
    /Failed to fetch dynamically imported module/i.test(text) ||
    /error loading dynamically imported module/i.test(text) ||
    /Importing a module script failed/i.test(text)
  );
}

export function WhiteScreenRecovery() {
  useEffect(() => {
    // (a) Service-worker takeover. With skipWaiting+clientsClaim, a freshly
    // deployed SW claims the already-open page; the running build and the SW's
    // caches can then disagree on chunk names -> blank on the next navigation.
    // Reloading the moment control changes lands the page on the new build.
    // Only when a controller already existed at mount: the FIRST install also
    // fires controllerchange (null -> SW) but the page is already current, so
    // reloading then would be a pointless flash on every first visit.
    const sw =
      typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
    const hadControllerAtMount = !!sw?.controller;

    const onControllerChange = () => {
      if (hadControllerAtMount) reloadOnce();
    };

    // (b) Chunk / dynamic-import load failures, from either channel. We do NOT
    // preventDefault, so if reloadOnce() is cooldown-blocked the error still
    // propagates to app/error.tsx ("Try again").
    const onError = (e: ErrorEvent) => {
      if (isChunkLoadError(e.error) || isChunkLoadError(e.message)) reloadOnce();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isChunkLoadError(e.reason)) reloadOnce();
    };

    sw?.addEventListener("controllerchange", onControllerChange);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      sw?.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
