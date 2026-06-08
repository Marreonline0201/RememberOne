"use client";

// Snapshots the full people list (already loaded by the home server component)
// into IndexedDB whenever it changes, so person-detail pages can render offline.

import { useEffect } from "react";
import { cachePeople } from "@/lib/offline-cache";
import type { PersonFull } from "@/types/app";

export function CachePeopleSync({ people }: { people: PersonFull[] }) {
  useEffect(() => {
    void cachePeople(people);
  }, [people]);
  return null;
}
