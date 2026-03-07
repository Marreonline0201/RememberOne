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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your People</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {people.length === 0
              ? "No people saved yet. Log your first meeting!"
              : `${people.length} ${people.length === 1 ? "person" : "people"} · most recently updated first`}
          </p>
        </div>
        <Button asChild>
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
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-blue-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No people saved yet</h2>
          <p className="text-muted-foreground max-w-sm mb-6">
            After meeting someone, click &quot;Log a meeting&quot; and describe who you
            met. AI will extract the key details automatically.
          </p>
          <Button asChild>
            <Link href="/meet">
              <UserPlus className="w-4 h-4 mr-2" />
              Log your first meeting
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {people.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </div>
      )}
    </div>
  );
}
