// Shared event → people matching.
//
// Used by BOTH calendar sources:
//   - Google Calendar (server-fetched) — app/api/calendar/events/route.ts
//   - Device calendar (client-read on native) — app/api/calendar/device-events/route.ts
//
// Matching is intentionally identical for both so the calendar UI behaves the
// same regardless of where the event came from.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAllPeople, getPersonFull } from "@/lib/people";
import { eventMentionsPerson } from "@/lib/utils";
import type { CalendarEvent, PersonFull, UpcomingMeetingAlert } from "@/types/app";

export async function matchEventsToPeople(
  supabase: SupabaseClient,
  userId: string,
  events: CalendarEvent[]
): Promise<UpcomingMeetingAlert[]> {
  if (events.length === 0) return [];

  const people = await getAllPeople(supabase, userId);

  const alerts: UpcomingMeetingAlert[] = [];

  for (const event of events) {
    const matchedPeopleIds: string[] = [];

    for (const person of people) {
      const nameMatch = eventMentionsPerson(
        event.summary,
        event.description,
        person.name
      );

      const attendeeMatch = event.attendees.some(
        (a) => a.displayName && eventMentionsPerson("", a.displayName, person.name)
      );

      if (nameMatch || attendeeMatch) {
        matchedPeopleIds.push(person.id);
      }
    }

    // Unmatched events are dropped — EXCEPT events created from this app
    // (e.g. a "Just me" event matches no saved person but must still show).
    if (matchedPeopleIds.length > 0 || event.appCreated) {
      const matchedPeopleFull = await Promise.all(
        matchedPeopleIds.map((id) => getPersonFull(supabase, id, userId))
      );

      alerts.push({
        event,
        matchedPeople: matchedPeopleFull.filter(
          (p): p is PersonFull => p !== null
        ),
      });
    }
  }

  return alerts;
}
