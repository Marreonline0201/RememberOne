"use client";

// UpcomingMeetingAlert — fetches upcoming calendar events, matches them to
// saved people, and shows an alert card for each match.
// Mobile-first: full-width person rows, adequate touch targets.

import { useEffect, useRef, useState } from "react";
import { Bell, ChevronUp, MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { isToday, parseISO } from "date-fns";
import { formatTime } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  useLocalFlag,
  useLocalNumber,
  HOME_UPCOMING_COLLAPSED_KEY,
  HOME_DAYS_AHEAD_KEY,
  NOTIFY_MEETINGS_KEY,
  NOTIFY_LEAD_KEY,
} from "@/lib/use-dismiss-flag";
import {
  buildMeetingNotifications,
  syncMeetingNotifications,
} from "@/lib/meeting-notifications";
import type { UpcomingMeetingAlert as AlertType } from "@/types/app";

// When pre-meeting notifications are on, always fetch at least this many days
// so meetings beyond the DISPLAY window still get scheduled — shrinking the
// on-screen list must not silently shrink the alarms.
const NOTIFY_WINDOW_DAYS = 14;

function eventDateLine(start: string): string {
  const d = parseISO(start);
  const datePrefix = isToday(d)
    ? ""
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " ";
  return `${datePrefix}${formatTime(start)}`;
}

export function UpcomingMeetingAlert() {
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { t } = useLanguage();

  // Device-local prefs. The whole section collapses (persisted); the display
  // window is user-set in Account -> Calendar (default 7 days).
  const { on: collapsed, setOn: setCollapsed } = useLocalFlag(
    HOME_UPCOMING_COLLAPSED_KEY
  );
  const { value: displayDays, hydrated: daysHydrated } = useLocalNumber(
    HOME_DAYS_AHEAD_KEY,
    7
  );
  const { on: notifyOn, hydrated: notifyHydrated } = useLocalFlag(
    NOTIFY_MEETINGS_KEY
  );
  const { value: leadMin } = useLocalNumber(NOTIFY_LEAD_KEY, 30);

  const prefsHydrated = daysHydrated && notifyHydrated;
  const fetchDays = Math.max(displayDays, notifyOn ? NOTIFY_WINDOW_DAYS : 1);

  useEffect(() => {
    if (!prefsHydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/calendar/events?days=${fetchDays}`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.data) setAlerts(json.data);
      } catch {
        // silently fail — calendar alerts are non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefsHydrated, fetchDays]);

  // Re-sync the phone's scheduled pre-meeting notifications from the full
  // fetched window (NOT the display-filtered list; in-memory dismissals don't
  // cancel alarms either). Inert on web/old builds — see meeting-notifications.
  useEffect(() => {
    if (!notifyOn || alerts.length === 0) return;
    const items = buildMeetingNotifications(
      alerts,
      leadMin,
      t("notif.meeting_title"),
      (start, summary) => `${eventDateLine(start)} · ${summary}`
    );
    void syncMeetingNotifications(items);
  }, [alerts, notifyOn, leadMin, t]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    if (openMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenu]);

  if (loading || alerts.length === 0) return null;

  // Display filter: dismissed rows out, and only meetings inside the user's
  // chosen window (the fetch may span further for notification scheduling).
  const cutoff = Date.now() + displayDays * 24 * 60 * 60 * 1000;
  const visibleAlerts = alerts.filter(
    (a) =>
      !dismissed.has(a.event.id) &&
      parseISO(a.event.start).getTime() <= cutoff
  );
  if (visibleAlerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Section header: count + collapse toggle for the whole banner */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? t("meetings.expand") : t("meetings.collapse")}
        className="flex items-center gap-2 w-full h-9 px-3 rounded-[10px_2px_10px_2px] border transition-opacity active:opacity-80"
        style={{ backgroundColor: "#f0e8ff", borderColor: "#dccaff" }}
      >
        <Bell className="w-4 h-4 shrink-0" style={{ color: "#482d7c" }} />
        <span
          className="flex-1 min-w-0 text-left text-[13px] uppercase tracking-wide truncate"
          style={{ fontFamily: "'Hammersmith One', sans-serif", color: "#284e72" }}
        >
          {t("meetings.upcoming")}
        </span>
        <span
          className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-medium text-white flex items-center justify-center"
          style={{ background: "linear-gradient(to right, #284e72, #482d7c)" }}
        >
          {visibleAlerts.length}
        </span>
        <ChevronUp
          className={`w-4 h-4 shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`}
          style={{ color: "#284e72" }}
        />
      </button>

      {!collapsed &&
        visibleAlerts.map((alert) => {
        const person = alert.matchedPeople[0];
        const isOpen = openMenu === alert.event.id;

        return (
          <div
            key={alert.event.id}
            className="relative flex items-center gap-3 px-4 rounded-[10px] h-[61px]"
            style={{ background: "linear-gradient(to right, #284e72, #482d7c)" }}
          >
            {/* Bell icon */}
            <Bell className="w-[22px] h-[22px] text-white shrink-0" />

            {/* Time + name */}
            <div className="flex-1 min-w-0">
              <p
                className="text-white uppercase tracking-wide text-[15px] truncate"
                style={{ fontFamily: "'Hammersmith One', sans-serif" }}
              >
                {eventDateLine(alert.event.start)} {person?.name ?? alert.event.summary}
              </p>
            </div>

            {/* Three-dot menu */}
            <div className="relative shrink-0" ref={isOpen ? menuRef : undefined}>
              <button
                onClick={() => setOpenMenu(isOpen ? null : alert.event.id)}
                className="flex items-center justify-center p-2"
                aria-label="Alert options"
              >
                <MoreVertical className="w-4 h-4 text-white opacity-80" />
              </button>

              {isOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg overflow-hidden shadow-lg"
                  style={{ background: "#1e2235" }}
                >
                  {person && (
                    <button
                      onClick={() => {
                        setOpenMenu(null);
                        router.push(`/people/${person.id}`);
                      }}
                      className="w-full text-left px-4 py-3 text-white text-sm hover:bg-white/10 transition-colors"
                    >
                      View Profile
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setOpenMenu(null);
                      setDismissed((prev) => new Set(Array.from(prev).concat(alert.event.id)));
                    }}
                    className="w-full text-left px-4 py-3 text-white/70 text-sm hover:bg-white/10 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
