"use client";

// Drives the offline write queue: flushes the outbox to the real API when the
// device comes back online (and once on mount in case we launched with a
// backlog), and shows a small "N changes will sync" indicator while writes are
// pending.

import { useEffect, useState } from "react";
import { flushOutbox } from "@/lib/offline-queue";
import { outboxCount, subscribeOffline } from "@/lib/offline-cache";
import { useLanguage } from "@/contexts/LanguageContext";

export function OfflineSyncProvider() {
  const { language } = useLanguage();
  const ko = language === "ko";
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const n = await outboxCount();
      if (active) setPending(n);
    };
    void refresh();

    const unsub = subscribeOffline(refresh);
    const onOnline = () => {
      void flushOutbox().then(refresh);
    };
    window.addEventListener("online", onOnline);

    // Launched online with a backlog? Flush now.
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void flushOutbox().then(refresh);
    }

    return () => {
      active = false;
      unsub();
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (pending <= 0) return null;

  return (
    <div
      className="mb-3 px-3 py-2 rounded-[10px_2px_10px_2px] flex items-center gap-2"
      style={{ background: "rgba(220,202,255,0.45)", border: "1px solid #dccaff" }}
      role="status"
    >
      <span className="text-[12px]" style={{ color: "#5e7983" }}>
        {ko
          ? `${pending}개의 변경사항이 연결되면 동기화돼요`
          : `${pending} change${pending === 1 ? "" : "s"} will sync when you're back online`}
      </span>
    </div>
  );
}
