"use client";

// The single client entry point for the group catalog + group CRUD.
//
// Reads are offline-first: cached META "groups" renders immediately, then an
// online fetch of /api/groups refreshes it. Every hook instance subscribes to
// the offline notifier, so a change made through any instance (or by the sync
// layer) fans out to all of them.
//
// CRUD (create/rename/delete) is ONLINE-ONLY for v1 — queuing a create offline
// would need temp-id reconciliation in the outbox for a rare flow (consistent
// with the AI features being online-only). Membership ASSIGNMENT is offline-
// capable and lives elsewhere (queuedFetch PUT /api/people/[id]/groups).

import { useCallback, useEffect, useState } from "react";
import {
  getCachedGroups,
  cacheGroups,
  getCachedPeople,
  cachePerson,
  subscribeOffline,
} from "@/lib/offline-cache";
import { whenOwnerSettled } from "@/lib/offline-owner";
import type { Group } from "@/types/database";

// Thrown as Error(message) sentinels; UIs map them to i18n strings.
export const GROUPS_ERR_OFFLINE = "offline";
export const GROUPS_ERR_DUPLICATE = "duplicate";

function sortByName(groups: Group[]): Group[] {
  return [...groups].sort((a, b) => a.name.localeCompare(b.name));
}

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

async function readError(res: Response): Promise<string> {
  try {
    const j = await res.json();
    if (j?.error === "duplicate_group_name") return GROUPS_ERR_DUPLICATE;
    if (typeof j?.error === "string") return j.error;
  } catch {
    /* non-JSON body */
  }
  return `Request failed (${res.status})`;
}

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    if (!isOnline()) return;
    try {
      const res = await fetch("/api/groups", { cache: "no-store" });
      if (!res.ok) return;
      const { data } = await res.json();
      if (Array.isArray(data)) {
        await cacheGroups(data); // notifier updates every hook instance
      }
    } catch {
      /* network blip — cached list stands */
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadFromCache = async () => {
      const cached = await getCachedGroups();
      if (!active) return;
      setGroups(sortByName(cached ?? []));
      setHydrated(true);
    };

    (async () => {
      // Never read (or refresh into) another account's cache mid-wipe.
      await whenOwnerSettled();
      await loadFromCache();
      await refresh();
    })();

    const unsub = subscribeOffline(loadFromCache);
    return () => {
      active = false;
      unsub();
    };
  }, [refresh]);

  const createGroup = useCallback(
    async (name: string, description?: string | null): Promise<Group> => {
      if (!isOnline()) throw new Error(GROUPS_ERR_OFFLINE);
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description ?? null }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const { data } = await res.json();
      const cached = (await getCachedGroups()) ?? [];
      await cacheGroups([...cached, data]);
      return data as Group;
    },
    []
  );

  const updateGroup = useCallback(
    async (
      id: string,
      patch: { name?: string; description?: string | null }
    ): Promise<Group> => {
      if (!isOnline()) throw new Error(GROUPS_ERR_OFFLINE);
      const res = await fetch(`/api/groups/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await readError(res));
      const { data } = await res.json();
      const cached = (await getCachedGroups()) ?? [];
      await cacheGroups(cached.map((g) => (g.id === id ? (data as Group) : g)));
      return data as Group;
    },
    []
  );

  const deleteGroup = useCallback(async (id: string): Promise<void> => {
    if (!isOnline()) throw new Error(GROUPS_ERR_OFFLINE);
    const res = await fetch(`/api/groups/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await readError(res));
    const cached = (await getCachedGroups()) ?? [];
    await cacheGroups(cached.filter((g) => g.id !== id));
    // Scrub the dead id from cached people immediately (server side is handled
    // by the FK cascade) so offline copies never show a phantom membership.
    const people = await getCachedPeople();
    for (const p of people) {
      if ((p.group_ids ?? []).includes(id)) {
        await cachePerson({
          ...p,
          group_ids: (p.group_ids ?? []).filter((g) => g !== id),
        });
      }
    }
  }, []);

  return { groups, hydrated, refresh, createGroup, updateGroup, deleteGroup };
}
