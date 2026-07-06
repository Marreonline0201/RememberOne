// Scopes ALL device-local state to the signed-in user.
//
// Every layer of local persistence (IndexedDB people/outbox/meta, the native
// snapshot file, the SW page caches) is per-DEVICE, not per-user. Signing out
// only clears the auth session, so signing in with a DIFFERENT account on the
// same device used to inherit the previous account's people, profile, and
// pending writes — B saw A's contacts merged into their list, and A's queued
// offline edits replayed under B's session.
//
// Fix: stamp the store with its owner (META "ownerUserId"). On every
// authenticated mount, ensureOfflineOwner(userId) compares the stamp to the
// current user and — on mismatch — wipes every local layer before anything
// reads or writes it. Callers that touch the cache await the same in-flight
// gate (whenOwnerSettled), so the check runs once per user per JS session.

import {
  clearOfflineData,
  getCachedProfile,
  getOwnerMeta,
  setOwnerMeta,
} from "@/lib/offline-cache";
import { deleteSnapshot, setSnapshotOwner } from "@/lib/offline-snapshot";

let gateForUser: string | null = null;
let gate: Promise<void> | null = null;

// Drop every SW page cache (ours + Serwist's page-level defaults). A cached
// document/RSC render is the previous user's personal data; deleting is always
// safe — caches refill on the next online visit.
async function clearSwPageCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const names = await caches.keys();
    const doomed = names.filter(
      (n) =>
        n.startsWith("ro-pages-") ||
        n === "pages" ||
        n === "pages-rsc" ||
        n === "pages-rsc-prefetch"
    );
    await Promise.all(doomed.map((n) => caches.delete(n)));
  } catch {
    /* Cache API unavailable (http, old WebView) — nothing cached there anyway */
  }
}

// Full local scrub — shared by the owner-change path and explicit sign-out.
export async function wipeLocalUserData(): Promise<void> {
  await clearOfflineData(); // people + outbox + meta (incl. profile/owner)
  await deleteSnapshot(); // native durable file (cancels pending writes too)
  await clearSwPageCaches();
}

/**
 * Ensure the local store belongs to `userId`, wiping it first if a different
 * account owned it. Memoized per user per JS session; concurrent callers share
 * one check. MUST be awaited before reading or writing any cached user data.
 *
 * `email` (when known) covers the migration window: stores written by builds
 * that predate owner stamping have no owner meta, but their cached profile
 * still says whose data it is — a mismatch there wipes too.
 */
export function ensureOfflineOwner(userId: string, email?: string | null): Promise<void> {
  if (gate && gateForUser === userId) return gate;
  gateForUser = userId;
  gate = (async () => {
    setSnapshotOwner(userId); // snapshots written from now on carry this owner
    const prev = await getOwnerMeta();
    if (prev !== userId) {
      if (prev !== null) {
        await wipeLocalUserData(); // different account owned this device
      } else {
        // Unstamped store (pre-fix build). If the cached profile visibly
        // belongs to someone else, it's the previous account's data — wipe.
        const prof = await getCachedProfile();
        if (prof?.email && email && prof.email !== email) {
          await wipeLocalUserData();
        }
      }
      await setOwnerMeta(userId);
    }
  })();
  return gate;
}

/**
 * Await any in-flight owner check without knowing the user id. Resolves
 * immediately when none has started (SSR, unauthenticated pages).
 */
export function whenOwnerSettled(): Promise<void> {
  return gate ?? Promise.resolve();
}
