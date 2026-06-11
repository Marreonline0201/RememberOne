"use client";

// useDeviceCalendar — reads the phone's on-device calendar (Galaxy/Samsung,
// iPhone, etc.) and surfaces events that match a saved person, mirroring the
// Google "upcoming meetings" feature. With WRITE_CALENDAR granted (builds that
// declare it), the phone calendar is also the app's primary WRITE target — see
// lib/device-calendar.ts.
//
// Native only. The device calendar can only be reached by native code, so this
// hook is a no-op ("unavailable") on web/desktop. It also guards on plugin
// availability so the instantly-deployed web bundle never crashes on app
// installs that predate the native plugin (they just stay "unavailable").
//
// Flow: requestReadOnlyCalendarAccess (Android) / requestFullCalendarAccess
// (iOS — no read-only tier on iOS 17) → listEventsInRange (62 days, matching
// the Google window + the add-event horizon) → match to cached people
// on-device (offline-safe, no server round-trip) → alerts. App-created device
// events are force-included via the local tag registry (offline-cache), since
// a "Just me"/custom-titled event matches no saved person by name.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCachedPeople,
  getCachedDeviceEventTags,
  cacheDeviceEventTags,
} from "@/lib/offline-cache";
import { matchEventsToPeopleClient } from "@/lib/calendar-match-client";
import { isDeviceCalendarAvailable } from "@/lib/device-calendar";
import type {
  CalendarEvent,
  PersonFull,
  UpcomingMeetingAlert,
} from "@/types/app";

const DAYS_AHEAD = 62; // mirror the Google window (lib/google-calendar.ts)

export type DeviceCalendarStatus =
  | "idle"
  | "unavailable" // not native, or plugin missing (old install / web)
  | "prompt" // native + available, permission not yet granted
  | "loading"
  | "granted"
  | "denied";

// The plugin's CalendarEvent (subset we use). Dates are ms timestamps.
interface PluginEvent {
  id: string;
  title: string | null;
  description: string | null;
  location?: string | null;
  startDate: number;
  endDate: number;
  isAllDay?: boolean;
  attendees?: { email: string | null; name: string | null }[];
}

function mapEvent(ev: PluginEvent): CalendarEvent {
  const startMs = ev.startDate;
  const endMs = ev.endDate || ev.startDate;
  // All-day events: Android stores them as UTC day spans — normalize to the
  // same date-only string shape Google uses ("2026-06-15"), so the "All day"
  // label, day placement, and the title+minute dedupe all line up.
  const start = ev.isAllDay
    ? new Date(startMs).toISOString().slice(0, 10)
    : new Date(startMs).toISOString();
  const end = ev.isAllDay
    ? new Date(endMs).toISOString().slice(0, 10)
    : new Date(endMs).toISOString();
  return {
    id: ev.id,
    summary: ev.title || "(No title)",
    description: ev.description ?? null,
    location: ev.location ?? null,
    start,
    end,
    attendees: (ev.attendees ?? []).map((a) => ({
      email: a.email ?? "",
      displayName: a.name ?? null,
      responseStatus: "needsAction",
    })),
    htmlLink: "",
    source: "device",
  };
}

// Name-matched alerts + force-included app-created (tagged) events, with the
// tagged person resolved exactly and put first. Prunes registry entries whose
// event no longer exists in the read window (deleted on the phone / long past).
function buildAlerts(
  events: CalendarEvent[],
  people: PersonFull[],
  tags: Record<string, string>
): UpcomingMeetingAlert[] {
  const matched = new Map(
    matchEventsToPeopleClient(events, people).map((a) => [a.event.id, a])
  );
  const alerts: UpcomingMeetingAlert[] = [];
  for (const event of events) {
    const tag = tags[event.id];
    const nameMatch = matched.get(event.id);
    if (tag) {
      const person =
        tag !== "me" ? people.find((p) => p.id === tag) ?? null : null;
      const matchedPeople = nameMatch ? [...nameMatch.matchedPeople] : [];
      if (person) {
        const at = matchedPeople.findIndex((p) => p.id === person.id);
        if (at > 0) matchedPeople.splice(at, 1);
        if (at !== 0) matchedPeople.unshift(person);
      }
      alerts.push({
        event: { ...event, appCreated: true, appPersonId: tag },
        matchedPeople,
      });
    } else if (nameMatch) {
      alerts.push(nameMatch);
    }
  }
  return alerts;
}

export function useDeviceCalendar(enabled: boolean = true) {
  const [alerts, setAlerts] = useState<UpcomingMeetingAlert[]>([]);
  const [status, setStatus] = useState<DeviceCalendarStatus>("idle");
  // Native + plugin present (independent of permissions) — whether the
  // phone-calendar write path can even be attempted.
  const [available, setAvailable] = useState(false);
  const busyRef = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;

  const readAndMatch = useCallback(async () => {
    setStatus("loading");
    try {
      const { CapacitorCalendar } = await import("@ebarooni/capacitor-calendar");
      const from = Date.now();
      const to = from + DAYS_AHEAD * 24 * 60 * 60 * 1000;
      const { result } = await CapacitorCalendar.listEventsInRange({ from, to });

      const events: CalendarEvent[] = (result ?? []).map((e) =>
        mapEvent(e as unknown as PluginEvent)
      );
      const tags = (await getCachedDeviceEventTags()) ?? {};

      // Match on-device against the cached people — works fully offline, no
      // server round-trip (mirrors the server matcher via eventMentionsPerson).
      const people = await getCachedPeople();
      setAlerts(buildAlerts(events, people, tags));
      setStatus("granted");

      // Prune tags for events that no longer exist in the window (only after
      // a SUCCESSFUL read — a failed read must never wipe the registry).
      const liveIds = new Set(events.map((e) => e.id));
      const pruned = Object.fromEntries(
        Object.entries(tags).filter(([id]) => liveIds.has(id))
      );
      if (Object.keys(pruned).length !== Object.keys(tags).length) {
        void cacheDeviceEventTags(pruned);
      }
    } catch (err) {
      // Permission was granted; reading/matching just failed. Don't nag the
      // user with the prompt again — fail quietly (Google path still works).
      console.error("[device-calendar] read failed:", err);
      setStatus("granted");
    }
  }, []);

  // Initial probe: native? plugin present? already granted? → read silently.
  // Availability is probed even when `enabled` is false (no saved people yet)
  // so the WRITE path stays offered — a "Just me" event needs no people.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const avail = await isDeviceCalendarAvailable();
        if (cancelled) return;
        setAvailable(avail);
        if (!avail) {
          setStatus("unavailable");
          return;
        }
        if (!enabled) {
          setStatus("idle");
          return;
        }
        const { CapacitorCalendar, CalendarPermissionScope } = await import(
          "@ebarooni/capacitor-calendar"
        );
        const { result } = await CapacitorCalendar.checkPermission({
          scope: CalendarPermissionScope.READ_CALENDAR,
        });
        if (cancelled) return;
        if (result === "granted") {
          await readAndMatch();
        } else {
          setStatus("prompt");
        }
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, readAndMatch]);

  // Triggered by the in-app "Connect phone calendar" prompt.
  const connect = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setStatus("loading");
    try {
      const { Capacitor } = await import("@capacitor/core");
      const platform = Capacitor.getPlatform();
      const { CapacitorCalendar } = await import("@ebarooni/capacitor-calendar");

      // iOS 17 has no read-only calendar tier — reading requires full access.
      // Android: request READ here (works on every shipped build); WRITE is
      // requested lazily at the first save (ensureDeviceWriteAccess), so old
      // manifests without WRITE_CALENDAR keep the read flow fully working.
      const { result } =
        platform === "ios"
          ? await CapacitorCalendar.requestFullCalendarAccess()
          : await CapacitorCalendar.requestReadOnlyCalendarAccess();

      if (result === "granted") {
        await readAndMatch();
      } else {
        setStatus("denied");
      }
    } catch (err) {
      console.error("[device-calendar] permission request failed:", err);
      setStatus("denied");
    } finally {
      busyRef.current = false;
    }
  }, [readAndMatch]);

  // Re-read after a device write so the new/changed event shows immediately.
  const refresh = useCallback(async () => {
    if (statusRef.current !== "granted") return;
    await readAndMatch();
  }, [readAndMatch]);

  // Called after the save path obtained WRITE access. If READ wasn't granted
  // yet (prompt dismissed / never shown), pick it up now — Android grants it
  // without another dialog since READ/WRITE_CALENDAR share a permission group
  // — and read immediately so the just-saved event actually appears.
  const onWriteGranted = useCallback(async () => {
    if (statusRef.current === "granted") return;
    try {
      const { CapacitorCalendar } = await import("@ebarooni/capacitor-calendar");
      const { result } = await CapacitorCalendar.requestReadOnlyCalendarAccess();
      if (result === "granted") await readAndMatch();
    } catch {
      /* read promotion is best-effort */
    }
  }, [readAndMatch]);

  return { alerts, status, available, connect, refresh, onWriteGranted };
}
