// Pure helper: group a person list's meetings into calendar day-groups.
//
// Lifted verbatim from the (former) server calendar page so the calendar can
// render fully client-side from the local store (offline-first). The dot markers
// and day list are built from these groups.

import type { PersonFull } from "@/types/app";

export interface CalendarEntry {
  person: PersonFull;
  meetingId: string;
  summary?: string | null;
}

export interface DayGroup {
  dateKey: string; // "YYYY-MM-DD"
  entries: CalendarEntry[];
}

export function groupMeetingsByDate(people: PersonFull[]): DayGroup[] {
  type Entry = CalendarEntry & { meetingDate: string };
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

  // Most-recent first.
  entries.sort(
    (a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime()
  );

  // Group by date key (YYYY-MM-DD), one entry per person per day (entries are
  // already sorted most-recent first, so the kept meeting is the latest).
  const groupMap = new Map<string, DayGroup>();
  for (const entry of entries) {
    const dateKey = new Date(entry.meetingDate).toISOString().slice(0, 10);
    let group = groupMap.get(dateKey);
    if (!group) {
      group = { dateKey, entries: [] };
      groupMap.set(dateKey, group);
    }
    if (!group.entries.some((e) => e.person.id === entry.person.id)) {
      group.entries.push({
        person: entry.person,
        meetingId: entry.meetingId,
        summary: entry.summary,
      });
    }
  }

  return Array.from(groupMap.values());
}
