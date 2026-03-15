"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { LogOut, Loader2, Trash2, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";

interface Props {
  user: SupabaseUser;
}

export function AccountPage({ user }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [signingOut, setSigningOut] = useState(false);

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "User";

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-5">

      {/* Profile card */}
      <div
        className="p-5 rounded-[10px_2px_10px_2px]"
        style={{ background: "linear-gradient(52deg, #d0f2ff 0%, #dccaff 100%)" }}
      >
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 shrink-0">
            <AvatarFallback
              className="text-xl font-bold text-white"
              style={{ background: "linear-gradient(135deg, #284e72, #482d7c)" }}
            >
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p
              className="text-[22px] leading-tight text-black truncate"
              style={{ fontFamily: "'Hammersmith One', sans-serif" }}
            >
              {displayName}
            </p>
            <p className="text-[13px] mt-0.5 truncate" style={{ color: "#5e7983" }}>
              {user.email}
            </p>
          </div>
        </div>
      </div>

      {/* Sign out */}
      <div
        className="p-4 rounded-[10px_2px_10px_2px]"
        style={{ backgroundColor: "#f5f0ff", border: "1px solid #dccaff" }}
      >
        <p
          className="text-[13px] uppercase mb-3"
          style={{ color: "#665b7b", fontFamily: "'Hammersmith One', sans-serif" }}
        >
          Session
        </p>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-3 w-full h-11 px-4 rounded-[8px_2px_8px_2px] text-sm font-medium text-white transition-opacity active:opacity-80 disabled:opacity-60"
          style={{ background: "linear-gradient(to right, #284e72, #482d7c)" }}
        >
          {signingOut ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          {signingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>

      {/* Account deletion */}
      <div
        className="p-4 rounded-[10px_2px_10px_2px]"
        style={{ backgroundColor: "#f5f0ff", border: "1px solid #dccaff" }}
      >
        <p
          className="text-[13px] uppercase mb-3"
          style={{ color: "#665b7b", fontFamily: "'Hammersmith One', sans-serif" }}
        >
          Delete Account
        </p>

        <div className="space-y-3 text-sm" style={{ color: "#284e72" }}>
          <p className="leading-relaxed text-[13px]" style={{ color: "#5e7983" }}>
            To permanently delete your account and all associated data (contacts, meetings, notes),
            follow these steps:
          </p>

          <ol className="space-y-2.5">
            {[
              "Sign in to RememberOne at remember-one-1.vercel.app",
              "Open this Account page by tapping your profile picture",
              'Tap "Sign out" above to confirm your identity',
              "Send a deletion request to the email below — include the email address associated with your account",
              "We will permanently delete your account and all data within 30 days",
            ].map((step, i) => (
              <li key={i} className="flex gap-3 text-[13px]" style={{ color: "#5e7983" }}>
                <span
                  className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                  style={{ backgroundColor: "#284e72" }}
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          <a
            href="mailto:support@rememberone.app"
            className="flex items-center gap-2 mt-3 h-11 px-4 rounded-[8px_2px_8px_2px] text-sm font-medium border transition-opacity active:opacity-80"
            style={{ borderColor: "#dccaff", color: "#284e72", backgroundColor: "white" }}
          >
            <Mail className="w-4 h-4" />
            comgamemarre@gmail.com
          </a>

          <p className="text-[11px] pt-1" style={{ color: "#5e7983" }}>
            Note: deletion is permanent and cannot be undone. All your saved contacts and meeting
            history will be removed.
          </p>
        </div>

        <div className="mt-4 flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: "rgba(220,202,255,0.4)" }}>
          <Trash2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#665b7b" }} />
          <p className="text-[12px]" style={{ color: "#665b7b" }}>
            Data deleted includes: your profile, all saved people, meeting logs, notes, family
            members, and calendar connections.
          </p>
        </div>
      </div>

      {/* Privacy Policy */}
      <Link
        href="/privacy"
        className="flex items-center gap-3 w-full h-11 px-4 rounded-[10px_2px_10px_2px] text-sm border transition-opacity active:opacity-80"
        style={{ borderColor: "#dccaff", color: "#284e72", backgroundColor: "#f5f0ff" }}
      >
        <ShieldCheck className="w-4 h-4 shrink-0" />
        Privacy Policy
      </Link>

    </div>
  );
}
