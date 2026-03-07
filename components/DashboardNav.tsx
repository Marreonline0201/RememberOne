"use client";

// DashboardNav — top navigation bar with logo, nav links, and user menu

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brain, UserPlus, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  return (
    <header className="border-b bg-white sticky top-0 z-40 safe-top">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-gray-900 shrink-0">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-sm">RememberOne</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1 ml-2">
          <Link
            href="/"
            className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
              pathname === "/"
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-gray-900 hover:bg-accent"
            }`}
          >
            People
          </Link>
          <Link
            href="/meet"
            className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
              pathname === "/meet"
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-gray-900 hover:bg-accent"
            }`}
          >
            Log meeting
          </Link>
        </nav>

        <div className="flex-1" />

        {/* Quick action button */}
        <Button size="sm" asChild className="hidden sm:flex gap-1.5">
          <Link href="/meet">
            <UserPlus className="w-3.5 h-3.5" />
            Log meeting
          </Link>
        </Button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
          </button>

          {menuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              {/* Dropdown */}
              <div className="absolute right-0 top-10 z-50 w-52 rounded-lg border bg-white shadow-lg py-1">
                <div className="px-3 py-2 border-b">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
}
