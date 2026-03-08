// Main dashboard — shows all saved people with full detail inline

import { createClient } from "@/lib/supabase/server";
import { getAllPeopleFull } from "@/lib/people";
import { PersonCard } from "@/components/PersonCard";
import { UpcomingMeetingAlert } from "@/components/UpcomingMeetingAlert";
import { CalendarConnect } from "@/components/CalendarConnect";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { UserPlus, Users } from "lucide-react";

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const people = await getAllPeopleFull(supabase, user.id);

  const { data: calendarConnection } = await supabase
    .from("calendar_connections")
    .select("id, calendar_id, connected_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            Your People
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {people.length === 0
              ? "No people saved yet. Log your first meeting!"
              : `${people.length} ${people.length === 1 ? "person" : "people"} · most recently updated first`}
          </p>
        </div>
        {/* Hidden on mobile — the bottom tab bar handles navigation */}
        <Button asChild className="hidden md:flex shrink-0">
          <Link href="/meet">
            <UserPlus className="w-4 h-4 mr-2" />
            Log a meeting
          </Link>
        </Button>
      </div>

      {/* Upcoming meeting alerts */}
      {calendarConnection && people.length > 0 && (
        <UpcomingMeetingAlert people={people} />
      )}

      {/* Calendar connect CTA */}
      {!calendarConnection && <CalendarConnect />}

      {/* People list */}
      {people.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-blue-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            No people saved yet
          </h2>
          <p className="text-muted-foreground max-w-xs mb-6 text-sm leading-relaxed">
            After meeting someone, tap &quot;Log&quot; below and describe who you
            met. AI will extract the key details automatically.
          </p>
          {/* CTA visible on mobile since there's no header button */}
          <Button asChild>
            <Link href="/meet">
              <UserPlus className="w-4 h-4 mr-2" />
              Log your first meeting
            </Link>
          </Button>
        </div>
      ) : (
        /*
          Mobile: single column
          md: 2 columns
          xl: still 2 columns (cards are rich, 3 would be cramped)
        */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {people.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </div>
      )}
    </div>
  );
}
