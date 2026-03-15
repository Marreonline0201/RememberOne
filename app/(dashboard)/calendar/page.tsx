// Calendar page — shows people grouped by the day you met them.
// Upcoming meeting notification appears at the top if calendar is connected.

import { createClient } from "@/lib/supabase/server";
import { getAllPeopleFull } from "@/lib/people";
import { UpcomingMeetingAlert } from "@/components/UpcomingMeetingAlert";
import Link from "next/link";
import { formatDate, formatRelativeDate, capitalize } from "@/lib/utils";
import type { PersonFull } from "@/types/app";

function isInterest(key: string) {
  const k = key.toLowerCase();
  return ["interest", "hobby", "hobbies", "sport", "sports", "passion", "likes"].some((ik) =>
    k.includes(ik)
  );
}

interface DayGroup {
  dateKey: string;     // "2024-03-15"
  dateLabel: string;   // "March 15, 2024"
  relativeLabel: string; // "2 days ago"
  entries: { person: PersonFull; meetingId: string; summary?: string | null }[];
}

export default async function CalendarPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const locale = user.user_metadata?.language === "ko" ? "ko-KR" : "en-US";

  const people = await getAllPeopleFull(supabase, user.id);

  const { data: calendarConnection } = await supabase
    .from("calendar_connections")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Build a flat list of (date, person, meeting) then group by date
  type Entry = { person: PersonFull; meetingId: string; meetingDate: string; summary?: string | null };
  const entries: Entry[] = [];

  for (const person of people) {
    for (const meeting of person.meetings) {
      entries.push({
        person,
        meetingId: meeting.id,
        meetingDate: meeting.meeting_date,
        summary: meeting.summary,
      });
    }
  }

  // Sort most-recent first
  entries.sort(
    (a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime()
  );

  // Group by date key (YYYY-MM-DD)
  const groupMap = new Map<string, DayGroup>();
  for (const entry of entries) {
    const dateObj = new Date(entry.meetingDate);
    const dateKey = dateObj.toISOString().slice(0, 10);
    if (!groupMap.has(dateKey)) {
      groupMap.set(dateKey, {
        dateKey,
        dateLabel: formatDate(entry.meetingDate, locale),
        relativeLabel: formatRelativeDate(entry.meetingDate, locale),
        entries: [],
      });
    }
    groupMap.get(dateKey)!.entries.push({
      person: entry.person,
      meetingId: entry.meetingId,
      summary: entry.summary,
    });
  }

  const groups = Array.from(groupMap.values());

  return (
    <div className="w-full max-w-lg mx-auto space-y-5">
      {/* Upcoming meeting alert */}
      {calendarConnection && people.length > 0 && (
        <UpcomingMeetingAlert />
      )}

      {/* Empty state */}
      {groups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #d0f2ff, #dccaff)" }}
          >
            <span className="text-3xl">📅</span>
          </div>
          <p
            className="text-[18px] text-black uppercase"
            style={{ fontFamily: "'Hammersmith One', sans-serif" }}
          >
            No meetings yet
          </p>
          <p className="text-[13px]" style={{ color: "#5e7983" }}>
            Log your first meeting using the mic button below.
          </p>
        </div>
      )}

      {/* Day groups */}
      {groups.map((group) => (
        <div key={group.dateKey}>
          {/* Date header */}
          <div className="flex items-baseline gap-2 mb-3 px-1">
            <span
              className="text-[14px] text-black uppercase"
              style={{ fontFamily: "'Hammersmith One', sans-serif" }}
            >
              {group.dateLabel}
            </span>
            <span className="text-[11px]" style={{ color: "#5e7983" }}>
              {group.relativeLabel}
            </span>
          </div>

          {/* People met on this day */}
          <div className="space-y-3">
            {group.entries.map(({ person, meetingId, summary }) => {
              const mainInfo = person.attributes.filter((a) => !isInterest(a.key));
              return (
                <Link
                  key={meetingId}
                  href={`/people/${person.id}`}
                  className="block p-4 transition-opacity active:opacity-90"
                  style={{
                    borderRadius: "10px 2px 10px 2px",
                    background: "linear-gradient(52deg, #d0f2ff 0%, #dccaff 100%)",
                  }}
                >
                  <h3
                    className="text-[22px] leading-tight text-black"
                    style={{ fontFamily: "'Hammersmith One', sans-serif" }}
                  >
                    {person.name}
                  </h3>

                  {/* Info chips */}
                  {mainInfo.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {mainInfo.slice(0, 4).map((attr) => (
                        <span
                          key={attr.id}
                          className="text-[10px] px-2 py-[3px] rounded-[5px] shadow-sm text-black"
                          style={{ backgroundColor: "#dccaff" }}
                        >
                          {capitalize(attr.key)}: {attr.value}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Meeting summary if available */}
                  {summary && (
                    <p
                      className="text-[11px] mt-2 line-clamp-2"
                      style={{ color: "#5e7983" }}
                    >
                      {summary}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
