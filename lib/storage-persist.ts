// Ask the OS to keep our IndexedDB persistent so it isn't evicted under storage
// pressure. Best-effort and idempotent; supported on Chromium (Android WebView)
// and modern browsers. A no-op where the API is missing.

export async function ensurePersistentStorage(): Promise<void> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return;
    if (await navigator.storage.persisted()) return;
    await navigator.storage.persist();
  } catch {
    /* best-effort — eviction is still unlikely on a native WebView */
  }
}
