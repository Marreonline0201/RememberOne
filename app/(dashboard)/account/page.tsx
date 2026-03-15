import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AccountPage } from "@/components/AccountPage";

export const metadata = { title: "Account — RememberOne" };

export default async function Account() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <AccountPage user={user} />;
}
