"use client";

// Home people list. First paints the server snapshot (initialPeople), then when
// online refreshes from /api/people?full=1 (which the SW + router caches never
// touch) so edits/new people show immediately. Offline it renders from the local
// store and reflects queued edits/deletes instantly.

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
  outboxCount,
  type CachedProfile,
} from "@/lib/offline-cache";
import type { PersonFull } from "@/types/app";
import { ensureOfflineOwner } from "@/lib/offline-owner";
import { warmPaths } from "@/lib/offline-warm";
import { WarmingProgress } from "@/components/WarmingProgress";
import { registerNotificationTapHandler } from "@/lib/meeting-notifications";

interface Props {
  userId: string;
  initialPeople: PersonFull[];
  hasCalendarConnection: boolean;
  initialProfile: CachedProfile;
}

// Fixed routes (besides each person) that must open with no network. Home is the
// app's entry point, so warming them here caches account/meet/calendar for offline
// use just like people (deferred + deduped per session — see warmPaths below).
const WARM_ROUTES = ["/meet", "/account", "/calendar"];

export function PeopleListClient({
  userId,
  initialPeople,
  hasCalendarConnection,
  initialProfile,
}: Props) {
  const [people, setPeople] = useState<PersonFull[]>(initialPeople);

  // Snapshot the connection flag + user profile so the calendar and account
  // pages render offline without a server fetch. This online home load is the
  // single writer for both. Owner-gated so these writes land AFTER any
  // account-switch wipe (not before, where the wipe would erase them).
  useEffect(() => {
    void (async () => {
      await ensureOfflineOwner(userId, initialProfile.email);
      void cacheConnectionFlag(hasCalendarConnection);
      void cacheProfile(initialProfile);
    })();
  }, [userId, hasCalendarConnection, initialProfile]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const cached = await getCachedPeople();
      if (active && cached.length) setPeople(cached);
    };

    (async () => {
      // Owner gate FIRST: if another account's data owns this device, this
      // wipes it (people, outbox, meta, snapshot, SW pages) before we read
      // outboxCount() or merge anything — otherwise the previous account's
      // pending outbox blocks the fresh fetch and cachePeople() merges the two
      // accounts' people into one list.
      await ensureOfflineOwner(userId, initialProfile.email);
      if (!active) return;
      const online = typeof navigator === "undefined" ? true : navigator.onLine;
      // Online with nothing queued: pull the authoritative fresh list straight
      // from the API (never cached by the SW or the router cache), so an edit or
      // a newly-created person shows immediately instead of being reseeded from a
      // stale RSC snapshot. Mirrors PersonDetail's fetch-on-mount. Crucially we do
      // NOT seed the store from the (possibly stale) initialPeople here — that
      // clear-and-replace was overwriting fresh optimistic edits.
      if (online && (await outboxCount()) === 0) {
        try {
          const res = await fetch("/api/people?full=1", { cache: "no-store" });
          if (res.ok) {
            const { data } = await res.json();
            if (active && Array.isArray(data)) {
              setPeople(data as PersonFull[]);
              await cachePeople(data as PersonFull[]);
              return;
            }
          }
        } catch {
          /* offline / network error — fall back to the SSR seed + cache below */
        }
      }
      // Offline (or the refresh failed): seed the store from the SSR snapshot and
      // render from the cache. cachePeople's pending-aware merge protects
      // un-synced offline edits from the snapshot.
      if (!active) return;
      await cachePeople(initialPeople);
      await load();
    })();

    const unsub = subscribeOffline(load);
    return () => {
      active = false;
      unsub();
    };
  }, [userId, initialPeople, initialProfile.email]);

  // Warm the SW cache with every person's + key route's FULL RSC payload so each
  // opens offline later. Deferred ~300ms (after the home paints) and delegated to
  // lib/offline-warm (concurrency 2, priority:"low" so a tap always wins the
  // network, deduped once per session, and it drives the WarmingProgress bar).
  // Skipped offline.
  useEffect(() => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const paths = [...people.map((p) => `/people/${p.id}`), ...WARM_ROUTES];
    const t = setTimeout(() => void warmPaths(paths, 2), 300);
    return () => clearTimeout(t);
  }, [people]);

  // Tapping a pre-meeting notification (native) opens that person's profile.
  // No-op on web and on builds without the LocalNotifications plugin.
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void registerNotificationTapHandler((path) => {
      window.location.assign(path);
    }).then((c) => {
      cleanup = c;
    });
    return () => cleanup?.();
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      <WarmingProgress />
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
