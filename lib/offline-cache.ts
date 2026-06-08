// Client-side offline store (IndexedDB via idb).
//
// Two stores:
//   people  — full PersonFull objects; the UI's source of truth offline.
//   outbox  — queued writes ({method,url,body}) waiting to replay to the API
//             when back online.
//
// A tiny change-notifier lets read views (home list, person detail) re-render
// whenever the local data changes (optimistic edits, sync, refresh).

import { openDB, type IDBPDatabase } from "idb";
import type { PersonFull } from "@/types/app";

const DB_NAME = "rememberone-offline";
const DB_VERSION = 2;
const PEOPLE = "people";
const OUTBOX = "outbox";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> | null {
  if (typeof indexedDB === "undefined") return null; // SSR / unsupported
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PEOPLE)) {
          db.createObjectStore(PEOPLE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(OUTBOX)) {
          db.createObjectStore(OUTBOX, { keyPath: "seq", autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

// ── Change notifier ──────────────────────────────────────────────────────
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeOffline(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function notifyOfflineChange(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore listener errors */
    }
  });
}

// ── Outbox (pending writes) ──────────────────────────────────────────────
export interface OutboxItem {
  seq?: number; // auto-assigned
  method: string;
  url: string;
  body?: unknown;
  createdAt: number;
}

export async function enqueue(item: Omit<OutboxItem, "seq">): Promise<void> {
  const dbp = getDB();
  if (!dbp) return;
  try {
    const db = await dbp;
    await db.add(OUTBOX, item);
    notifyOfflineChange(); // update the "N pending" indicator
  } catch (e) {
    console.warn("[offline] enqueue failed:", e);
  }
}

export async function getOutbox(): Promise<OutboxItem[]> {
  const dbp = getDB();
  if (!dbp) return [];
  try {
    const db = await dbp;
    const all = (await db.getAll(OUTBOX)) as OutboxItem[];
    return all.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  } catch {
    return [];
  }
}

export async function removeFromOutbox(seq: number): Promise<void> {
  const dbp = getDB();
  if (!dbp) return;
  try {
    const db = await dbp;
    await db.delete(OUTBOX, seq);
  } catch (e) {
    console.warn("[offline] removeFromOutbox failed:", e);
  }
}

export async function outboxCount(): Promise<number> {
  const dbp = getDB();
  if (!dbp) return 0;
  try {
    const db = await dbp;
    return await db.count(OUTBOX);
  } catch {
    return 0;
  }
}

// ── People ───────────────────────────────────────────────────────────────
// Full snapshot from the server (home load). Skipped while writes are pending
// so a server snapshot can't clobber un-synced optimistic edits.
export async function cachePeople(people: PersonFull[]): Promise<void> {
  const dbp = getDB();
  if (!dbp) return;
  try {
    if ((await outboxCount()) > 0) return; // local edits are ahead of the server
    const db = await dbp;
    const tx = db.transaction(PEOPLE, "readwrite");
    await tx.store.clear();
    for (const p of people) await tx.store.put(p);
    await tx.done;
    notifyOfflineChange();
  } catch (e) {
    console.warn("[offline] cachePeople failed:", e);
  }
}

export async function cachePerson(person: PersonFull): Promise<void> {
  const dbp = getDB();
  if (!dbp) return;
  try {
    const db = await dbp;
    await db.put(PEOPLE, person);
    notifyOfflineChange();
  } catch (e) {
    console.warn("[offline] cachePerson failed:", e);
  }
}

export async function getCachedPeople(): Promise<PersonFull[]> {
  const dbp = getDB();
  if (!dbp) return [];
  try {
    const db = await dbp;
    return (await db.getAll(PEOPLE)) as PersonFull[];
  } catch {
    return [];
  }
}

export async function getCachedPerson(id: string): Promise<PersonFull | null> {
  const dbp = getDB();
  if (!dbp) return null;
  try {
    const db = await dbp;
    return ((await db.get(PEOPLE, id)) as PersonFull | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function removeCachedPerson(id: string): Promise<void> {
  const dbp = getDB();
  if (!dbp) return;
  try {
    const db = await dbp;
    await db.delete(PEOPLE, id);
    notifyOfflineChange();
  } catch (e) {
    console.warn("[offline] removeCachedPerson failed:", e);
  }
}
