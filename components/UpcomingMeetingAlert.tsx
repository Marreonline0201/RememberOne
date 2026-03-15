"use client";

// UpcomingMeetingAlert — fetches upcoming calendar events, matches them to
// saved people, and shows an alert card for each match.
// Mobile-first: full-width person rows, adequate touch targets.

import { useEffect, useState } from "react";
import { Bell, MoreVertical } from "lucide-react";
import { formatTime } from "@/lib/utils";
import type { UpcomingMeetingAlert as AlertType } from "@/types/app";

export function UpcomingMeetingAlert() {
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const res = await fetch("/api/calendar/events");
        if (!res.ok) return;
        const json = await res.json();
        if (json.data) setAlerts(json.data);
      } catch {
        // silently fail — calendar alerts are non-critical
      } finally {
        setLoading(false);
      }
    }
    fetchAlerts();
  }, []);

  if (loading || alerts.length === 0) return null;

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.event.id));
  if (visibleAlerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {visibleAlerts.map((alert) => (
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
              {formatTime(alert.event.start)} {alert.matchedPeople[0]?.name ?? alert.event.summary}
            </p>
          </div>

          {/* Three-dot dismiss */}
          <button
            onClick={() =>
              setDismissed(
                (prev) => new Set(Array.from(prev).concat(alert.event.id))
              )
            }
            className="flex flex-col items-center justify-center gap-[3px] p-2 shrink-0"
            aria-label="Dismiss alert"
          >
            <MoreVertical className="w-4 h-4 text-white opacity-80" />
          </button>
        </div>
      ))}
    </div>
  );
}
