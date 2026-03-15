// Home — shows all saved people with notification alert at top.

import { createClient } from "@/lib/supabase/server";
import { getAllPeopleFull } from "@/lib/people";
import { PeopleGrid } from "@/components/PeopleGrid";
import { UpcomingMeetingAlert } from "@/components/UpcomingMeetingAlert";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const people = await getAllPeopleFull(supabase, user.id);

  const { data: calendarConnection } = await supabase
    .from("calendar_connections")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      {/* Upcoming meeting notification */}
      {calendarConnection && people.length > 0 && (
        <UpcomingMeetingAlert />
      )}

      {/* People list */}
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
              No one here yet
            </p>
            <p className="text-[13px] mt-2 max-w-xs" style={{ color: "#5e7983" }}>
              Tap the mic button below and describe who you met — AI will save their
              details automatically.
            </p>
          </div>
          <Link
            href="/meet"
            className="h-12 px-8 rounded-[10px_2px_10px_2px] text-white flex items-center gap-2 transition-opacity active:opacity-80"
            style={{ background: "linear-gradient(to right, #284e72, #482d7c)" }}
          >
            <span style={{ fontFamily: "'Hammersmith One', sans-serif" }}>
              LOG YOUR FIRST MEETING
            </span>
          </Link>
        </div>
      ) : (
        <PeopleGrid people={people} />
      )}
    </div>
  );
}
