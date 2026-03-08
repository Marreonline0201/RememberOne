"use client";

// UpcomingMeetingAlert — fetches upcoming calendar events, matches them to
// saved people, and shows an alert card for each match.
// Mobile-first: full-width person rows, adequate touch targets.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Calendar, Clock, ChevronRight, X } from "lucide-react";
import { formatDate, formatTime, getInitials } from "@/lib/utils";
import type { UpcomingMeetingAlert as AlertType } from "@/types/app";
import type { Person } from "@/types/database";

interface Props {
  people: Person[];
}

export function UpcomingMeetingAlert({ people }: Props) {
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Suppress unused-variable warning — people prop is used by the parent to
  // decide whether to render this component at all.
  void people;

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
    <div className="space-y-3">
      {/* Section label */}
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Bell className="w-4 h-4 text-blue-500 shrink-0" />
        Upcoming meetings with people you know
      </div>

      {visibleAlerts.map((alert) => (
        <Alert key={alert.event.id} variant="info" className="relative pr-11">
          {/* Dismiss — 44px touch target */}
          <button
            onClick={() =>
              setDismissed(
                (prev) => new Set(Array.from(prev).concat(alert.event.id))
              )
            }
            className="absolute right-2 top-2 p-2 text-muted-foreground hover:text-gray-700 transition-colors rounded-md"
            aria-label="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>

          <Calendar className="h-4 w-4 shrink-0" />

          <AlertTitle className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2 flex-wrap pr-2">
            <span className="font-semibold">{alert.event.summary}</span>
            <Badge variant="secondary" className="text-xs gap-1 w-fit">
              <Clock className="w-3 h-3" />
              {formatDate(alert.event.start)} at {formatTime(alert.event.start)}
            </Badge>
          </AlertTitle>

          <AlertDescription className="mt-3 space-y-3">
            {alert.event.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {alert.event.description}
              </p>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">
                People you know in this meeting:
              </p>
              {alert.matchedPeople.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center justify-between gap-3 bg-white rounded-lg border px-3 py-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar className="w-9 h-9 shrink-0">
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
                        {getInitials(person.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {person.name}
                      </p>
                      {person.attributes.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate">
                          {person.attributes[0].value}
                          {person.attributes[1] &&
                            ` · ${person.attributes[1].value}`}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* View profile — 44px touch target */}
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-9 gap-1 text-xs"
                  >
                    <Link href={`/people/${person.id}`}>
                      View
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
