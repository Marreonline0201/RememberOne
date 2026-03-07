"use client";

// CalendarConnect — CTA card to connect Google Calendar.
// Shown on the dashboard when no calendar is connected.

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ExternalLink } from "lucide-react";
import { useSearchParams } from "next/navigation";

export function CalendarConnect() {
  const searchParams = useSearchParams();
  const connected = searchParams.get("calendar_connected") === "true";
  const error = searchParams.get("calendar_error");

  const [connecting, setConnecting] = useState(false);

  function handleConnect() {
    setConnecting(true);
    window.location.href = "/api/calendar/connect";
  }

  if (connected) return null; // Dashboard will refresh and show alerts

  return (
    <Card className="border-dashed border-2 border-blue-200 bg-blue-50/50">
      <CardContent className="py-5 px-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 text-sm">
              Connect Google Calendar
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get reminders with saved profiles before your upcoming meetings.
            </p>
            {error && (
              <p className="text-xs text-red-600 mt-1">
                Could not connect: {error.replace(/_/g, " ")}. Please try again.
              </p>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={connecting}
            className="shrink-0 gap-1.5"
          >
            {connecting ? "Connecting..." : "Connect"}
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
