// Client-side offline cache for people (IndexedDB via idb).
//
// The home page already loads every person with full nested data
// (getAllPeopleFull). We snapshot that into IndexedDB so the person-detail
// page can render ANY person offline — even ones never opened — by reading
// from this cache instead of the server.

import { openDB, type IDBPDatabase } from "idb";
import type { PersonFull } from "@/types/app";

const DB_NAME = "rememberone-offline";
const DB_VERSION = 1;
const STORE = "people";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> | null {
  if (typeof indexedDB === "undefined") return null; // SSR / unsupported
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

// Replace the whole snapshot with the latest full list (so deletions drop out).
export async function cachePeople(people: PersonFull[]): Promise<void> {
  const dbp = getDB();
  if (!dbp) return;
  try {
    const db = await dbp;
    const tx = db.transaction(STORE, "readwrite");
    await tx.store.clear();
    for (const p of people) await tx.store.put(p);
    await tx.done;
  } catch (e) {
    console.warn("[offline-cache] cachePeople failed:", e);
  }
}

// Upsert a single person (after a fresh online fetch of their detail).
export async function cachePerson(person: PersonFull): Promise<void> {
  const dbp = getDB();
  if (!dbp) return;
  try {
    const db = await dbp;
    await db.put(STORE, person);
  } catch (e) {
    console.warn("[offline-cache] cachePerson failed:", e);
  }
}

export async function getCachedPerson(id: string): Promise<PersonFull | null> {
  const dbp = getDB();
  if (!dbp) return null;
  try {
    const db = await dbp;
    return (await db.get(STORE, id)) ?? null;
  } catch (e) {
    console.warn("[offline-cache] getCachedPerson failed:", e);
    return null;
  }
}
