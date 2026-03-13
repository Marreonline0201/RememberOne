// Main dashboard — shows all saved people with full detail inline

import { createClient } from "@/lib/supabase/server";
import { getAllPeopleFull } from "@/lib/people";
import { PeopleGrid } from "@/components/PeopleGrid";
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
          <h1 className="text-xl font-extrabold text-gray-900 md:text-2xl">
            Your People
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {people.length === 0
              ? "No people saved yet. Log your first meeting!"
              : `${people.length} ${people.length === 1 ? "person" : "people"} saved`}
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
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-5 shadow-inner" style={{ background: "linear-gradient(to bottom right, #d0f2ff, #dccaff)" }}>
            <Users className="w-12 h-12" style={{ color: "#482d7c" }} />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
            No one here yet
          </h2>
          <p className="text-muted-foreground max-w-xs mb-6 text-sm leading-relaxed">
            Tap <strong>Log</strong> below to add your first person — describe
            who you met and AI will extract the details.
          </p>
          <Button asChild size="lg" className="h-12 px-6 font-semibold">
            <Link href="/meet">
              <UserPlus className="w-4 h-4 mr-2" />
              Log your first meeting
            </Link>
          </Button>
          {/* Arrow pointing at the bottom Log FAB on mobile */}
          <div className="md:hidden mt-8 flex flex-col items-center gap-1 text-muted-foreground">
            <p className="text-xs">or use the button below</p>
            <svg className="w-5 h-5 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          </div>
        </div>
      ) : (
        /*
          PeopleGrid is a client component that adds a live search bar
          and renders the responsive 1-col / 2-col person card grid.
        */
        <PeopleGrid people={people} />
      )}
    </div>
  );
}
