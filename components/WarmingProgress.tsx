"use client";

// One-shot offline-readiness indicator shown at the top of the home screen on
// each app launch, so the user can see whether the app is ready to work offline:
//   - still caching  -> "Preparing offline…" progress bar
//   - cached / done  -> "✓ Available offline" for ~1s, then it closes
//
// Shown once per launch (module flag, reset on cold start = fresh JS context); a
// tap into a card or a return to home mid-session does not re-trigger it. Driven
// by subscribeWarmProgress() from lib/offline-warm.

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { subscribeWarmProgress, type WarmProgress } from "@/lib/offline-warm";
import { useOnline } from "@/lib/use-online";
import { useLanguage } from "@/contexts/LanguageContext";

// Reset on cold start (new JS context) — so the indicator runs once per launch.
let shownThisSession = false;

const READY_MS = 1000; // how long the "✓ Available offline" state stays up
const SAFETY_MS = 8000; // force-resolve if warming stalls so the bar never sticks

type Phase = "preparing" | "ready" | "hidden";

export function WarmingProgress() {
  const { language } = useLanguage();
  const ko = language === "ko";
  const online = useOnline();

  const [progress, setProgress] = useState<WarmProgress>({
    done: 0,
    total: 0,
    active: false,
  });
  // Only the first home mount per launch runs the indicator; later mounts stay hidden.
  const [phase, setPhase] = useState<Phase>(() =>
    shownThisSession ? "hidden" : "preparing",
  );

  // Claim the one-shot slot for this launch.
  useEffect(() => {
    if (phase === "preparing") shownThisSession = true;
  }, [phase]);

  useEffect(() => subscribeWarmProgress(setProgress), []);

  const complete = progress.total > 0 && progress.done >= progress.total;

  // preparing -> ready: warming finished, OR opened offline (already cache-backed,
  // so offline is proven possible).
  useEffect(() => {
    if (phase !== "preparing") return;
    if (complete || !online) setPhase("ready");
  }, [phase, complete, online]);

  // Safety net: if warming stalls / partly fails, dismiss SILENTLY after a cap —
  // never force the "✓ Available offline" check, since offline may not actually be
  // ready yet (e.g. a first login with many contacts on a slow link). Honest
  // progress that quietly disappears beats a green check that lies.
  useEffect(() => {
    if (phase !== "preparing") return;
    const t = setTimeout(() => setPhase("hidden"), SAFETY_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // ready -> hidden after a beat.
  useEffect(() => {
    if (phase !== "ready") return;
    const t = setTimeout(() => setPhase("hidden"), READY_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "hidden") return null;

  const ready = phase === "ready";
  const pct = ready
    ? 100
    : progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 8; // a sliver until we know the total

  return (
    <div className="mb-3" role="status" aria-live="polite">
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-[11px] uppercase tracking-wide flex items-center gap-1"
          style={{
            color: ready ? "#2f8f63" : "#5e7983",
            fontFamily: "'Hammersmith One', sans-serif",
          }}
        >
          {ready && <CheckCircle2 className="w-3 h-3" />}
          {ready
            ? ko
              ? "오프라인 사용 가능"
              : "Available offline"
            : ko
              ? "오프라인용으로 준비 중"
              : "Preparing offline"}
        </span>
        {!ready && progress.total > 0 && (
          <span className="text-[11px]" style={{ color: "#7a6b95" }}>
            {progress.done}/{progress.total}
          </span>
        )}
      </div>
      <div
        className="h-1.5 w-full rounded-full overflow-hidden"
        style={{ backgroundColor: "rgba(220,202,255,0.4)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{
            width: `${pct}%`,
            background: ready
              ? "linear-gradient(to right, #2f8f63, #3f7a5e)"
              : "linear-gradient(to right, #284e72, #482d7c)",
          }}
        />
      </div>
    </div>
  );
}
