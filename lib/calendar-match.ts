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

    // App-created events know their person directly (the picker's choice is
    // tagged on the event) — seed the match so a custom title like "Lunch"
    // still shows the person's card. Deleted/foreign ids null out in
    // getPersonFull below, and "me" means no person.
    if (event.appCreated && event.appPersonId && event.appPersonId !== "me") {
      matchedPeopleIds.push(event.appPersonId);
    }

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

    // Dedupe — the tag seed and the text matcher can both hit the same person.
    const uniqueIds = [...new Set(matchedPeopleIds)];

    // Unmatched events are dropped — EXCEPT events created from this app
    // (e.g. a "Just me" event matches no saved person but must still show).
    if (uniqueIds.length > 0 || event.appCreated) {
      const matchedPeopleFull = await Promise.all(
        uniqueIds.map((id) => getPersonFull(supabase, id, userId))
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
