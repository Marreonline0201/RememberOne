// Calendar page — fetches data server-side, delegates rendering to CalendarView
// so dates re-format live when the user changes language.

import { createClient } from "@/lib/supabase/server";
import { getAllPeopleFull } from "@/lib/people";
import { CalendarView } from "@/components/CalendarView";
import type { PersonFull } from "@/types/app";

interface DayGroup {
  dateKey: string; // "2024-03-15"
  entries: { person: PersonFull; meetingId: string; summary?: string | null }[];
}

export default async function CalendarPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const people = await getAllPeopleFull(supabase, user.id);

  const { data: calendarConnection } = await supabase
    .from("calendar_connections")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Build flat list of (date, person, meeting) then group by date
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
      groupMap.set(dateKey, { dateKey, entries: [] });
    }
    groupMap.get(dateKey)!.entries.push({
      person: entry.person,
      meetingId: entry.meetingId,
      summary: entry.summary,
    });
  }

  const groups = Array.from(groupMap.values());

  return (
    <CalendarView
      groups={groups}
      hasCalendarConnection={!!calendarConnection}
      hasPeople={people.length > 0}
    />
  );
}
