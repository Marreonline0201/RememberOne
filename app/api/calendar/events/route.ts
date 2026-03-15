// GET /api/calendar/events
// Fetches upcoming Google Calendar events for the authenticated user,
// matches attendee names/emails against saved people, and returns alerts.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchUpcomingEvents } from "@/lib/google-calendar";
import { getAllPeople } from "@/lib/people";
import { getPersonFull } from "@/lib/people";
import { eventMentionsPerson } from "@/lib/utils";
import type { PersonFull, UpcomingMeetingAlert } from "@/types/app";

export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    // Get calendar connection
    const { data: connection } = await supabase
      .from("calendar_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .maybeSingle();

    if (!connection) {
      return NextResponse.json(
        { data: null, error: "No calendar connected" },
        { status: 404 }
      );
    }

    // Fetch events from Google
    let events: Awaited<ReturnType<typeof fetchUpcomingEvents>>["events"];
    let newAccessToken: string | null;
    try {
      ({ events, newAccessToken } = await fetchUpcomingEvents(
        connection.access_token,
        connection.refresh_token,
        connection.token_expiry,
        connection.calendar_id
      ));
    } catch (googleErr: unknown) {
      // If the token is revoked or expired beyond refresh, remove the stale
      // connection so the user can reconnect, and return empty gracefully.
      const msg =
        googleErr instanceof Error ? googleErr.message : String(googleErr);
      if (
        msg.includes("invalid_grant") ||
        msg.includes("Token has been expired") ||
        msg.includes("Invalid Credentials")
      ) {
        await supabase
          .from("calendar_connections")
          .delete()
          .eq("id", connection.id);
        return NextResponse.json({ data: [], error: null });
      }
      throw googleErr; // re-throw unexpected errors
    }

    // If token was refreshed, update the DB
    if (newAccessToken) {
      await supabase
        .from("calendar_connections")
        .update({ access_token: newAccessToken })
        .eq("id", connection.id);
    }

    // Get all saved people (summary only for matching)
    const people = await getAllPeople(supabase, user.id);

    if (people.length === 0 || events.length === 0) {
      return NextResponse.json({ data: [], error: null });
    }

    // Match events to people
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
          (a) =>
            a.displayName &&
            eventMentionsPerson("", a.displayName, person.name)
        );

        if (nameMatch || attendeeMatch) {
          matchedPeopleIds.push(person.id);
        }
      }

      if (matchedPeopleIds.length > 0) {
        // Fetch full profiles for matched people
        const matchedPeopleFull = await Promise.all(
          matchedPeopleIds.map((id) => getPersonFull(supabase, id))
        );

        alerts.push({
          event,
          matchedPeople: matchedPeopleFull.filter((p): p is PersonFull => p !== null),
        });
      }
    }

    return NextResponse.json({ data: alerts, error: null });
  } catch (err: unknown) {
    console.error("[GET /api/calendar/events]", err);
    return NextResponse.json(
      { data: null, error: "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}

// DELETE /api/calendar/events — disconnect calendar
export async function DELETE() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    await supabase
      .from("calendar_connections")
      .delete()
      .eq("user_id", user.id);

    return NextResponse.json({ data: { disconnected: true }, error: null });
  } catch (err: unknown) {
    return NextResponse.json(
      { data: null, error: "Failed to disconnect calendar" },
      { status: 500 }
    );
  }
}
