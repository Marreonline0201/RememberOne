"use client";

// Writes to the PHONE's calendar (@ebarooni/capacitor-calendar): create,
// modify, delete. Native-only; every call lazy-imports the plugin so the
// instantly-deployed web bundle never crashes on web or on app installs that
// predate the plugin.
//
// Permission note: WRITE_CALENDAR must be declared in the Android manifest.
// Builds shipped before it was added auto-deny the write request — callers
// must treat a `false` from ensureDeviceWriteAccess() as "fall back to the
// Google path", never as an error.

const PLUGIN_NAME = "CapacitorCalendar";

export interface DeviceEventInput {
  date: string; // "YYYY-MM-DD" wall-clock in `timeZone`
  time: string | null; // "HH:mm" — null = all-day
  durationMin: number;
  timeZone: string; // IANA zone the wall clock is expressed in
  title: string;
  location: string | null;
  note: string | null;
}

// ── Wall-clock in an IANA zone → epoch ms ───────────────────────────────────
// The device plugin wants epoch timestamps. The app lets the user pick a
// timezone (TimezoneContext), which may differ from the device zone, so we
// can't just `new Date("date T time")` (that parses in the device zone).
// Standard two-pass offset derivation; the second pass corrects DST edges.

function zoneOffsetMs(epoch: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(epoch));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const hour = get("hour") % 24; // some engines emit "24" at midnight
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second")
  );
  return asUtc - epoch;
}

function epochFromZonedWallClock(
  date: string,
  time: string,
  timeZone: string
): number {
  const wallAsUtc = Date.parse(`${date}T${time}:00Z`);
  const guess = wallAsUtc - zoneOffsetMs(wallAsUtc, timeZone);
  return wallAsUtc - zoneOffsetMs(guess, timeZone);
}

// Android stores all-day events as UTC day spans.
function allDayUtcRange(date: string): { start: number; end: number } {
  const [y, m, d] = date.split("-").map(Number);
  const start = Date.UTC(y, m - 1, d);
  return { start, end: start + 24 * 60 * 60 * 1000 };
}

function eventRange(input: DeviceEventInput): {
  startDate: number;
  endDate: number;
  isAllDay: boolean;
} {
  if (!input.time) {
    const { start, end } = allDayUtcRange(input.date);
    return { startDate: start, endDate: end, isAllDay: true };
  }
  const start = epochFromZonedWallClock(input.date, input.time, input.timeZone);
  return {
    startDate: start,
    endDate: start + input.durationMin * 60 * 1000,
    isAllDay: false,
  };
}

// ── Availability + permission ───────────────────────────────────────────────

export async function isDeviceCalendarAvailable(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return (
      Capacitor.isNativePlatform() && Capacitor.isPluginAvailable(PLUGIN_NAME)
    );
  } catch {
    return false;
  }
}

// True once write access is granted; requests it when not yet decided.
// False on web, on denial, and on installs whose manifest predates
// WRITE_CALENDAR (Android auto-denies undeclared permissions).
export async function ensureDeviceWriteAccess(): Promise<boolean> {
  if (!(await isDeviceCalendarAvailable())) return false;
  try {
    const { CapacitorCalendar, CalendarPermissionScope } = await import(
      "@ebarooni/capacitor-calendar"
    );
    const { result } = await CapacitorCalendar.checkPermission({
      scope: CalendarPermissionScope.WRITE_CALENDAR,
    });
    if (result === "granted") return true;
    const req = await CapacitorCalendar.requestWriteOnlyCalendarAccess();
    return req.result === "granted";
  } catch {
    return false;
  }
}

// Current write state WITHOUT prompting (for render-time gating).
export async function checkDeviceWriteAccess(): Promise<boolean> {
  if (!(await isDeviceCalendarAvailable())) return false;
  try {
    const { CapacitorCalendar, CalendarPermissionScope } = await import(
      "@ebarooni/capacitor-calendar"
    );
    const { result } = await CapacitorCalendar.checkPermission({
      scope: CalendarPermissionScope.WRITE_CALENDAR,
    });
    return result === "granted";
  } catch {
    return false;
  }
}

// ── Writes ──────────────────────────────────────────────────────────────────
// Created in the phone's default calendar (no calendarId). If that calendar is
// a Google account, the phone itself syncs the event up to Google.

export async function createDeviceEvent(
  input: DeviceEventInput
): Promise<{ id: string }> {
  const { CapacitorCalendar } = await import("@ebarooni/capacitor-calendar");
  const { startDate, endDate, isAllDay } = eventRange(input);
  const { id } = await CapacitorCalendar.createEvent({
    title: input.title,
    startDate,
    endDate,
    isAllDay,
    ...(input.location ? { location: input.location } : {}),
    ...(input.note ? { description: input.note } : {}),
  });
  return { id };
}

export async function modifyDeviceEvent(
  id: string,
  input: DeviceEventInput
): Promise<void> {
  const { CapacitorCalendar } = await import("@ebarooni/capacitor-calendar");
  const { startDate, endDate, isAllDay } = eventRange(input);
  await CapacitorCalendar.modifyEvent({
    id,
    title: input.title,
    startDate,
    endDate,
    isAllDay,
    // Empty string clears the field (omitting would leave it unchanged).
    location: input.location ?? "",
    description: input.note ?? "",
  });
}

export async function deleteDeviceEvent(id: string): Promise<void> {
  const { CapacitorCalendar } = await import("@ebarooni/capacitor-calendar");
  await CapacitorCalendar.deleteEvent({ id });
}
