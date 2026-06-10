"use client";

// Home people list, rendered from the local store so it works offline and
// reflects queued edits/deletes instantly. Seeded by the server snapshot
// (initialPeople) on each online load.

import { useEffect, useState } from "react";
import Link from "next/link";
import { PeopleGrid } from "@/components/PeopleGrid";
import { UpcomingMeetingAlert } from "@/components/UpcomingMeetingAlert";
import { T } from "@/components/T";
import {
  cachePeople,
  cacheConnectionFlag,
  cacheProfile,
  getCachedPeople,
  subscribeOffline,
  type CachedProfile,
} from "@/lib/offline-cache";
import type { PersonFull } from "@/types/app";

interface Props {
  initialPeople: PersonFull[];
  hasCalendarConnection: boolean;
  initialProfile: CachedProfile;
}

// Fixed routes (besides each person) that must open with no network. Home is the
// app's entry point, so warming them here caches account/meet/calendar for offline
// use just like people (deferred + deduped per session — see warmPaths below).
const WARM_ROUTES = ["/meet", "/account", "/calendar"];

// Dedup warming across mounts so the offline cache-fill runs at most once per
// session — not a fresh N+3 burst every time the user returns to the home screen.
const warmed = new Set<string>();

// Warm the SW cache with each path's FULL RSC payload, a few at a time, so the
// background fill never competes with the foreground (hydration + the first tap).
async function warmPaths(paths: string[], concurrency: number): Promise<void> {
  const queue = paths.filter((p) => !warmed.has(p));
  let i = 0;
  const worker = async (): Promise<void> => {
    while (i < queue.length) {
      const path = queue[i++];
      if (warmed.has(path)) continue;
      warmed.add(path);
      try {
        await fetch(path, { headers: { RSC: "1" } });
      } catch {
        warmed.delete(path); // transient failure — let a later attempt retry
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, worker),
  );
}

export function PeopleListClient({
  initialPeople,
  hasCalendarConnection,
  initialProfile,
}: Props) {
  const [people, setPeople] = useState<PersonFull[]>(initialPeople);

  // Snapshot the connection flag + user profile so the calendar and account
  // pages render offline without a server fetch. This online home load is the
  // single writer for both.
  useEffect(() => {
    void cacheConnectionFlag(hasCalendarConnection);
    void cacheProfile(initialProfile);
  }, [hasCalendarConnection, initialProfile]);

  useEffect(() => {
    let active = true;
    // Snapshot the server data into the store (skipped if writes are pending).
    void cachePeople(initialPeople);

    const load = async () => {
      const cached = await getCachedPeople();
      if (active && cached.length) setPeople(cached);
    };
    void load();

    const unsub = subscribeOffline(load);
    return () => {
      active = false;
      unsub();
    };
  }, [initialPeople]);

  // Warm the SW cache with every person's (and key route's) FULL RSC payload while
  // online, so each opens with no network. We fetch the RSC directly (RSC:1, no
  // prefetch/segment headers) so the server returns the full render, which the SW
  // stores in `pages-rsc-full-v2`. (`router.prefetch` can emit only a tiny
  // segment-tree partial, which the SW skips, so a plain RSC fetch is the reliable
  // way to cache the whole page.)
  //
  // Deferred + throttled: wait until the home is painted/interactive, then warm a
  // couple at a time, so the cache-fill never competes with hydration or the
  // user's first tap. `warmed` is module-scoped, so this runs at most once per
  // session instead of re-bursting on every return to home. Skipped offline.
  useEffect(() => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const paths = [...people.map((p) => `/people/${p.id}`), ...WARM_ROUTES];
    const t = setTimeout(() => void warmPaths(paths, 2), 1000);
    return () => clearTimeout(t);
  }, [people]);

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      {hasCalendarConnection && people.length > 0 && <UpcomingMeetingAlert />}

      {people.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-5">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #d0f2ff, #dccaff)" }}
          >
            <span className="text-4xl">👋</span>
          </div>
          <div>
            <p
              className="text-[22px] uppercase text-black"
              style={{ fontFamily: "'Hammersmith One', sans-serif" }}
            >
              <T k="home.empty_title" />
            </p>
            <p className="text-[13px] mt-2 max-w-xs" style={{ color: "#5e7983" }}>
              <T k="home.empty_body" />
            </p>
          </div>
          <Link
            href="/meet"
            className="h-12 px-8 rounded-[10px_2px_10px_2px] text-white flex items-center gap-2 transition-opacity active:opacity-80"
            style={{ background: "linear-gradient(to right, #284e72, #482d7c)" }}
          >
            <span style={{ fontFamily: "'Hammersmith One', sans-serif" }}>
              <T k="home.log_first" />
            </span>
          </Link>
        </div>
      ) : (
        <PeopleGrid people={people} />
      )}
    </div>
  );
}
