// /api/calendar/event — create / update / delete a single Google Calendar
// event from the app ("add meeting on this date" flow).
//
// Singular on purpose: DELETE /api/calendar/events already means "disconnect
// the calendar", so event-level writes live here.
//
// All writes require a connection whose granted scope allows event writes
// (calendar.events). Connections made under the old read-only scope get a 403
// "reauth_required" and the client prompts a one-tap reconnect.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { calendar_v3 } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import {
  insertCalendarEvent,
  patchCalendarEvent,
  deleteCalendarEvent,
  scopeAllowsEventWrites,
  APP_EVENT_TAG_KEY,
} from "@/lib/google-calendar";
import { decryptToken, decryptTokenOptional, encryptToken } from "@/lib/crypto";
import { todayKeyInZone, addDaysToKey } from "@/lib/utils";

// ── Input validation ────────────────────────────────────────────────────────

interface EventInput {
  startDate: string; // "YYYY-MM-DD" (in the user's timezone)
  startTime: string | null; // "HH:mm" — null when all-day
  endDate: string; // "YYYY-MM-DD" — INCLUSIVE last day for all-day events
  endTime: string | null;
  allDay: boolean;
  timeZone: string; // IANA zone the dates/times are expressed in
  title: string;
  personId: string; // picked person's id, or "me"
  location: string | null;
  note: string | null;
  eventId?: string; // PATCH / DELETE target
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// null = explicitly all-day; undefined = malformed (reject).
function normTime(v: unknown): string | null | undefined {
  if (v === null || v === undefined || v === "") return null;
  return typeof v === "string" && TIME_RE.test(v) ? v : undefined;
}

// Add minutes to a wall-clock date/time (UTC arithmetic, no zone conversion) —
// only used by the back-compat path that derives an end from a duration.
function addMinutesWallClock(
  date: string,
  time: string,
  minutes: number
): { date: string; time: string } {
  const d = new Date(`${date}T${time}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

function parseEventInput(raw: unknown): EventInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const timeZone = typeof r.timeZone === "string" ? r.timeZone : "";
  if (!timeZone || !isValidTimeZone(timeZone)) return null;

  const title =
    (typeof r.title === "string" ? r.title.trim().slice(0, 200) : "") ||
    "(No title)";
  const personId =
    typeof r.personId === "string" && r.personId.trim()
      ? r.personId.trim().slice(0, 64)
      : "me";
  const location =
    typeof r.location === "string" && r.location.trim()
      ? r.location.trim().slice(0, 300)
      : null;
  const note =
    typeof r.note === "string" && r.note.trim()
      ? r.note.trim().slice(0, 2000)
      : null;
  const eventId =
    typeof r.eventId === "string" && r.eventId.trim()
      ? r.eventId.trim().slice(0, 200)
      : undefined;

  let startDate: string;
  let endDate: string;
  let startTime: string | null;
  let endTime: string | null;
  let allDay: boolean;

  if (typeof r.startDate === "string") {
    // New shape: explicit start/end + all-day flag.
    startDate = r.startDate;
    endDate = typeof r.endDate === "string" ? r.endDate : startDate;
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) return null;
    allDay = r.allDay === true;
    if (allDay) {
      startTime = null;
      endTime = null;
      if (endDate < startDate) return null; // single day allowed (equal)
    } else {
      const st = normTime(r.startTime);
      const et = normTime(r.endTime);
      if (!st || !et) return null; // a timed event needs both times
      startTime = st;
      endTime = et;
      if (`${endDate}T${endTime}` <= `${startDate}T${startTime}`) return null;
    }
  } else {
    // Back-compat: the pre-redesign client bundle sends { date, time,
    // durationMin } (reachable during the one-launch service-worker window).
    const date = typeof r.date === "string" ? r.date : "";
    if (!DATE_RE.test(date)) return null;
    const t = normTime(r.time);
    if (t === undefined) return null;
    if (t === null) {
      allDay = true;
      startDate = endDate = date;
      startTime = endTime = null;
    } else {
      allDay = false;
      const durRaw = typeof r.durationMin === "number" ? r.durationMin : 60;
      const dur = Math.min(1440, Math.max(5, Math.round(durRaw)));
      const e = addMinutesWallClock(date, t, dur);
      startDate = date;
      startTime = t;
      endDate = e.date;
      endTime = e.time;
    }
  }

  return {
    startDate,
    startTime,
    endDate,
    endTime,
    allDay,
    timeZone,
    title,
    personId,
    location,
    note,
    eventId,
  };
}

// Google event body from validated input. PATCH must explicitly null the
// unused start/end variant (date vs dateTime) so a timed event can become
// all-day and vice versa; INSERT omits the unused keys.
function buildEventBody(
  input: EventInput,
  forPatch: boolean
): calendar_v3.Schema$Event {
  const {
    startDate,
    startTime,
    endDate,
    endTime,
    allDay,
    timeZone,
    title,
    personId,
    location,
    note,
  } = input;

  let start: calendar_v3.Schema$EventDateTime;
  let end: calendar_v3.Schema$EventDateTime;
  if (!allDay && startTime && endTime) {
    start = { dateTime: `${startDate}T${startTime}:00`, timeZone };
    end = { dateTime: `${endDate}T${endTime}:00`, timeZone };
    if (forPatch) {
      start.date = null;
      end.date = null;
    }
  } else {
    // Google all-day end is EXCLUSIVE; our endDate is the inclusive last day.
    start = { date: startDate };
    end = { date: addDaysToKey(endDate, 1) };
    if (forPatch) {
      start.dateTime = null;
      end.dateTime = null;
    }
  }

  return {
    summary: title,
    description: note, // null clears the field on patch
    location,
    start,
    end,
    // Tag so the app recognizes (and can edit/delete) its own events later.
    extendedProperties: { private: { [APP_EVENT_TAG_KEY]: "1", personId } },
  };
}

// ── Shared connection loading + scope gate ──────────────────────────────────

type Failure = { response: NextResponse };
type Granted = {
  connection: {
    id: string;
    access_token: string;
    refresh_token: string | null;
    token_expiry: string | null;
    calendar_id: string;
  };
};

async function getWritableConnection(): Promise<Failure | (Granted & { supabase: Awaited<ReturnType<typeof createClient>> })> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: NextResponse.json(
        { data: null, error: "unauthorized" },
        { status: 401 }
      ),
    };
  }

  const { data: connection } = await supabase
    .from("calendar_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .maybeSingle();

  if (!connection) {
    return {
      response: NextResponse.json(
        { data: null, error: "not_connected" },
        { status: 404 }
      ),
    };
  }

  // Connections granted under the old calendar.readonly scope can read but
  // not write — the client turns this into a "reconnect" prompt.
  if (!scopeAllowsEventWrites(connection.scope)) {
    return {
      response: NextResponse.json(
        { data: null, error: "reauth_required" },
        { status: 403 }
      ),
    };
  }

  return { supabase, connection };
}

// Mirror of the GET route's revoked-token cleanup: a dead refresh token means
// the connection can't recover — drop it so the client prompts a reconnect.
async function handleGoogleError(
  err: unknown,
  supabase: Awaited<ReturnType<typeof createClient>>,
  connectionId: string
): Promise<NextResponse> {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("invalid_grant") ||
    msg.includes("Token has been expired") ||
    msg.includes("Invalid Credentials")
  ) {
    await supabase.from("calendar_connections").delete().eq("id", connectionId);
    return NextResponse.json(
      { data: null, error: "reauth_required" },
      { status: 403 }
    );
  }
  console.error("[/api/calendar/event]", err);
  return NextResponse.json(
    { data: null, error: "event_failed" },
    { status: 500 }
  );
}

async function persistRefreshedToken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  connectionId: string,
  newAccessToken: string | null
): Promise<void> {
  if (!newAccessToken) return;
  await supabase
    .from("calendar_connections")
    .update({ access_token: encryptToken(newAccessToken) })
    .eq("id", connectionId);
}

// ── POST: create ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const gate = await getWritableConnection();
  if ("response" in gate) return gate.response;
  const { supabase, connection } = gate;

  const input = parseEventInput(await request.json().catch(() => null));
  if (!input) {
    return NextResponse.json(
      { data: null, error: "invalid_input" },
      { status: 400 }
    );
  }

  // The UI only offers today/future dates; enforce it here too.
  if (input.startDate < todayKeyInZone(input.timeZone)) {
    return NextResponse.json(
      { data: null, error: "past_date" },
      { status: 400 }
    );
  }

  try {
    const { event, newAccessToken } = await insertCalendarEvent(
      decryptToken(connection.access_token),
      decryptTokenOptional(connection.refresh_token),
      connection.token_expiry,
      connection.calendar_id,
      buildEventBody(input, false)
    );
    await persistRefreshedToken(supabase, connection.id, newAccessToken);
    return NextResponse.json({ data: event, error: null });
  } catch (err: unknown) {
    return handleGoogleError(err, supabase, connection.id);
  }
}

// ── PATCH: update ───────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const gate = await getWritableConnection();
  if ("response" in gate) return gate.response;
  const { supabase, connection } = gate;

  const input = parseEventInput(await request.json().catch(() => null));
  if (!input || !input.eventId) {
    return NextResponse.json(
      { data: null, error: "invalid_input" },
      { status: 400 }
    );
  }

  // No past-date guard on edit: an ongoing/multi-day event legitimately has a
  // start before today, and editing it (even just the note) must still work.
  // (The guard stays on POST so new events can't be back-dated.)

  try {
    const { event, newAccessToken } = await patchCalendarEvent(
      decryptToken(connection.access_token),
      decryptTokenOptional(connection.refresh_token),
      connection.token_expiry,
      connection.calendar_id,
      input.eventId,
      buildEventBody(input, true)
    );
    await persistRefreshedToken(supabase, connection.id, newAccessToken);
    return NextResponse.json({ data: event, error: null });
  } catch (err: unknown) {
    // The event vanished (deleted in Google) — tell the client to refresh.
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404 || status === 410) {
      return NextResponse.json(
        { data: null, error: "event_not_found" },
        { status: 404 }
      );
    }
    return handleGoogleError(err, supabase, connection.id);
  }
}

// ── DELETE: remove ──────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const gate = await getWritableConnection();
  if ("response" in gate) return gate.response;
  const { supabase, connection } = gate;

  const body = (await request.json().catch(() => null)) as
    | { eventId?: unknown }
    | null;
  const eventId =
    typeof body?.eventId === "string" && body.eventId.trim()
      ? body.eventId.trim().slice(0, 200)
      : null;
  if (!eventId) {
    return NextResponse.json(
      { data: null, error: "invalid_input" },
      { status: 400 }
    );
  }

  try {
    // deleteCalendarEvent already treats Google 404/410 as success.
    const { newAccessToken } = await deleteCalendarEvent(
      decryptToken(connection.access_token),
      decryptTokenOptional(connection.refresh_token),
      connection.token_expiry,
      connection.calendar_id,
      eventId
    );
    await persistRefreshedToken(supabase, connection.id, newAccessToken);
    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (err: unknown) {
    return handleGoogleError(err, supabase, connection.id);
  }
}
