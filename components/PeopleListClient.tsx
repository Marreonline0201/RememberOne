"use client";

// Home people list, rendered from the local store so it works offline and
// reflects queued edits/deletes instantly. Seeded by the server snapshot
// (initialPeople) on each online load.

import { useEffect, useState } from "react";
import Link from "next/link";
import { PeopleGrid } from "@/components/PeopleGrid";
import { UpcomingMeetingAlert } from "@/components/UpcomingMeetingAlert";
import { T } from "@/components/T";
import { cachePeople, getCachedPeople, subscribeOffline } from "@/lib/offline-cache";
import type { PersonFull } from "@/types/app";

interface Props {
  initialPeople: PersonFull[];
  hasCalendarConnection: boolean;
}

export function PeopleListClient({ initialPeople, hasCalendarConnection }: Props) {
  const [people, setPeople] = useState<PersonFull[]>(initialPeople);

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
