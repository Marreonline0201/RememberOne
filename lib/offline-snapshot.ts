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
//   - OWNER-STAMPED (v2): the file records whose data it holds and is restored
//     only for that same user. Without this, signing in with a different
//     account after an IndexedDB wipe resurrected the previous account's
//     people from the file (cross-account leak). v1 files (no owner) are
//     never restored.

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
  v: 1 | 2;
  userId?: string; // v2+ — owner of the data; restore requires a match
  people: PersonFull[];
  profile: CachedProfile | null;
  connectionFlag: boolean | null;
  calendar: CachedCalendar | null;
}

// Whose data writeSnapshot may persist. Set by ensureOfflineOwner() before any
// cache activity; while null (pre-auth) writes are skipped entirely.
let snapshotOwner: string | null = null;
export function setSnapshotOwner(userId: string): void {
  snapshotOwner = userId;
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
  if (!snapshotOwner) return; // owner unknown — never write unattributed data
  if (!(await isNative())) return;
  try {
    const snapshot: Snapshot = {
      v: 2,
      userId: snapshotOwner,
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

// Remove the durable file (owner switch / sign-out / account deletion) and
// cancel any pending debounced write so the old owner's data can't be
// re-persisted right after the wipe.
export async function deleteSnapshot(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!(await isNative())) return;
  try {
    const { Filesystem, Directory } = await fs();
    await Filesystem.deleteFile({ path: FILE, directory: Directory.Data });
  } catch {
    /* no file / already gone — fine */
  }
}

// ── Restore (empty-gated, owner-gated, one-way) ────────────────────────────
export async function restoreSnapshotIfEmpty(userId: string): Promise<void> {
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
    // Owner gate: only ever restore the CURRENT user's own data. v1 files have
    // no owner stamp — treat them as unknown and skip (the next online load
    // rewrites the file as v2).
    if (snap.v !== 2 || snap.userId !== userId) return;
    // Outbox is empty here (the DB was wiped), so cachePeople clears + puts all.
    await cachePeople(snap.people);
    if (snap.profile) await cacheProfile(snap.profile);
    if (snap.connectionFlag != null) await cacheConnectionFlag(snap.connectionFlag);
    if (snap.calendar) await cacheCalendarEvents(snap.calendar);
  } catch (e) {
    console.warn("[offline] restoreSnapshotIfEmpty failed:", e);
  }
}
