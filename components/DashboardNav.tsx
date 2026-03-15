"use client";

// DashboardNav — dual-mode navigation.
// Mobile (< md): sticky top header + sticky bottom tab bar (People | Mic | Calendar).
// Desktop (md+): sticky top horizontal bar with logo, links, user menu.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, CalendarDays, Mic } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  user: SupabaseUser;
}

export function DashboardNav({ user }: Props) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email ??
    "User";

  const avatarFallback = (
    <Avatar className="w-8 h-8">
      <AvatarFallback
        className="text-white text-xs font-semibold"
        style={{ background: "linear-gradient(135deg, #284e72, #482d7c)" }}
      >
        {getInitials(displayName)}
      </AvatarFallback>
    </Avatar>
  );

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
            { href: "/", label: t("nav.people") },
            { href: "/meet", label: t("nav.log_meeting") },
            { href: "/calendar", label: t("nav.calendar") },
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

        {/* Avatar → account page */}
        <Link href="/account" aria-label="Account">
          {avatarFallback}
        </Link>
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

        {/* Avatar → account page */}
        <Link href="/account" className="absolute right-4" aria-label="Account">
          {avatarFallback}
        </Link>
      </div>
    </header>
  );

  // ── MOBILE BOTTOM TAB BAR ────────────────────────────────────────────────
  const mobileNav = (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t mobile-nav-safe"
      style={{ backgroundColor: "#fbf6ff", borderColor: "#dccaff" }}
    >
      <div className="flex items-stretch h-16">
        {/* People tab */}
        <Link
          href="/"
          className="flex items-center justify-center flex-1"
          aria-label="People"
        >
          <Users
            className={`w-5 h-5 ${pathname === "/" ? "text-primary" : "text-muted-foreground"}`}
          />
        </Link>

        {/* Log meeting — gradient-ring mic button */}
        <Link
          href="/meet"
          className="flex items-center justify-center flex-1"
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
        </Link>

        {/* Calendar tab */}
        <Link
          href="/calendar"
          className="flex items-center justify-center flex-1"
          aria-label="Calendar"
        >
          <CalendarDays
            className={`w-5 h-5 ${
              pathname === "/calendar" ? "text-primary" : "text-muted-foreground"
            }`}
          />
        </Link>
      </div>
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
