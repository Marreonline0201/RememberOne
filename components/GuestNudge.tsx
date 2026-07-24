"use client";

// Small dismissible banner shown to GUEST (anonymous) users once they have
// data worth protecting: their notes are reachable only via this device's
// session token, so nudge them toward the Settings upgrade card. Renders
// nothing for signed-in accounts.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDismissFlag } from "@/lib/use-dismiss-flag";
import { useLanguage } from "@/contexts/LanguageContext";

export const GUEST_NUDGE_KEY = "ro.guest.nudgeDismissed";

export function GuestNudge() {
  const { language } = useLanguage();
  const ko = language === "ko";
  const { dismissed, setDismissed, hydrated } = useDismissFlag(GUEST_NUDGE_KEY);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth
      .getUser()
      .then(({ data }) => setIsGuest(Boolean(data.user?.is_anonymous)))
      .catch(() => {});
  }, []);

  if (!isGuest || !hydrated || dismissed) return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-[10px_2px_10px_2px] border"
      style={{ backgroundColor: "#f0e8ff", borderColor: "#dccaff" }}
    >
      <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: "#482d7c" }} />
      <Link href="/account" className="flex-1 min-w-0 text-[12px] leading-snug" style={{ color: "#284e72" }}>
        {ko
          ? "게스트로 사용 중이에요 — 계정을 만들면 메모를 안전하게 보관할 수 있어요."
          : "You're a guest — create a free account to keep your notes safe."}{" "}
        <span className="underline font-medium">{ko ? "계정 만들기" : "Create account"}</span>
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={ko ? "닫기" : "Dismiss"}
        className="shrink-0 w-6 h-6 flex items-center justify-center transition-opacity active:opacity-70"
        style={{ color: "#5e7983" }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
