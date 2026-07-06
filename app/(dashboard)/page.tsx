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

  // Snapshot the user profile so the account page can render offline (the home
  // load is the single entry point that has the server `user`).
  const initialProfile = {
    email: user.email ?? null,
    full_name: (user.user_metadata?.full_name as string | null) ?? null,
    language: (user.user_metadata?.language as string | null) ?? null,
    tz_mode: (user.user_metadata?.tz_mode as string | null) ?? null,
    tz_value: (user.user_metadata?.tz_value as string | null) ?? null,
  };

  return (
    <PeopleListClient
      userId={user.id}
      initialPeople={people}
      hasCalendarConnection={!!calendarConnection}
      initialProfile={initialProfile}
    />
  );
}
