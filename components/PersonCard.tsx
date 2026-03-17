"use client";

// PersonCard — phone-first card matching the Figma design.
// Tap anywhere on the card → /people/[id] (full edit page).
// Mic button at bottom-left → /meet?person=Name (quick log meeting).

import Link from "next/link";
import { Mic } from "lucide-react";
import { capitalize, localizeKey, localizeRelation, formatRelativeDate, asOfLabel } from "@/lib/utils";
import type { PersonFull } from "@/types/app";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguage } from "@/lib/i18n";

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

  return (
    <div className="relative">
      {/* Card body — entire tap area navigates to profile / edit page */}
      <Link
        href={`/people/${person.id}`}
        className="block p-4 pb-16 transition-opacity active:opacity-90"
        style={{
          borderRadius: "10px 2px 10px 2px",
          background: "linear-gradient(52deg, #d0f2ff 0%, #dccaff 100%)",
        }}
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
    </div>
  );
}
