"use client";

// CalendarConnect — CTA card to connect Google Calendar.
// Shown on the dashboard when no calendar is connected.
// Mobile-first: stacked layout on narrow screens, horizontal on sm+.

import { Suspense, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ExternalLink } from "lucide-react";
import { useSearchParams } from "next/navigation";

// Inner component reads search params — must be inside a Suspense boundary.
function CalendarConnectInner() {
  const searchParams = useSearchParams();
  const connected = searchParams.get("calendar_connected") === "true";
  const error = searchParams.get("calendar_error");

  const [connecting, setConnecting] = useState(false);

  function handleConnect() {
    setConnecting(true);
    window.location.href = "/api/calendar/connect";
  }

  if (connected) return null;

  return (
    <Card className="border-dashed border-2 border-blue-200 bg-blue-50/50">
      <CardContent className="py-4 px-4 sm:py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          {/* Icon + text */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 text-sm">
                Connect Google Calendar
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Get reminders with saved profiles before your upcoming meetings.
              </p>
              {error && (
                <p className="text-xs text-red-600 mt-1">
                  Could not connect: {error.replace(/_/g, " ")}. Please try again.
                </p>
              )}
            </div>
          </div>

          {/* Connect button */}
          <Button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full sm:w-auto h-11 sm:h-9 gap-1.5 shrink-0"
          >
            {connecting ? "Connecting..." : "Connect"}
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CalendarConnect() {
  return (
    <Suspense fallback={null}>
      <CalendarConnectInner />
    </Suspense>
  );
}
