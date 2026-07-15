"use client";

// Persisted set of EXPANDED home-card person ids (device-local display
// preference, deliberately localStorage — same philosophy as use-dismiss-flag:
// a metadata write would be lost offline, and this is per-device anyway).
//
// Cards default COLLAPSED (name + last-met only); tapping the chevron expands
// a card and remembers it here. Absent-from-set = collapsed, which also makes
// the SSR/pre-hydration frame collapsed — the list only ever grows after
// hydration, never jarringly shrinks.
//
// One instance lives in PeopleGrid and hands plain props to each card: a
// single storage read, one source of truth, no cross-card sync problem.

import { useCallback, useEffect, useRef, useState } from "react";

export const HOME_EXPANDED_KEY = "ro.home.expanded";

function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x): x is string => typeof x === "string"));
    }
  } catch {
    /* malformed / storage unavailable */
  }
  return new Set();
}

function writeSet(key: string, set: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* quota / privacy mode — expansion just won't persist */
  }
}

export function usePersistedIdSet(key: string) {
  const [set, setSet] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    setSet(readSet(key));
    setHydrated(true);
  }, [key]);

  const has = useCallback((id: string) => set.has(id), [set]);

  const toggle = useCallback((id: string) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeSet(keyRef.current, next);
      return next;
    });
  }, []);

  // Drop ids of people that no longer exist so the stored set stays bounded.
  // Only ever removes; writes only when something actually changed.
  const prune = useCallback((validIds: string[]) => {
    const valid = new Set(validIds);
    setSet((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
        else changed = true;
      }
      if (!changed) return prev;
      writeSet(keyRef.current, next);
      return next;
    });
  }, []);

  return { has, toggle, prune, hydrated };
}
