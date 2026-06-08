"use client";

// PersonCard — phone-first card matching the Figma design.
// Tap anywhere on the card → /people/[id] (full edit page).
// Mic button at bottom-left → /meet?person=Name (quick log meeting).

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { capitalize, localizeKey, localizeRelation, formatRelativeDate, asOfLabel } from "@/lib/utils";
import type { PersonFull } from "@/types/app";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguage } from "@/lib/i18n";
import { RecapLine } from "@/components/RecapLine";
import { PersonCardActions } from "@/components/PersonCardActions";

// Press-and-hold this long (ms) on a card to open the Share/Edit/Delete menu.
const LONG_PRESS_MS = 600;
// If the pointer moves more than this (px) during a hold, treat it as a scroll
// and cancel the long-press so the list still scrolls normally.
const MOVE_CANCEL_PX = 10;

const INTEREST_KEYS = ["interest", "hobby", "hobbies", "sport", "sports", "passion", "likes"];

function isInterest(key: string) {
  const k = key.toLowerCase();
  return INTEREST_KEYS.some((ik) => k.includes(ik));
}

interface Props {
  person: PersonFull;
}

export function PersonCard({ person }: Props) {
  const { language, t } = useLanguage();
  const locale = getLanguage(language).locale;
  const lastMeeting = person.meetings[0] ?? null;
  const mainInfo = person.attributes.filter((a) => !isInterest(a.key));
  const interests = person.attributes.filter((a) => isInterest(a.key));

  const [menuOpen, setMenuOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  // Set true the instant a long-press fires so the click that follows the
  // finger-lift is swallowed instead of navigating to the profile page.
  const suppressClickRef = useRef(false);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return; // primary button / touch only
    // Clear any stale suppress flag left over from a previous long-press whose
    // trailing click landed on the menu backdrop (so handleClick never ran to
    // reset it). Without this, the first normal tap after using the menu would
    // be swallowed. Reset at the start of every fresh press.
    suppressClickRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      suppressClickRef.current = true;
      setMenuOpen(true);
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!startRef.current || !timerRef.current) return;
    const dx = Math.abs(e.clientX - startRef.current.x);
    const dy = Math.abs(e.clientY - startRef.current.y);
    if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) clearTimer();
  }

  function endPress() {
    clearTimer();
    startRef.current = null;
  }

  function handleClick(e: React.MouseEvent) {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    }
  }

  // Cancel a pending long-press timer if the card unmounts mid-press (e.g. the
  // list re-renders after a delete) so the timeout can't fire on a dead card.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="relative">
      {/* Card body — quick tap navigates to profile / edit; press-and-hold
          (LONG_PRESS_MS) opens the Share/Edit/Delete menu. */}
      <Link
        href={`/people/${person.id}`}
        // Full prefetch (not just the loading shell) so the person's data-less
        // route RSC is cached and opens offline; the data comes from IndexedDB.
        prefetch
        className="block p-4 pb-16 transition-opacity active:opacity-90 select-none no-native-drag"
        // On touch, pressing-and-holding a link triggers the browser's native
        // link-drag ("drags the URL out") which also cancels our long-press
        // timer so the menu never opens. draggable=false + onDragStart kill it;
        // the no-native-drag class adds -webkit-user-drag:none as a backstop.
        draggable={false}
        style={{
          borderRadius: "10px 2px 10px 2px",
          background: "linear-gradient(52deg, #d0f2ff 0%, #dccaff 100%)",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          WebkitTapHighlightColor: "transparent",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPress}
        onPointerCancel={endPress}
        onPointerLeave={endPress}
        onClick={handleClick}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        {/* Header: person name + "last met" */}
        <div className="flex items-start justify-between gap-3">
          <h2
            className="text-[26px] leading-tight text-black"
            style={{ fontFamily: "'Hammersmith One', sans-serif" }}
          >
            {person.name}
          </h2>
          {lastMeeting && (
            <p className="text-[10px] shrink-0 mt-2" style={{ color: "#5e7983" }}>
              {t("person.last_met")} {formatRelativeDate(lastMeeting.meeting_date, locale)}
            </p>
          )}
        </div>

        {/* Main info chips (age, job, school, company, etc.) */}
        {mainInfo.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {mainInfo.map((attr) => {
              const qualifier = asOfLabel(attr.key, attr.updated_at, language);
              return (
                <span
                  key={attr.id}
                  className="text-[10px] px-2 py-[3px] rounded-[5px] shadow-sm text-black"
                  style={{ backgroundColor: "#dccaff" }}
                >
                  {localizeKey(attr.key, language)}: {attr.value}
                  {qualifier && <span className="opacity-60 ml-1">· {qualifier}</span>}
                </span>
              );
            })}
          </div>
        )}

        {/* Family */}
        {person.family_members.length > 0 && (
          <div className="mt-4">
            <p
              className="text-[10px] uppercase tracking-wider mb-2"
              style={{ color: "#665b7b", fontFamily: "'Hammersmith One', sans-serif" }}
            >
              {t("person.family")}
            </p>
            <div className="space-y-2">
              {person.family_members.map((fm) => (
                <div key={fm.id} className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="text-[11px] text-black uppercase"
                    style={{ fontFamily: "'Hammersmith One', sans-serif" }}
                  >
                    {fm.name}
                  </span>
                  <span
                    className="text-[9px] px-1.5 py-[2px] rounded-[5px] shadow-sm text-black"
                    style={{ backgroundColor: "#dccaff" }}
                  >
                    {localizeRelation(fm.relation, language)}
                  </span>
                  {fm.attributes.map((a) => {
                    const qualifier = asOfLabel(a.key, a.updated_at, language);
                    return (
                      <span
                        key={a.id}
                        className="text-[9px] px-1.5 py-[2px] rounded-[5px] shadow-sm text-black"
                        style={{ backgroundColor: "#dccaff" }}
                      >
                        {localizeKey(a.key, language)}: {a.value}
                        {qualifier && <span className="opacity-60 ml-1">· {qualifier}</span>}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interests */}
        {interests.length > 0 && (
          <div className="mt-4">
            <p
              className="text-[10px] uppercase tracking-wider mb-2"
              style={{ color: "#665b7b", fontFamily: "'Hammersmith One', sans-serif" }}
            >
              {t("person.interest")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {interests.map((a) => (
                <span
                  key={a.id}
                  className="text-[10px] px-2 py-[3px] rounded-[5px] shadow-sm text-black"
                  style={{ backgroundColor: "#dccaff" }}
                >
                  {a.value}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recap — most recent meeting summary (events/narrative that don't
            fit as structured attributes). Shown at the bottom of the card.
            RecapLine auto-translates to the current app language and caches
            the result in localStorage. */}
        {lastMeeting?.summary && (
          <RecapLine
            summary={lastMeeting.summary}
            className="mt-4 text-[11px] leading-snug italic pr-8"
            style={{ color: "#5e7983" }}
          />
        )}
      </Link>

      {/* Mic — quick "log meeting with this person" */}
      <Link
        href={`/meet?personId=${person.id}`}
        className="absolute bottom-4 left-4 flex items-center justify-center w-8 h-8 rounded-full transition-opacity active:opacity-70"
        style={{ border: "1.5px solid #2fe0ff" }}
        aria-label={`Log meeting with ${person.name}`}
      >
        <Mic className="w-3.5 h-3.5" style={{ color: "#284e72" }} />
      </Link>

      {/* Long-press menu (Share / Edit / Delete) + delete confirmation. */}
      <PersonCardActions person={person} open={menuOpen} onOpenChange={setMenuOpen} />
    </div>
  );
}
