import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/DashboardNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav user={user} />
      {/*
        On mobile the bottom tab bar is 64px tall (h-16).
        We add pb-20 (80px) so content is never hidden behind it.
        On md+ the bottom bar is hidden, so we reset to pb-8.
      */}
      <main className="max-w-5xl mx-auto px-5 pt-safe-header pb-24 md:px-8 md:pt-6 md:pb-10">
        {children}
      </main>
    </div>
  );
}
