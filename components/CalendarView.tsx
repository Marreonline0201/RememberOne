"use client";

// CalendarView — client component so dates re-format when language changes.

import Link from "next/link";
import { UpcomingMeetingAlert } from "@/components/UpcomingMeetingAlert";
import { formatDate, formatRelativeDate, localizeKey } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguage } from "@/lib/i18n";
import type { PersonFull } from "@/types/app";

interface CalendarEntry {
  person: PersonFull;
  meetingId: string;
  summary?: string | null;
}

interface DayGroup {
  dateKey: string; // "2024-03-15"
  entries: CalendarEntry[];
}

interface Props {
  groups: DayGroup[];
  hasCalendarConnection: boolean;
  hasPeople: boolean;
}

const INTEREST_KEYS = ["interest", "hobby", "hobbies", "sport", "sports", "passion", "likes"];
function isInterest(key: string) {
  const k = key.toLowerCase();
  return INTEREST_KEYS.some((ik) => k.includes(ik));
}

export function CalendarView({ groups, hasCalendarConnection, hasPeople }: Props) {
  const { language } = useLanguage();
  const locale = getLanguage(language).locale;

  return (
    <div className="w-full max-w-lg mx-auto space-y-5">
      {/* Upcoming meeting alert */}
      {hasCalendarConnection && hasPeople && <UpcomingMeetingAlert />}

      {/* Empty state */}
      {groups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #d0f2ff, #dccaff)" }}
          >
            <span className="text-3xl">📅</span>
          </div>
          <p
            className="text-[18px] text-black uppercase"
            style={{ fontFamily: "'Hammersmith One', sans-serif" }}
          >
            {language === "ko" ? "아직 만남이 없어요" : "No meetings yet"}
          </p>
          <p className="text-[13px]" style={{ color: "#5e7983" }}>
            {language === "ko"
              ? "아래 마이크 버튼으로 첫 번째 만남을 기록하세요."
              : "Log your first meeting using the mic button below."}
          </p>
        </div>
      )}

      {/* Day groups */}
      {groups.map((group) => (
        <div key={group.dateKey}>
          {/* Date header */}
          <div className="flex items-baseline gap-2 mb-3 px-1">
            <span
              className="text-[14px] text-black uppercase"
              style={{ fontFamily: "'Hammersmith One', sans-serif" }}
            >
              {formatDate(group.dateKey, locale)}
            </span>
            <span className="text-[11px]" style={{ color: "#5e7983" }}>
              {formatRelativeDate(group.dateKey, locale)}
            </span>
          </div>

          {/* People met on this day */}
          <div className="space-y-3">
            {group.entries.map(({ person, meetingId, summary }) => {
              const mainInfo = person.attributes.filter((a) => !isInterest(a.key));
              return (
                <Link
                  key={meetingId}
                  href={`/people/${person.id}`}
                  className="block p-4 transition-opacity active:opacity-90"
                  style={{
                    borderRadius: "10px 2px 10px 2px",
                    background: "linear-gradient(52deg, #d0f2ff 0%, #dccaff 100%)",
                  }}
                >
                  <h3
                    className="text-[22px] leading-tight text-black"
                    style={{ fontFamily: "'Hammersmith One', sans-serif" }}
                  >
                    {person.name}
                  </h3>

                  {mainInfo.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {mainInfo.slice(0, 4).map((attr) => (
                        <span
                          key={attr.id}
                          className="text-[10px] px-2 py-[3px] rounded-[5px] shadow-sm text-black"
                          style={{ backgroundColor: "#dccaff" }}
                        >
                          {localizeKey(attr.key, language)}: {attr.value}
                        </span>
                      ))}
                    </div>
                  )}

                  {summary && (
                    <p
                      className="text-[11px] mt-2 line-clamp-2"
                      style={{ color: "#5e7983" }}
                    >
                      {summary}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
