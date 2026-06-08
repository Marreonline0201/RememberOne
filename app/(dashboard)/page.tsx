// Home — fetches people server-side as the initial seed; the list itself renders
// from the local offline store (PeopleListClient) so it works offline and
// reflects queued edits/deletes.

import { createClient } from "@/lib/supabase/server";
import { getAllPeopleFull } from "@/lib/people";
import { PeopleListClient } from "@/components/PeopleListClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const people = await getAllPeopleFull(supabase, user.id);

  const { data: calendarConnection } = await supabase
    .from("calendar_connections")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <PeopleListClient
      initialPeople={people}
      hasCalendarConnection={!!calendarConnection}
    />
  );
}
