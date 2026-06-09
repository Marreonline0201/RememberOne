// Client-side event → people matching.
//
// Mirrors the server matchEventsToPeople (lib/calendar-match.ts) but operates on
// already-loaded PersonFull[] from the local store (getCachedPeople), so the
// phone-calendar "upcoming" matching works fully offline — no server round-trip.
// Matching logic is intentionally identical (same eventMentionsPerson rules).

import { eventMentionsPerson } from "@/lib/utils";
import type { CalendarEvent, PersonFull, UpcomingMeetingAlert } from "@/types/app";

export function matchEventsToPeopleClient(
  events: CalendarEvent[],
  people: PersonFull[]
): UpcomingMeetingAlert[] {
  if (events.length === 0 || people.length === 0) return [];

  const alerts: UpcomingMeetingAlert[] = [];

  for (const event of events) {
    const matchedPeople = people.filter((person) => {
      const nameMatch = eventMentionsPerson(
        event.summary,
        event.description,
        person.name
      );
      const attendeeMatch = event.attendees.some(
        (a) => a.displayName && eventMentionsPerson("", a.displayName, person.name)
      );
      return nameMatch || attendeeMatch;
    });

    if (matchedPeople.length > 0) {
      alerts.push({ event, matchedPeople });
    }
  }

  return alerts;
}
