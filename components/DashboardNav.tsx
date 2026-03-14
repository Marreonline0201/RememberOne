"use client";

// DashboardNav — dual-mode navigation.
// Mobile (< md): sticky top header + sticky bottom tab bar (People | Mic | Calendar).
// Desktop (md+): sticky top horizontal bar with logo, links, user menu.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Loader2, Users, CalendarDays, Mic } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { getInitials } from "@/lib/utils";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useState } from "react";

interface Props {
  user: SupabaseUser;
}

export function DashboardNav({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email ??
    "User";

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // ── DESKTOP TOP NAV ──────────────────────────────────────────────────────
  const desktopNav = (
    <header
      className="hidden md:block sticky top-0 z-40 safe-top"
      style={{ background: "linear-gradient(to bottom, #ddf6ff, #fbf6ff)" }}
    >
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0"
          style={{ fontFamily: "'Hammersmith One', sans-serif" }}
        >
          <span className="text-sm font-normal uppercase tracking-wider text-black">
            Remember One
          </span>
        </Link>

        <nav className="flex items-center gap-1 ml-2">
          {[
            { href: "/", label: "People" },
            { href: "/meet", label: "Log meeting" },
            { href: "/calendar", label: "Calendar" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                pathname === href
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-gray-900 hover:bg-accent"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Open user menu"
          >
            <Avatar className="w-8 h-8">
              <AvatarFallback
                className="text-white text-xs font-semibold"
                style={{ background: "linear-gradient(to bottom right, #284e72, #482d7c)" }}
              >
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute right-0 top-10 z-50 w-52 rounded-lg shadow-lg py-1"
                style={{ backgroundColor: "#fbf6ff", border: "1px solid #dccaff" }}
              >
                <div className="px-3 py-2 border-b">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-accent transition-colors disabled:opacity-60"
                >
                  {signingOut ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                  {signingOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );

  // ── MOBILE TOP HEADER ────────────────────────────────────────────────────
  const mobileHeader = (
    <header
      className="md:hidden fixed top-0 inset-x-0 z-40 safe-top"
      style={{ background: "linear-gradient(to bottom, #ddf6ff, #fbf6ff)" }}
    >
      <div className="relative flex items-center justify-center px-4 h-[80px]">
        <span
          className="text-[28px] tracking-widest text-black uppercase select-none font-normal"
          style={{ fontFamily: "'Hammersmith One', sans-serif" }}
        >
          Remember One
        </span>

        {/* Avatar — opens account sheet */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="absolute right-4 flex items-center focus:outline-none"
          aria-label="Open account menu"
        >
          <Avatar className="w-8 h-8">
            <AvatarFallback
              className="text-white text-xs font-semibold"
              style={{ background: "linear-gradient(135deg, #284e72, #482d7c)" }}
            >
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
        </button>
      </div>
    </header>
  );

  // ── MOBILE BOTTOM TAB BAR ────────────────────────────────────────────────
  // Tabs: People (/) | Mic (/meet) | Calendar (/calendar)
  const mobileNav = (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t mobile-nav-safe"
      style={{ backgroundColor: "#fbf6ff", borderColor: "#dccaff" }}
    >
      <div className="flex items-stretch h-16">
        {/* People tab */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center flex-1 gap-1 text-[11px] font-medium transition-colors ${
            pathname === "/" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Users
            className={`w-5 h-5 ${pathname === "/" ? "text-primary" : "text-muted-foreground"}`}
          />
          People
        </Link>

        {/* Log meeting — gradient-ring mic button */}
        <Link
          href="/meet"
          className="flex flex-col items-center justify-center flex-1 gap-1 text-[11px] font-medium transition-colors"
          aria-label="Log a meeting"
        >
          <div
            className="w-[52px] h-[52px] rounded-full p-[2.5px] shadow-md"
            style={{ background: "linear-gradient(135deg, #00d4f7, #c84b8a, #482d7c)" }}
          >
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
              <Mic
                className="w-5 h-5"
                style={{ color: pathname === "/meet" ? "#482d7c" : "#284e72" }}
              />
            </div>
          </div>
          <span className={pathname === "/meet" ? "text-primary" : "text-muted-foreground"}>
            Log
          </span>
        </Link>

        {/* Calendar tab */}
        <Link
          href="/calendar"
          className={`flex flex-col items-center justify-center flex-1 gap-1 text-[11px] font-medium transition-colors ${
            pathname === "/calendar" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <CalendarDays
            className={`w-5 h-5 ${
              pathname === "/calendar" ? "text-primary" : "text-muted-foreground"
            }`}
          />
          Calendar
        </Link>
      </div>

      {/* Account sheet — slides up from bottom */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className="fixed bottom-0 inset-x-0 z-50 rounded-t-2xl shadow-xl safe-bottom"
            style={{ backgroundColor: "#fbf6ff" }}
          >
            <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1" />
            <div className="px-5 py-4 border-b">
              <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <div className="px-5 py-3">
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex items-center gap-3 w-full py-3 text-sm text-gray-700 disabled:opacity-60"
              >
                {signingOut ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <LogOut className="w-5 h-5 text-muted-foreground" />
                )}
                {signingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
            <div className="h-2" />
          </div>
        </>
      )}
    </nav>
  );

  return (
    <>
      {desktopNav}
      {mobileHeader}
      {mobileNav}
    </>
  );
}
