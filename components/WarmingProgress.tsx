"use client";

// Slim, non-blocking progress bar shown at the top of the home screen while the
// offline cache warms (every page + person being fetched for offline use). The
// home + cards stay fully usable underneath; a tapped card still opens instantly.
//
// Anti-flash: on a warm-cache cold start (2nd+ launch) the warm fetches resolve
// from the SW cache almost instantly, so we only reveal the bar if warming is
// STILL in progress after a short grace window — otherwise it would flicker on
// every app open.

import { useEffect, useState } from "react";
import { subscribeWarmProgress, type WarmProgress } from "@/lib/offline-warm";
import { useLanguage } from "@/contexts/LanguageContext";

const GRACE_MS = 500;

export function WarmingProgress() {
  const { language } = useLanguage();
  const ko = language === "ko";

  const [progress, setProgress] = useState<WarmProgress>({
    done: 0,
    total: 0,
    active: false,
  });
  const [revealed, setRevealed] = useState(false);

  useEffect(() => subscribeWarmProgress(setProgress), []);

  const inProgress =
    progress.active && progress.total > 0 && progress.done < progress.total;

  useEffect(() => {
    if (!inProgress) {
      setRevealed(false);
      return;
    }
    // Reveal only if still warming after the grace window.
    const t = setTimeout(() => setRevealed(true), GRACE_MS);
    return () => clearTimeout(t);
  }, [inProgress]);

  if (!revealed) return null;

  const pct = Math.round((progress.done / progress.total) * 100);

  return (
    <div className="mb-3" role="status" aria-live="polite">
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-[11px] uppercase tracking-wide"
          style={{ color: "#5e7983", fontFamily: "'Hammersmith One', sans-serif" }}
        >
          {ko ? "오프라인용으로 저장 중" : "Saving for offline"}
        </span>
        <span className="text-[11px]" style={{ color: "#7a6b95" }}>
          {progress.done}/{progress.total}
        </span>
      </div>
      <div
        className="h-1.5 w-full rounded-full overflow-hidden"
        style={{ backgroundColor: "rgba(220,202,255,0.4)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(to right, #284e72, #482d7c)",
          }}
        />
      </div>
    </div>
  );
}
