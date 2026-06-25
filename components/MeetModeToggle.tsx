"use client";

// Speak / Write segmented toggle shown at the top of the logging screens. Lets
// the user pick voice (/meet) or typing (/meet/write) for adding a new person.
// The inactive side is a Link to the other route, so switching is a normal
// navigation (and Next prefetches the target). Rendered in general mode only —
// the person-specific "log meeting with X" flow stays voice-first.

import Link from "next/link";
import { Mic, PenLine } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const activeStyle = {
  background: "linear-gradient(to right, #284e72, #482d7c)",
};

export function MeetModeToggle({ active }: { active: "speak" | "write" }) {
  const { t } = useLanguage();

  return (
    <div
      className="flex items-center gap-1 p-1 rounded-lg w-fit mx-auto mb-3"
      style={{ backgroundColor: "rgba(220,202,255,0.3)" }}
      role="tablist"
      aria-label="Input mode"
    >
      <Link
        href="/meet"
        role="tab"
        aria-selected={active === "speak"}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
          active === "speak" ? "text-white" : "text-[#5e7983]"
        )}
        style={active === "speak" ? activeStyle : undefined}
      >
        <Mic className="w-3.5 h-3.5" />
        {t("write.toggle_speak")}
      </Link>
      <Link
        href="/meet/write"
        role="tab"
        aria-selected={active === "write"}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
          active === "write" ? "text-white" : "text-[#5e7983]"
        )}
        style={active === "write" ? activeStyle : undefined}
      >
        <PenLine className="w-3.5 h-3.5" />
        {t("write.toggle_write")}
      </Link>
    </div>
  );
}
