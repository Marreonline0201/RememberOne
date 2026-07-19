"use client";

// First-open tour controller. Owns the step machine (pure reducer in
// lib/tour-steps.ts), drives router.push between tour routes, waits for
// anchors, and persists seen/resume state. Mounted once in the (dashboard)
// layout so in-memory step state survives every soft navigation.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/components/ui/use-toast";
import { useLocalNumber } from "@/lib/use-dismiss-flag";
import {
  ANCHOR_POLL_MS,
  ANCHOR_TIMEOUT_MS,
  TOUR_RESUME_KEY,
  TOUR_SEEN_KEY,
  TOUR_STEPS,
  TOUR_VERSION,
  IDLE_STATE,
  parseResume,
  tourReducer,
} from "@/lib/tour-steps";
import { TourOverlay } from "@/components/tour/TourOverlay";

interface TourContextType {
  active: boolean;
  /** Replay from Settings: resets to the welcome card (does NOT touch seen). */
  startTour: () => void;
}

const TourContext = createContext<TourContextType>({
  active: false,
  startTour: () => {},
});

export function useTour() {
  return useContext(TourContext);
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, pickerOpen } = useLanguage();
  const { toast } = useToast();
  const {
    value: seenVersion,
    setValue: setSeenVersion,
    hydrated,
  } = useLocalNumber(TOUR_SEEN_KEY, 0);

  const [state, dispatch] = useReducer(tourReducer, IDLE_STATE);
  // Selector that actually matched for the current step (null = centered card).
  const [matchedSelector, setMatchedSelector] = useState<string | null>(null);
  // Whether the meetings-banner step is part of this run (latched at start so
  // the progress dots keep a stable count; purely cosmetic).
  const [bannerIncluded, setBannerIncluded] = useState(false);

  // Latch so the auto-launch can only ever fire once per page load.
  const launchedRef = useRef(false);
  // Per-step bookkeeping: the route we were on when the step began (so the
  // in-flight controller navigation isn't mistaken for the user leaving).
  const stepEntryRef = useRef<{
    index: number;
    origin: string;
    pushed: boolean;
  } | null>(null);
  const prevEndedRef = useRef<typeof state.ended>(undefined);

  // ── Resume after a reload (WhiteScreenRecovery / mid-deploy) ──────────────
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(TOUR_RESUME_KEY);
    } catch {
      return;
    }
    const resume = parseResume(raw, Date.now());
    const drop = () => {
      try {
        sessionStorage.removeItem(TOUR_RESUME_KEY);
      } catch {
        /* ignore */
      }
    };
    if (!resume) {
      if (raw) drop();
      return;
    }
    if (window.location.pathname !== TOUR_STEPS[resume.stepIndex].route) {
      drop();
      return;
    }
    launchedRef.current = true;
    dispatch({ type: "START", stepIndex: resume.stepIndex });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-launch: once per device, on home, after the language picker ──────
  useEffect(() => {
    if (launchedRef.current || state.active) return;
    if (!hydrated || seenVersion >= TOUR_VERSION) return;
    if (pathname !== "/" || pickerOpen) return;
    const timer = setTimeout(() => {
      if (launchedRef.current) return;
      launchedRef.current = true;
      // Stamped at launch, not completion: an app kill mid-tour must never
      // re-trap the user in a launch loop (resume covers continuation).
      setSeenVersion(TOUR_VERSION);
      setBannerIncluded(!!document.querySelector('[data-tour="home-banner"]'));
      dispatch({ type: "START" });
    }, 600);
    return () => clearTimeout(timer);
  }, [hydrated, seenVersion, pathname, pickerOpen, state.active, setSeenVersion]);

  // ── Route ownership + anchor waiting for the current step ─────────────────
  useEffect(() => {
    if (!state.active || state.phase !== "waiting") return;
    const step = TOUR_STEPS[state.stepIndex];
    if (!stepEntryRef.current || stepEntryRef.current.index !== state.stepIndex) {
      stepEntryRef.current = { index: state.stepIndex, origin: pathname, pushed: false };
    }
    const entry = stepEntryRef.current;
    if (pathname !== step.route && !entry.pushed) {
      entry.pushed = true;
      router.push(step.route);
    }
    // Optional same-page anchors (the meetings banner) resolve fast — it's
    // either mounted or gated off entirely; don't hold everyone else 4s.
    const timeoutMs = step.fallback === "skip" ? 400 : ANCHOR_TIMEOUT_MS;
    const startedAt = performance.now();
    const tick = (): boolean => {
      if (window.location.pathname === step.route) {
        if (step.anchors.length === 0) {
          setMatchedSelector(null);
          dispatch({ type: "ANCHOR_FOUND" });
          return true;
        }
        for (const sel of step.anchors) {
          const el = document.querySelector(sel);
          if (el) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              setMatchedSelector(sel);
              dispatch({ type: "ANCHOR_FOUND" });
              return true;
            }
          }
        }
      }
      if (performance.now() - startedAt > timeoutMs) {
        setMatchedSelector(null);
        dispatch({ type: "ANCHOR_TIMEOUT" });
        return true;
      }
      return false;
    };
    if (tick()) return;
    const iv = setInterval(() => {
      if (tick()) clearInterval(iv);
    }, ANCHOR_POLL_MS);
    return () => clearInterval(iv);
  }, [state.active, state.phase, state.stepIndex, pathname, router]);

  // ── User navigated away on their own (hardware back / swipe / deep link):
  //    dismiss gracefully, never chase. ────────────────────────────────────
  useEffect(() => {
    if (!state.active) return;
    const step = TOUR_STEPS[state.stepIndex];
    const entry = stepEntryRef.current;
    const allowedOrigin =
      state.phase === "waiting" && entry?.index === state.stepIndex
        ? entry.origin
        : step.route;
    if (pathname !== step.route && pathname !== allowedOrigin) {
      dispatch({ type: "ROUTE_CHANGED", pathname });
    }
  }, [pathname, state.active, state.phase, state.stepIndex]);

  // ── Persist resume position while active ─────────────────────────────────
  useEffect(() => {
    if (!state.active) return;
    try {
      sessionStorage.setItem(TOUR_RESUME_KEY, `${state.stepIndex}:${Date.now()}`);
    } catch {
      /* ignore */
    }
  }, [state.active, state.stepIndex]);

  // ── Run ended: clean up, toast on interruption ───────────────────────────
  useEffect(() => {
    if (state.ended && state.ended !== prevEndedRef.current) {
      stepEntryRef.current = null;
      try {
        sessionStorage.removeItem(TOUR_RESUME_KEY);
      } catch {
        /* ignore */
      }
      if (seenVersion < TOUR_VERSION) setSeenVersion(TOUR_VERSION);
      if (state.ended === "dismissed") {
        toast({ description: t("tour.dismissed_toast") });
      }
    }
    prevEndedRef.current = state.ended;
  }, [state.ended, seenVersion, setSeenVersion, toast, t]);

  const startTour = useCallback(() => {
    launchedRef.current = true;
    setBannerIncluded(
      typeof document !== "undefined" &&
        !!document.querySelector('[data-tour="home-banner"]')
    );
    dispatch({ type: "START" });
  }, []);

  const skip = useCallback(() => dispatch({ type: "SKIP" }), []);
  const next = useCallback(() => dispatch({ type: "NEXT" }), []);

  const step = TOUR_STEPS[state.stepIndex];
  // Progress dots cover the coach-mark steps (not the hero cards); the
  // meetings step counts only when its banner was present at start.
  const dotSteps = TOUR_STEPS.slice(1, TOUR_STEPS.length - 1).filter(
    (s) => s.fallback !== "skip" || bannerIncluded
  );
  const rawDotIndex = dotSteps.findIndex((s) => s.id === step.id);
  const dotIndex =
    step.anchors.length === 0
      ? -1
      : Math.min(Math.max(rawDotIndex, 0), dotSteps.length - 1);

  return (
    <TourContext.Provider value={{ active: state.active, startTour }}>
      {children}
      {state.active && (
        <TourOverlay
          step={step}
          phase={state.phase}
          anchorSelector={state.phase === "showing" ? matchedSelector : null}
          dotIndex={dotIndex}
          dotCount={dotSteps.length}
          onNext={next}
          onSkip={skip}
        />
      )}
    </TourContext.Provider>
  );
}
