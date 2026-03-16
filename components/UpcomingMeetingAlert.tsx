"use client";

// UpcomingMeetingAlert — fetches upcoming calendar events, matches them to
// saved people, and shows an alert card for each match.
// Mobile-first: full-width person rows, adequate touch targets.

import { useEffect, useRef, useState } from "react";
import { Bell, MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { isToday, parseISO } from "date-fns";
import { formatTime } from "@/lib/utils";
import type { UpcomingMeetingAlert as AlertType } from "@/types/app";

export function UpcomingMeetingAlert() {
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.event.id));
  if (visibleAlerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {visibleAlerts.map((alert) => {
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
                {(() => {
                  const d = parseISO(alert.event.start);
                  const datePrefix = isToday(d) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " ";
                  return `${datePrefix}${formatTime(alert.event.start)}`;
                })()} {person?.name ?? alert.event.summary}
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
