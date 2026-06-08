import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/DashboardNav";
import { OfflineBanner } from "@/components/OfflineBanner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { TimezoneProvider } from "@/contexts/TimezoneContext";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const initialLanguage = (user.user_metadata?.language as string | null) ?? null;
  const initialTzMode = (user.user_metadata?.tz_mode as string | null) ?? null;
  const initialTzValue = (user.user_metadata?.tz_value as string | null) ?? null;

  return (
    <LanguageProvider initialLanguage={initialLanguage}>
      <TimezoneProvider initialMode={initialTzMode} initialValue={initialTzValue}>
        <div className="min-h-screen bg-background">
          <DashboardNav user={user} />
          {/*
            On mobile the bottom tab bar is 64px tall (h-16).
            We add pb-20 (80px) so content is never hidden behind it.
            On md+ the bottom bar is hidden, so we reset to pb-8.
          */}
          <main className="max-w-5xl mx-auto px-5 pt-safe-header pb-24 md:px-8 md:pt-6 md:pb-10">
            <OfflineBanner />
            {children}
          </main>
        </div>
      </TimezoneProvider>
    </LanguageProvider>
  );
}
