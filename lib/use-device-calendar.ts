"use client";

// useDeviceCalendar — reads the phone's on-device calendar (Galaxy/Samsung,
// iPhone, etc.) and surfaces events that match a saved person, mirroring the
// Google "upcoming meetings" feature. With WRITE_CALENDAR granted (builds that
// declare it), the phone calendar is also the app's primary WRITE target — see
// lib/device-calendar.ts.
//
// Native only. The device calendar can only be reached by native code, so this
// hook is a no-op ("unavailable") on web/desktop. It also guards on
// isPluginAvailable so the instantly-deployed web bundle never crashes on app
// installs that predate the native plugin (they just stay "unavailable").
//
// Flow: requestReadOnlyCalendarAccess (Android) / requestFullCalendarAccess
// (iOS — no read-only tier on iOS 17) → listEventsInRange (62 days, matching
// the Google window + the add-event horizon) → match to cached people
// on-device (offline-safe, no server round-trip) → alerts.

import { useCallback, useEffect, useRef, useState } from "react";
import { getCachedPeople } from "@/lib/offline-cache";
import { matchEventsToPeopleClient } from "@/lib/calendar-match-client";
import { checkDeviceWriteAccess } from "@/lib/device-calendar";
import type { CalendarEvent, UpcomingMeetingAlert } from "@/types/app";

const DAYS_AHEAD = 62; // mirror the Google window (lib/google-calendar.ts)
const PLUGIN_NAME = "CapacitorCalendar";

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

export function useDeviceCalendar(enabled: boolean = true) {
  const [alerts, setAlerts] = useState<UpcomingMeetingAlert[]>([]);
  const [status, setStatus] = useState<DeviceCalendarStatus>("idle");
  // Write permission state (render-time gating only; the save path re-checks
  // and requests via ensureDeviceWriteAccess).
  const [writable, setWritable] = useState(false);
  const busyRef = useRef(false);

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

      if (events.length === 0) {
        setAlerts([]);
        setStatus("granted");
        return;
      }

      // Match on-device against the cached people — works fully offline, no
      // server round-trip (mirrors the server matcher via eventMentionsPerson).
      const people = await getCachedPeople();
      setAlerts(matchEventsToPeopleClient(events, people));
      setStatus("granted");
    } catch (err) {
      // Permission was granted; reading/matching just failed. Don't nag the
      // user with the prompt again — fail quietly (Google path still works).
      console.error("[device-calendar] read failed:", err);
      setStatus("granted");
    }
  }, []);

  // Initial probe: native? plugin present? already granted? → read silently.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!enabled) {
        if (!cancelled) setStatus("idle");
        return;
      }
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (
          !Capacitor.isNativePlatform() ||
          !Capacitor.isPluginAvailable(PLUGIN_NAME)
        ) {
          if (!cancelled) setStatus("unavailable");
          return;
        }
        const { CapacitorCalendar, CalendarPermissionScope } = await import(
          "@ebarooni/capacitor-calendar"
        );
        const { result } = await CapacitorCalendar.checkPermission({
          scope: CalendarPermissionScope.READ_CALENDAR,
        });
        if (cancelled) return;
        // Non-prompting write check (auto-denied on builds without
        // WRITE_CALENDAR in the manifest — that's the graceful fallback).
        void checkDeviceWriteAccess().then((w) => {
          if (!cancelled) setWritable(w);
        });
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
    if (status !== "granted") return;
    await readAndMatch();
  }, [status, readAndMatch]);

  // The save path requests write access itself; let it report a fresh grant
  // back so render-time gating updates without a remount.
  const markWritable = useCallback((w: boolean) => setWritable(w), []);

  return { alerts, status, connect, writable, markWritable, refresh };
}
