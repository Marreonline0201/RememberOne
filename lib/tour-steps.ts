// First-open tour: step registry + a pure reducer for the step machine.
// No React or DOM in this module so the transition logic is unit-testable
// (node --test) — TourProvider owns the effects (router.push, anchor polling).

export const TOUR_VERSION = 1;
// localStorage: highest TOUR_VERSION the user has seen (0 = never). Written at
// auto-launch, not completion — an app kill mid-tour must never re-trap the
// user in a launch loop. Device-local on purpose, like every ro.* flag.
export const TOUR_SEEN_KEY = "ro.tour.seenVersion";
// sessionStorage: "<stepIndex>:<epochMs>" so an SW-triggered reload
// (WhiteScreenRecovery) resumes mid-tour instead of silently dropping it.
export const TOUR_RESUME_KEY = "ro.tour.step";
export const TOUR_RESUME_TTL_MS = 2 * 60 * 1000;
export const ANCHOR_TIMEOUT_MS = 4000;
export const ANCHOR_POLL_MS = 150;

export type TourRoute = "/" | "/meet" | "/calendar" | "/account";

export interface TourStep {
  id: string;
  route: TourRoute;
  /** Ordered candidate selectors; first match wins. Empty = centered card. */
  anchors: string[];
  /** What to do when no candidate appears within the timeout. */
  fallback: "center" | "skip";
  /**
   * While this selector exists in the DOM the anchor may still be coming
   * (e.g. a component that renders a marker during its fetch) — the wait
   * uses the full timeout instead of the fast-skip window.
   */
  pendingAnchor?: string;
  placement: "below" | "above" | "center" | "auto";
  titleKey: string;
  bodyKey: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    route: "/",
    anchors: [],
    fallback: "center",
    placement: "center",
    titleKey: "tour.welcome_title",
    bodyKey: "tour.welcome_body",
  },
  {
    id: "people",
    route: "/",
    anchors: ['[data-tour="home-tools"]', '[data-tour="home-empty"]'],
    fallback: "center",
    placement: "below",
    titleKey: "tour.step_people_title",
    bodyKey: "tour.step_people_body",
  },
  {
    id: "meetings",
    route: "/",
    // Banner only exists with a calendar connection + matched meetings; for
    // everyone else this step disappears silently (fallback: "skip"). The
    // pending marker keeps the wait alive while the banner's fetch runs.
    anchors: ['[data-tour="home-banner"]'],
    fallback: "skip",
    pendingAnchor: '[data-tour="home-banner-pending"]',
    placement: "below",
    titleKey: "tour.step_banner_title",
    bodyKey: "tour.step_banner_body",
  },
  {
    id: "record",
    route: "/meet",
    anchors: ['[data-tour="meet-record"]'],
    fallback: "center",
    placement: "below",
    titleKey: "tour.step_record_title",
    bodyKey: "tour.step_record_body",
  },
  {
    id: "calendar",
    route: "/calendar",
    anchors: ['[data-tour="calendar-grid"]'],
    fallback: "center",
    placement: "below",
    titleKey: "tour.step_calendar_title",
    bodyKey: "tour.step_calendar_body",
  },
  {
    id: "settings",
    route: "/account",
    anchors: ['[data-tour="account-help"]'],
    fallback: "center",
    placement: "auto",
    titleKey: "tour.step_settings_title",
    bodyKey: "tour.step_settings_body",
  },
  {
    id: "done",
    route: "/account",
    anchors: [],
    fallback: "center",
    placement: "center",
    titleKey: "tour.done_title",
    bodyKey: "tour.done_body",
  },
];

// ── Step machine ────────────────────────────────────────────────────────────

export type TourPhase = "waiting" | "showing";

export interface TourState {
  active: boolean;
  stepIndex: number;
  phase: TourPhase;
  /** Set when the run ends; "dismissed" = interrupted (back nav), toast shown. */
  ended?: "done" | "skipped" | "dismissed";
}

export const IDLE_STATE: TourState = { active: false, stepIndex: 0, phase: "waiting" };

export type TourAction =
  | { type: "START"; stepIndex?: number }
  | { type: "ANCHOR_FOUND" }
  | { type: "ANCHOR_TIMEOUT" }
  | { type: "NEXT" }
  | { type: "SKIP" }
  | { type: "ROUTE_CHANGED"; pathname: string }
  | { type: "FINISH" };

function advance(state: TourState): TourState {
  const next = state.stepIndex + 1;
  if (next >= TOUR_STEPS.length) {
    return { ...IDLE_STATE, ended: "done" };
  }
  return { active: true, stepIndex: next, phase: "waiting" };
}

export function tourReducer(state: TourState, action: TourAction): TourState {
  switch (action.type) {
    case "START": {
      const i = action.stepIndex ?? 0;
      if (i < 0 || i >= TOUR_STEPS.length) return { ...IDLE_STATE };
      return { active: true, stepIndex: i, phase: "waiting" };
    }
    case "ANCHOR_FOUND":
      if (!state.active) return state;
      return { ...state, phase: "showing" };
    case "ANCHOR_TIMEOUT": {
      if (!state.active) return state;
      const step = TOUR_STEPS[state.stepIndex];
      // Optional anchors vanish silently; required ones still deliver their
      // copy as a centered card (the overlay reads phase "showing" with no
      // anchor rect as "centered").
      if (step.fallback === "skip") return advance(state);
      return { ...state, phase: "showing" };
    }
    case "NEXT":
      if (!state.active) return state;
      return advance(state);
    case "SKIP":
      if (!state.active) return state;
      return { ...IDLE_STATE, ended: "skipped" };
    case "ROUTE_CHANGED": {
      // The user navigated on their own (hardware back, swipe, deep link).
      // Never chase — dismiss gracefully; the Settings row is the way back in.
      if (!state.active) return state;
      if (TOUR_STEPS[state.stepIndex].route === action.pathname) return state;
      return { ...IDLE_STATE, ended: "dismissed" };
    }
    case "FINISH":
      if (!state.active) return state;
      return { ...IDLE_STATE, ended: "done" };
    default:
      return state;
  }
}

/** Parse the sessionStorage resume payload; null when absent/stale/corrupt. */
export function parseResume(
  raw: string | null,
  nowMs: number
): { stepIndex: number } | null {
  if (!raw) return null;
  const sep = raw.indexOf(":");
  if (sep <= 0) return null;
  const idx = Number(raw.slice(0, sep));
  const ts = Number(raw.slice(sep + 1));
  if (!Number.isInteger(idx) || idx < 0 || idx >= TOUR_STEPS.length) return null;
  if (!Number.isFinite(ts) || nowMs - ts > TOUR_RESUME_TTL_MS) return null;
  return { stepIndex: idx };
}
