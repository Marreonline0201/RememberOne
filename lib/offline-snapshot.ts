// Durable snapshot of the offline READ MODEL (people + meta singletons) to a
// native file, so the user's data survives IndexedDB eviction / reinstall.
//
// Design notes:
//   - We NEVER snapshot the outbox — restoring already-flushed writes would
//     duplicate them. The snapshot is read-model durability, not write-queue
//     durability.
//   - IndexedDB stays the single source of truth. The file is a ONE-WAY fallback,
//     restored only when IndexedDB is empty (eviction / fresh install / clear).
//     Empty-gated restore + a write that trails IndexedDB ⇒ the two never race.
//   - Native-only (Capacitor Filesystem). Web is a no-op.

import {
  getCachedPeople,
  getCachedProfile,
  getCachedConnectionFlag,
  getCachedCalendarEvents,
  cachePeople,
  cacheProfile,
  cacheConnectionFlag,
  cacheCalendarEvents,
  type CachedProfile,
  type CachedCalendar,
} from "@/lib/offline-cache";
import type { PersonFull } from "@/types/app";

const FILE = "ro-snapshot.json";

interface Snapshot {
  v: 1;
  people: PersonFull[];
  profile: CachedProfile | null;
  connectionFlag: boolean | null;
  calendar: CachedCalendar | null;
}

async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function fs() {
  const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
  return { Filesystem, Directory, Encoding };
}

// ── Write (debounced) ──────────────────────────────────────────────────────
let timer: ReturnType<typeof setTimeout> | null = null;

// Called on every local change (via subscribeOffline); coalesces bursts of
// edits into a single write a few seconds later.
export function scheduleSnapshot(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void writeSnapshot();
  }, 4000);
}

export async function writeSnapshot(): Promise<void> {
  if (!(await isNative())) return;
  try {
    const snapshot: Snapshot = {
      v: 1,
      people: await getCachedPeople(),
      profile: await getCachedProfile(),
      connectionFlag: await getCachedConnectionFlag(),
      calendar: await getCachedCalendarEvents(),
    };
    // Never overwrite a good snapshot with an empty one (e.g. a transient empty
    // read before the cache has loaded).
    if (snapshot.people.length === 0) return;
    const { Filesystem, Directory, Encoding } = await fs();
    await Filesystem.writeFile({
      path: FILE,
      data: JSON.stringify(snapshot),
      directory: Directory.Data, // app-private, persists (not Cache, which evicts)
      encoding: Encoding.UTF8,
    });
  } catch (e) {
    console.warn("[offline] writeSnapshot failed:", e);
  }
}

// ── Restore (empty-gated, one-way) ─────────────────────────────────────────
export async function restoreSnapshotIfEmpty(): Promise<void> {
  if (!(await isNative())) return;
  try {
    // Only restore when IndexedDB has no people — i.e. it was evicted/reinstalled.
    if ((await getCachedPeople()).length > 0) return;
    const { Filesystem, Directory, Encoding } = await fs();
    let raw: string;
    try {
      const res = await Filesystem.readFile({
        path: FILE,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      raw = typeof res.data === "string" ? res.data : await res.data.text();
    } catch {
      return; // no snapshot file yet
    }
    const snap = JSON.parse(raw) as Snapshot;
    if (!snap?.people?.length) return;
    // Outbox is empty here (the DB was wiped), so cachePeople clears + puts all.
    await cachePeople(snap.people);
    if (snap.profile) await cacheProfile(snap.profile);
    if (snap.connectionFlag != null) await cacheConnectionFlag(snap.connectionFlag);
    if (snap.calendar) await cacheCalendarEvents(snap.calendar);
  } catch (e) {
    console.warn("[offline] restoreSnapshotIfEmpty failed:", e);
  }
}
