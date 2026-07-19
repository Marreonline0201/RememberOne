"use client";

// Visual layer of the first-open tour: dim backdrop, spotlight cutout that
// glides between anchors, and the branded tooltip / hero cards. Sits at
// z-[70] — above the nav (z-40), route loading overlay (z-50) and the AI
// consent modal (z-[60]), below toasts (z-[100]). The root swallows every
// tap (including inside the cutout) so real UI can't be triggered mid-tour;
// page scrolling still works and the spotlight re-tracks it.

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TourPhase, TourStep } from "@/lib/tour-steps";

const SPOT_PAD = 8;
const CARD_GAP = 14;
const CARD_EST_H = 220; // rough card height used only for placement flipping
// Fallback when the fixed mobile header isn't in the DOM; the live value is
// measured from the header itself so notch safe-area insets are included.
const HEADER_SAFE_FALLBACK = 92;

interface TourOverlayProps {
  step: TourStep;
  phase: TourPhase;
  /** Matched anchor selector; null = centered card (heroes and fallbacks). */
  anchorSelector: string | null;
  dotIndex: number; // -1 on hero cards
  dotCount: number;
  onNext: () => void;
  onSkip: () => void;
}

function useReducedMotion() {
  return useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );
}

// Live viewport rect of the anchor: scrolls it into view once, then follows
// window scroll/resize and element resizes, rAF-throttled. React re-renders
// can REPLACE the anchor's DOM node, so every measure re-queries when the
// bound node has left the document (a detached node reports a 0x0 rect,
// which would collapse the spotlight to a sliver).
function useAnchorRect(selector: string | null, reducedMotion: boolean) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    let el = document.querySelector(selector);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({
      block: "center",
      behavior: reducedMotion ? "auto" : "smooth",
    });
    let raf = 0;
    const ro = new ResizeObserver(() => schedule());
    const measure = () => {
      raf = 0;
      if (!el || !el.isConnected) {
        const next = document.querySelector(selector);
        if (next) {
          el = next;
          ro.disconnect();
          ro.observe(next);
        } else {
          setRect(null); // anchor gone for good → centered card
          return;
        }
      }
      setRect(el.getBoundingClientRect());
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    ro.observe(el);
    return () => {
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [selector, reducedMotion]);

  return rect;
}

export function TourOverlay({
  step,
  phase,
  anchorSelector,
  dotIndex,
  dotCount,
  onNext,
  onSkip,
}: TourOverlayProps) {
  const { t } = useLanguage();
  const reducedMotion = useReducedMotion();
  const rect = useAnchorRect(anchorSelector, reducedMotion);
  const cardRef = useRef<HTMLDivElement>(null);

  const isHero = step.id === "welcome" || step.id === "done";

  // Focus the card whenever the step (or its readiness) changes.
  useEffect(() => {
    if (phase === "showing") cardRef.current?.focus();
  }, [step.id, phase]);

  // Escape skips; Tab cycles inside the card (manual trap — no Radix here).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
      } else if (e.key === "Tab") {
        const root = cardRef.current;
        if (!root) return;
        const list = Array.from(root.querySelectorAll<HTMLElement>("button"));
        if (!list.length) return;
        e.preventDefault();
        const idx = list.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey
          ? idx <= 0
            ? list.length - 1
            : idx - 1
          : idx === -1 || idx === list.length - 1
            ? 0
            : idx + 1;
        list[next].focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  // ── Transition scrim: between routes / while waiting for an anchor ────────
  if (phase === "waiting") {
    return (
      <div
        className="fixed inset-0 z-[70]"
        style={{ backgroundColor: "rgba(20,12,40,0.2)" }}
        aria-hidden="true"
      />
    );
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Real bottom edge of the fixed mobile header (includes safe-top inset on
  // notched phones); 0-height when hidden on desktop.
  const headerRect = document
    .querySelector("header.safe-top")
    ?.getBoundingClientRect();
  const headerSafe = headerRect?.height
    ? headerRect.bottom + 8
    : HEADER_SAFE_FALLBACK;

  // Spotlight box (clamped so tall anchors don't swallow the screen).
  let box: { top: number; left: number; width: number; height: number } | null =
    null;
  if (rect && !isHero) {
    let top = rect.top - SPOT_PAD;
    let height = rect.height + SPOT_PAD * 2;
    const maxH = vh * 0.6;
    if (height > maxH) height = maxH;
    if (top < 8) {
      height = Math.max(48, height - (8 - top));
      top = 8;
    }
    if (top + height > vh - 8) height = vh - 8 - top;
    box = {
      top,
      left: Math.max(4, rect.left - SPOT_PAD),
      width: Math.min(rect.width + SPOT_PAD * 2, vw - 8),
      height,
    };
  }

  // Card geometry. Fixed width lets us clamp + place the caret without
  // measuring the card.
  const cardW = Math.min(320, vw - 32);
  let cardStyle: React.CSSProperties;
  let caretStyle: React.CSSProperties | null = null;
  if (box) {
    const centerX = box.left + box.width / 2;
    const left = Math.min(Math.max(centerX - cardW / 2, 16), vw - 16 - cardW);
    let below = step.placement !== "above";
    if (step.placement === "auto") below = box.top + box.height / 2 < vh / 2;
    if (below && box.top + box.height + CARD_GAP + CARD_EST_H > vh - 16) {
      below = false;
    }
    if (!below && box.top - CARD_GAP - CARD_EST_H < headerSafe) {
      below = true;
    }
    cardStyle = below
      ? { top: box.top + box.height + CARD_GAP, left, width: cardW }
      : { bottom: vh - box.top + CARD_GAP, left, width: cardW };
    const caretLeft = Math.min(Math.max(centerX - left - 6, 14), cardW - 26);
    caretStyle = below
      ? { top: -6, left: caretLeft }
      : { bottom: -6, left: caretLeft };
  } else {
    cardStyle = { width: cardW }; // centered via the flex wrapper below
  }

  const title = t(step.titleKey);
  const body = t(step.bodyKey);
  const progress =
    dotIndex >= 0
      ? t("tour.progress")
          .replace("{n}", String(dotIndex + 1))
          .replace("{m}", String(dotCount))
      : undefined;

  const heroCta = step.id === "welcome" ? t("tour.welcome_cta") : t("tour.done_cta");

  return (
    <div
      className="fixed inset-0 z-[70]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-step-title"
    >
      {/* Backdrop: hero cards get a plain dim; coach marks get the cutout
          (the spotlight's giant box-shadow doubles as the backdrop). */}
      {(isHero || !box) && (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(20,12,40,0.55)" }}
          aria-hidden="true"
        />
      )}
      {box && !isHero && (
        <div
          aria-hidden="true"
          className="absolute"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            borderRadius: "12px 4px 12px 4px",
            // Inner cyan + outer purple ring, then the dimmed backdrop —
            // three shadows, no mask hacks (old-WebView safe).
            boxShadow:
              "0 0 0 2px #00d4f7, 0 0 0 4px #482d7c, 0 0 0 9999px rgba(20,12,40,0.55)",
            transition: reducedMotion
              ? "none"
              : "top .3s cubic-bezier(.22,1,.36,1), left .3s cubic-bezier(.22,1,.36,1), width .3s cubic-bezier(.22,1,.36,1), height .3s cubic-bezier(.22,1,.36,1)",
          }}
        />
      )}

      {isHero || !box ? (
        /* ── Centered hero / fallback card ─────────────────────────────── */
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div
            ref={cardRef}
            tabIndex={-1}
            className={
              reducedMotion
                ? "relative bg-white p-5 shadow-xl outline-none"
                : "relative bg-white p-5 shadow-xl outline-none animate-in fade-in zoom-in-95 duration-200"
            }
            style={{ ...cardStyle, borderRadius: "10px 2px 10px 2px" }}
          >
            {isHero && (
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{
                  background: "linear-gradient(135deg, #00d4f7, #c84b8a, #482d7c)",
                }}
                aria-hidden="true"
              >
                {step.id === "done" ? (
                  <span className="text-2xl">🎉</span>
                ) : (
                  <Sparkles className="w-6 h-6 text-white" />
                )}
              </div>
            )}
            <h2
              id="tour-step-title"
              className="text-[17px] uppercase"
              style={{
                fontFamily: "'Hammersmith One', sans-serif",
                color: "#284e72",
              }}
            >
              {title}
            </h2>
            <p
              className="text-[13px] leading-relaxed mt-2"
              style={{ color: "#5e7983" }}
              aria-live="polite"
            >
              {body}
            </p>
            {isHero ? (
              <div className="flex flex-col gap-2 mt-4">
                <button
                  type="button"
                  onClick={onNext}
                  className="w-full h-12 rounded-[10px_2px_10px_2px] text-white transition-opacity active:opacity-80"
                  style={{
                    background: "linear-gradient(to right, #284e72, #482d7c)",
                    fontFamily: "'Hammersmith One', sans-serif",
                  }}
                >
                  {heroCta}
                </button>
                {step.id === "welcome" && (
                  <button
                    type="button"
                    onClick={onSkip}
                    className="w-full h-10 text-[13px] transition-opacity active:opacity-70"
                    style={{ color: "#5e7983" }}
                  >
                    {t("tour.skip")}
                  </button>
                )}
              </div>
            ) : (
              <CardFooter
                dotIndex={dotIndex}
                dotCount={dotCount}
                progress={progress}
                onNext={onNext}
                onSkip={onSkip}
                nextLabel={t("tour.next")}
                skipLabel={t("tour.skip")}
              />
            )}
          </div>
        </div>
      ) : (
        /* ── Anchored coach-mark card ───────────────────────────────────── */
        <div
          ref={cardRef}
          tabIndex={-1}
          className={
            reducedMotion
              ? "absolute bg-white p-4 shadow-xl outline-none"
              : "absolute bg-white p-4 shadow-xl outline-none animate-in fade-in zoom-in-95 duration-200"
          }
          style={{
            ...cardStyle,
            borderRadius: "10px 2px 10px 2px",
            border: "1px solid #dccaff",
          }}
        >
          {caretStyle && (
            <div
              aria-hidden="true"
              className="absolute w-3 h-3 bg-white rotate-45"
              style={{
                ...caretStyle,
                borderLeft: "1px solid #dccaff",
                borderTop: "1px solid #dccaff",
              }}
            />
          )}
          <h2
            id="tour-step-title"
            className="text-[15px] uppercase"
            style={{
              fontFamily: "'Hammersmith One', sans-serif",
              color: "#284e72",
            }}
          >
            {title}
          </h2>
          <p
            className="text-[13px] leading-relaxed mt-1.5"
            style={{ color: "#5e7983" }}
            aria-live="polite"
          >
            {body}
          </p>
          <CardFooter
            dotIndex={dotIndex}
            dotCount={dotCount}
            progress={progress}
            onNext={onNext}
            onSkip={onSkip}
            nextLabel={t("tour.next")}
            skipLabel={t("tour.skip")}
          />
        </div>
      )}
    </div>
  );
}

function CardFooter({
  dotIndex,
  dotCount,
  progress,
  onNext,
  onSkip,
  nextLabel,
  skipLabel,
}: {
  dotIndex: number;
  dotCount: number;
  progress?: string;
  onNext: () => void;
  onSkip: () => void;
  nextLabel: string;
  skipLabel: string;
}) {
  return (
    <div className="flex items-center justify-between mt-4 gap-3">
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: dotCount }, (_, i) => (
          <span
            key={i}
            className="rounded-full transition-all"
            style={
              i === dotIndex
                ? {
                    width: 16,
                    height: 6,
                    background: "linear-gradient(to right, #284e72, #482d7c)",
                  }
                : { width: 6, height: 6, backgroundColor: "#dccaff" }
            }
          />
        ))}
      </div>
      {progress && <span className="sr-only">{progress}</span>}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onSkip}
          className="h-11 px-3 text-[13px] transition-opacity active:opacity-70"
          style={{ color: "#5e7983" }}
        >
          {skipLabel}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="h-11 px-5 rounded-[8px_2px_8px_2px] text-white text-[14px] transition-opacity active:opacity-80"
          style={{
            background: "linear-gradient(to right, #284e72, #482d7c)",
            fontFamily: "'Hammersmith One', sans-serif",
          }}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
