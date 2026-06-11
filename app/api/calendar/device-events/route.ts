// POST /api/calendar/device-events
// Receives events the client read from the *device* calendar (native only,
// via @ebarooni/capacitor-calendar), matches them to the user's saved people,
// and returns the same UpcomingMeetingAlert[] shape as the Google source.
//
// Device events are matched transiently and NEVER stored.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { matchEventsToPeople } from "@/lib/calendar-match";
import type { CalendarEvent } from "@/types/app";

const attendeeSchema = z.object({
  email: z.string().default(""),
  displayName: z.string().nullable().default(null),
  responseStatus: z.string().default("needsAction"),
});

const eventSchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: z.string().nullable().default(null),
  location: z.string().nullable().default(null),
  start: z.string(),
  end: z.string().default(""),
  attendees: z.array(attendeeSchema).default([]),
  htmlLink: z.string().default(""),
});

// Cap the payload — a 7-day device window is tiny; this just bounds abuse.
const bodySchema = z.object({ events: z.array(eventSchema).max(300) });

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ data: null, error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const events: CalendarEvent[] = parsed.data.events;
    const alerts = await matchEventsToPeople(supabase, user.id, events);

    return NextResponse.json({ data: alerts, error: null });
  } catch (err: unknown) {
    console.error("[POST /api/calendar/device-events]", err);
    return NextResponse.json(
      { data: null, error: "Failed to match device events" },
      { status: 500 }
    );
  }
}
