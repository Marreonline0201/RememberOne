"use client";

// Speak / Write segmented toggle shown at the top of the logging screens.
// Two modes:
//  - Link mode (default): tabs navigate between /meet (voice) and /meet/write
//    (typing) for adding a NEW person; the inactive side is a Link so switching
//    is a normal navigation (and Next prefetches the target).
//  - Button mode (`onSelect` provided): tabs just report the chosen mode —
//    used by the person-scoped "log meeting with X" screen, which swaps its
//    input UI in place instead of navigating.

import Link from "next/link";
import { Mic, PenLine } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const activeStyle = {
  background: "linear-gradient(to right, #284e72, #482d7c)",
};

type Mode = "speak" | "write";

export function MeetModeToggle({
  active,
  onSelect,
}: {
  active: Mode;
  onSelect?: (mode: Mode) => void;
}) {
  const { t } = useLanguage();

  const tabs: { mode: Mode; href: string; icon: React.ReactNode; label: string }[] = [
    {
      mode: "speak",
      href: "/meet",
      icon: <Mic className="w-3.5 h-3.5" />,
      label: t("write.toggle_speak"),
    },
    {
      mode: "write",
      href: "/meet/write",
      icon: <PenLine className="w-3.5 h-3.5" />,
      label: t("write.toggle_write"),
    },
  ];

  return (
    <div
      className="flex items-center gap-1 p-1 rounded-lg w-fit mx-auto mb-3"
      style={{ backgroundColor: "rgba(220,202,255,0.3)" }}
      role="tablist"
      aria-label="Input mode"
    >
      {tabs.map(({ mode, href, icon, label }) => {
        const className = cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
          active === mode ? "text-white" : "text-[#5e7983]"
        );
        const style = active === mode ? activeStyle : undefined;
        return onSelect ? (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={active === mode}
            onClick={() => onSelect(mode)}
            className={className}
            style={style}
          >
            {icon}
            {label}
          </button>
        ) : (
          <Link
            key={mode}
            href={href}
            role="tab"
            aria-selected={active === mode}
            className={className}
            style={style}
          >
            {icon}
            {label}
          </Link>
        );
      })}
    </div>
  );
}
