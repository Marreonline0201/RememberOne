"use client";

// Pre-meeting phone notifications, scheduled ON-DEVICE via
// @capacitor/local-notifications. No server push infra: whenever the app loads
// upcoming meetings, the pending set is re-synced; the OS then fires each one
// at its time even if the app has been killed since. Inherent limit: an app
// that is never opened schedules nothing new — acceptable for meeting alerts.
//
// Every entry point no-ops unless running natively WITH the plugin present, so
// this file is inert on the web and on older Android/iOS builds that predate
// the plugin (they load this same remote bundle).

import type { PersonFull } from "@/types/app";

export interface MeetingNotification {
  eventId: string;
  title: string;
  body: string;
  at: Date;
  personId?: string;
}

// iOS caps pending local notifications at 64 (silently dropping beyond it);
// keep well under so nothing the user expects gets dropped.
export const MAX_SCHEDULED = 20;

// Stable 31-bit positive int from an event id — LocalNotifications ids are
// Java ints on Android. Same event → same id, so re-scheduling replaces
// rather than duplicates even if a cancel is ever missed.
export function notificationId(eventId: string): number {
  let h = 0;
  for (let i = 0; i < eventId.length; i++) {
    h = (h * 31 + eventId.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 2147483647;
}

// All-day events carry a date-only start ("YYYY-MM-DD") — a lead-time alarm
// makes no sense for those; only timed meetings get notifications.
export function isTimedStart(start: string): boolean {
  return start.includes("T");
}

// Pure planning step (unit-testable): future fire-times only, soonest first,
// capped. `now` injectable for tests.
export function planNotifications(
  items: MeetingNotification[],
  now: Date = new Date()
): MeetingNotification[] {
  return items
    .filter((i) => i.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_SCHEDULED);
}

async function getPlugin() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (
      !Capacitor.isNativePlatform() ||
      !Capacitor.isPluginAvailable("LocalNotifications")
    ) {
      return null;
    }
    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );
    return LocalNotifications;
  } catch {
    return null;
  }
}

// True when this build can schedule at all (native + plugin shipped).
export async function notificationsSupported(): Promise<boolean> {
  return (await getPlugin()) !== null;
}

// Ask the OS for permission (Android 13+ runtime dialog / iOS prompt).
// Returns whether notifications may be shown.
export async function ensureNotificationPermission(): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return false;
  try {
    const current = await plugin.checkPermissions();
    if (current.display === "granted") return true;
    const asked = await plugin.requestPermissions();
    return asked.display === "granted";
  } catch {
    return false;
  }
}

// Replace the entire pending set with the given meetings. Cancelling ALL
// pending first is deliberate: meeting alerts are the only notifications this
// app schedules, so cancel-all is the simplest exact dedupe (events that moved,
// were deleted, or fell out of the window disappear for free).
export async function syncMeetingNotifications(
  items: MeetingNotification[]
): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) return;
  try {
    const perm = await plugin.checkPermissions();
    if (perm.display !== "granted") return;

    const pending = await plugin.getPending();
    if (pending.notifications.length > 0) {
      await plugin.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
      });
    }

    const plan = planNotifications(items);
    if (plan.length === 0) return;

    await plugin.schedule({
      notifications: plan.map((i) => ({
        id: notificationId(i.eventId),
        title: i.title,
        body: i.body,
        schedule: { at: i.at, allowWhileIdle: true },
        extra: i.personId ? { personId: i.personId } : undefined,
      })),
    });
  } catch {
    // Never let notification plumbing break the page that triggered it.
  }
}

export async function cancelAllMeetingNotifications(): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) return;
  try {
    const pending = await plugin.getPending();
    if (pending.notifications.length > 0) {
      await plugin.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
      });
    }
  } catch {
    /* ignore */
  }
}

// Tapping a notification opens the matched person's profile. Registered once
// per page load (PeopleListClient effect); safe to call on web (no-op).
export async function registerNotificationTapHandler(
  navigate: (path: string) => void
): Promise<(() => void) | undefined> {
  const plugin = await getPlugin();
  if (!plugin) return undefined;
  try {
    const handle = await plugin.addListener(
      "localNotificationActionPerformed",
      (action) => {
        const personId = action.notification.extra?.personId;
        if (typeof personId === "string" && personId) {
          navigate(`/people/${personId}`);
        }
      }
    );
    return () => {
      handle.remove();
    };
  } catch {
    return undefined;
  }
}

// Build the notification payloads from the home banner's matched alerts.
// Strings are passed in (caller has i18n): title template uses {name}.
export function buildMeetingNotifications(
  alerts: { event: { id: string; start: string; summary: string }; matchedPeople: PersonFull[] }[],
  leadMinutes: number,
  titleTemplate: string,
  formatBody: (start: string, summary: string) => string
): MeetingNotification[] {
  return alerts
    .filter((a) => isTimedStart(a.event.start))
    .map((a) => {
      const person = a.matchedPeople[0];
      const name = person?.name ?? a.event.summary;
      return {
        eventId: a.event.id,
        title: titleTemplate.replace("{name}", name),
        body: formatBody(a.event.start, a.event.summary),
        at: new Date(new Date(a.event.start).getTime() - leadMinutes * 60_000),
        personId: person?.id,
      };
    });
}
