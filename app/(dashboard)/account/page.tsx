import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AccountPage } from "@/components/AccountPage";

export const metadata = { title: "Account — RememberOne" };

export default async function Account() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: calendarConnection } = await supabase
    .from("calendar_connections")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return <AccountPage user={user} hasCalendarConnection={!!calendarConnection} />;
}
