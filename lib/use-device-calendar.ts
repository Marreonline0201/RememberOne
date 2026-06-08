"use client";

// useDeviceCalendar — reads the phone's on-device calendar (Galaxy/Samsung,
// iPhone, etc.) and surfaces events that match a saved person, mirroring the
// Google "upcoming meetings" feature.
//
// Native only. The device calendar can only be read by native code, so this
// hook is a no-op ("unavailable") on web/desktop. It also guards on
// isPluginAvailable so the instantly-deployed web bundle never crashes on app
// installs that predate the native plugin (they just stay "unavailable").
//
// Flow: requestReadOnlyCalendarAccess (Android) / requestFullCalendarAccess
// (iOS — no read-only tier on iOS 17) → listEventsInRange (next 7 days) →
// POST /api/calendar/device-events (server matches to people) → alerts.

import { useCallback, useEffect, useRef, useState } from "react";
import type { CalendarEvent, UpcomingMeetingAlert } from "@/types/app";

const DAYS_AHEAD = 7; // mirror the Google window (lib/google-calendar.ts)
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
  startDate: number;
  endDate: number;
  attendees?: { email: string | null; name: string | null }[];
}

function mapEvent(ev: PluginEvent): CalendarEvent {
  const startMs = ev.startDate;
  const endMs = ev.endDate || ev.startDate;
  return {
    id: ev.id,
    summary: ev.title || "(No title)",
    description: ev.description ?? null,
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    attendees: (ev.attendees ?? []).map((a) => ({
      email: a.email ?? "",
      displayName: a.name ?? null,
      responseStatus: "needsAction",
    })),
    htmlLink: "",
  };
}

export function useDeviceCalendar(enabled: boolean = true) {
  const [alerts, setAlerts] = useState<UpcomingMeetingAlert[]>([]);
  const [status, setStatus] = useState<DeviceCalendarStatus>("idle");
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

      const res = await fetch("/api/calendar/device-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      });
      if (res.ok) {
        const { data } = await res.json();
        if (Array.isArray(data)) setAlerts(data);
      }
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

  return { alerts, status, connect };
}
