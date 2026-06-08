"use client";

// Slim banner shown at the top of the dashboard content when the device is
// offline, so the read-only/cached state is obvious. Disappears when back online.

import { WifiOff } from "lucide-react";
import { useOnline } from "@/lib/use-online";
import { useLanguage } from "@/contexts/LanguageContext";

export function OfflineBanner() {
  const online = useOnline();
  const { language } = useLanguage();

  if (online) return null;

  const ko = language === "ko";
  return (
    <div
      className="mb-3 px-3 py-2 rounded-[10px_2px_10px_2px] flex items-center gap-2"
      style={{ background: "linear-gradient(90deg, #5e7983, #9b7fda)" }}
      role="status"
    >
      <WifiOff className="w-4 h-4 text-white shrink-0" />
      <span className="text-[12px] text-white">
        {ko ? "오프라인 — 저장된 정보를 보고 있어요" : "You're offline — viewing saved data"}
      </span>
    </div>
  );
}
