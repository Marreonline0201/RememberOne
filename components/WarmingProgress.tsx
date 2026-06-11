"use client";

// Offline-readiness indicator at the top of the home screen. Shows on every app
// open — COLD start (fresh JS context) AND WARM start (the app returns to the
// foreground from the background) — so the user knows whether the app is ready to
// work offline:
//   - still caching  -> "Preparing offline…" progress bar
//   - cached / done  -> "✓ Available offline" for ~1s, then it closes
//
// It does NOT re-trigger on in-app navigation (home -> person -> home): only a
// real cold start or a visibilitychange back to "visible" re-arms it.

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  subscribeWarmProgress,
  revalidateWarm,
  type WarmProgress,
} from "@/lib/offline-warm";
import { useOnline } from "@/lib/use-online";
import { useLanguage } from "@/contexts/LanguageContext";

// Reset on cold start (new JS context). Gates the mount-based show to once, so
// in-app remounts don't re-trigger it; warm-start shows come from visibilitychange.
let coldStartShown = false;

const READY_MS = 1000; // how long the "✓ Available offline" check stays up
const SAFETY_MS = 8000; // dismiss if warming stalls so the bar never sticks

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
  const [phase, setPhase] = useState<Phase>(() =>
    coldStartShown ? "hidden" : "preparing",
  );

  const complete = progress.total > 0 && progress.done >= progress.total;

  // Let the mount-time visibility listener read current readiness without re-binding.
  const completeRef = useRef(complete);
  const onlineRef = useRef(online);
  completeRef.current = complete;
  onlineRef.current = online;

  useEffect(() => subscribeWarmProgress(setProgress), []);

  // Cold start already armed via the lazy initializer above. Here we (1) mark the
  // cold-start show consumed so in-app remounts stay quiet, and (2) re-arm on every
  // warm start — when the app comes back to the foreground, re-validate the cache
  // (no-op if fully warm) and show the indicator again, jumping straight to the
  // check if it's already ready.
  useEffect(() => {
    coldStartShown = true;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      revalidateWarm();
      setPhase(completeRef.current || !onlineRef.current ? "ready" : "preparing");
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // preparing -> ready: warming finished, or opened offline (already cache-backed).
  useEffect(() => {
    if (phase !== "preparing") return;
    if (complete || !online) setPhase("ready");
  }, [phase, complete, online]);

  // Safety net: if warming stalls / partly fails, dismiss SILENTLY after a cap —
  // never force the "✓ Available offline" check, since offline may not actually be
  // ready yet. Honest progress that quietly disappears beats a green check that lies.
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
