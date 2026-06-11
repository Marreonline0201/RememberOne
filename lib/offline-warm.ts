"use client";

// Owns the offline cache "warming": fetching every person's + key route's FULL
// RSC payload while online so each opens with no network later. Lifted out of
// PeopleListClient so (a) warming progress can drive a UI (WarmingProgress) and
// (b) it runs at most once per session — module-scoped state survives remounts,
// and the SW cache persists across cold starts so repeat fetches resolve fast.
//
// Warm fetches use priority:"low" so the browser (Chromium / Android WebView)
// auto-yields the network to any foreground navigation — a tapped page loads
// first even while warming is in flight, with no manual abort/pause machinery.

export interface WarmProgress {
  done: number; // paths successfully warmed this session
  total: number; // paths requested this session
  active: boolean; // a warm run is currently in flight
}

const targets = new Set<string>();
const warmed = new Set<string>();
let runs = 0; // in-flight warmPaths calls

const listeners = new Set<(p: WarmProgress) => void>();

function snapshot(): WarmProgress {
  return { done: warmed.size, total: targets.size, active: runs > 0 };
}

function emit(): void {
  const p = snapshot();
  for (const fn of listeners) fn(p);
}

// Subscribe to warming progress; the current state is delivered immediately.
export function subscribeWarmProgress(fn: (p: WarmProgress) => void): () => void {
  listeners.add(fn);
  fn(snapshot());
  return () => {
    listeners.delete(fn);
  };
}

// `priority` is a real RequestInit field (fetch priority hints); widen locally in
// case the installed TS DOM lib doesn't include it yet.
type WarmInit = RequestInit & { priority?: "high" | "low" | "auto" };

// Warm each path's full RSC payload, a few at a time, low-priority. Idempotent
// and best-effort: already-warmed paths are skipped, failures stay unwarmed for a
// later retry, and the whole thing is a no-op offline.
export async function warmPaths(paths: string[], concurrency = 2): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  let added = false;
  for (const p of paths) {
    if (!targets.has(p)) {
      targets.add(p);
      added = true;
    }
  }
  if (added) emit();

  const queue = paths.filter((p) => !warmed.has(p));
  if (queue.length === 0) return;

  runs++;
  emit();
  let i = 0;
  const worker = async (): Promise<void> => {
    while (i < queue.length) {
      const path = queue[i++];
      if (warmed.has(path)) continue;
      try {
        await fetch(path, { headers: { RSC: "1" }, priority: "low" } as WarmInit);
        warmed.add(path);
      } catch {
        /* offline / transient — leave unwarmed so a later run retries */
      }
      emit();
    }
  };
  try {
    await Promise.all(
      Array.from({ length: Math.min(concurrency, queue.length) }, worker),
    );
  } finally {
    runs--;
    emit();
  }
}

// Re-run warming over the already-known targets (e.g. on app resume / warm start).
// Dedup means only still-unwarmed paths are fetched, so a fully-warm cache is a
// no-op — this finishes any incomplete coverage without re-fetching everything.
export function revalidateWarm(): void {
  if (targets.size > 0) void warmPaths([...targets], 2);
}
