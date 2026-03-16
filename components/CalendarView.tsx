"use client";

// CalendarView — monthly grid calendar with meeting dots and upcoming event indicators.

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatDate, formatRelativeDate, localizeKey } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguage } from "@/lib/i18n";
import type { PersonFull, UpcomingMeetingAlert as UpcomingAlertType } from "@/types/app";

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

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ── Connect Calendar Banner ─────────────────────────────────
function ConnectCalendarBannerInner({ ko }: { ko: boolean }) {
  const searchParams = useSearchParams();
  const error = searchParams.get("calendar_error");
  const [connecting, setConnecting] = useState(false);

  function handleConnect() {
    setConnecting(true);
    window.location.href = "/api/calendar/connect";
  }

  return (
    <div
      className="p-4 flex flex-col gap-3"
      style={{
        borderRadius: "10px 2px 10px 2px",
        background: "linear-gradient(52deg, #d0f2ff 0%, #dccaff 100%)",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Calendar icon */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg"
          style={{ background: "rgba(255,255,255,0.6)" }}
        >
          📅
        </div>

        <div className="flex-1">
          <p
            className="text-[15px] text-black leading-tight"
            style={{ fontFamily: "'Hammersmith One', sans-serif" }}
          >
            {ko ? "Google 캘린더 연동" : "Connect Google Calendar"}
          </p>
          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "#5e7983" }}>
            {ko
              ? "예정된 미팅 전에 저장된 사람의 정보를 확인하세요."
              : "See saved profiles before your upcoming meetings."}
          </p>
          {error && (
            <p className="text-[11px] mt-1" style={{ color: "#c0392b" }}>
              {ko ? "연결 실패. 다시 시도해 주세요." : `Could not connect: ${error.replace(/_/g, " ")}. Try again.`}
            </p>
          )}
        </div>
      </div>

      <button
        onClick={handleConnect}
        disabled={connecting}
        className="w-full py-2.5 rounded-xl text-[13px] font-medium text-white transition-opacity active:opacity-80 disabled:opacity-60"
        style={{ background: "linear-gradient(90deg, #5e7983, #9b7fda)" }}
      >
        {connecting
          ? (ko ? "연결 중..." : "Connecting...")
          : (ko ? "Google 캘린더 연결하기" : "Connect Google Calendar")}
      </button>
    </div>
  );
}

function ConnectCalendarBanner({ ko }: { ko: boolean }) {
  return (
    <Suspense fallback={null}>
      <ConnectCalendarBannerInner ko={ko} />
    </Suspense>
  );
}

// ── CalendarView ─────────────────────────────────────────────
export function CalendarView({ groups, hasCalendarConnection, hasPeople }: Props) {
  const { language } = useLanguage();
  const locale = getLanguage(language).locale;
  const ko = language === "ko";

  const today = new Date();
  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(todayKey);
  const [upcomingAlerts, setUpcomingAlerts] = useState<UpcomingAlertType[]>([]);

  // Fetch upcoming Google Calendar events for dot markers
  useEffect(() => {
    if (!hasCalendarConnection || !hasPeople) return;
    fetch("/api/calendar/events")
      .then((r) => r.json())
      .then(({ data }) => { if (Array.isArray(data)) setUpcomingAlerts(data); })
      .catch(() => {});
  }, [hasCalendarConnection, hasPeople]);

  // Build fast lookup structures
  const meetingDates = new Set(groups.map((g) => g.dateKey));

  const upcomingByDate = new Map<string, UpcomingAlertType[]>();
  for (const alert of upcomingAlerts) {
    const dateKey = alert.event.start.slice(0, 10);
    if (!upcomingByDate.has(dateKey)) upcomingByDate.set(dateKey, []);
    upcomingByDate.get(dateKey)!.push(alert);
  }

  // Calendar grid math
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const MONTHS_KO = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
  const DAYS_EN   = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  const DAYS_KO   = ["일","월","화","수","목","금","토"];

  const monthNames = ko ? MONTHS_KO : MONTHS_EN;
  const dayHeaders = ko ? DAYS_KO : DAYS_EN;

  const years = Array.from({ length: 6 }, (_, i) => today.getFullYear() - 3 + i);

  // Data for the selected date
  const selectedGroup = selectedDate ? groups.find((g) => g.dateKey === selectedDate) ?? null : null;
  const selectedUpcoming = selectedDate ? (upcomingByDate.get(selectedDate) ?? []) : [];

  return (
    <div className="w-full max-w-lg mx-auto space-y-5">

      {/* ── Monthly calendar grid ── */}
      <div
        className="rounded-2xl p-4"
        style={{ background: "linear-gradient(135deg, #d0f2ff 0%, #dccaff 100%)" }}
      >
        {/* Month / year navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-full text-black hover:bg-white/40 transition-colors text-lg"
          >
            ‹
          </button>

          <div className="flex items-center gap-2">
            <select
              value={month}
              onChange={(e) => setCurrentMonth(new Date(year, parseInt(e.target.value), 1))}
              className="bg-white/60 backdrop-blur-sm rounded-lg px-2 py-1 text-[13px] font-medium text-black border-0 outline-none cursor-pointer"
            >
              {monthNames.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>

            <select
              value={year}
              onChange={(e) => setCurrentMonth(new Date(parseInt(e.target.value), month, 1))}
              className="bg-white/60 backdrop-blur-sm rounded-lg px-2 py-1 text-[13px] font-medium text-black border-0 outline-none cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-full text-black hover:bg-white/40 transition-colors text-lg"
          >
            ›
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {dayHeaders.map((d) => (
            <div
              key={d}
              className="text-center text-[11px] font-medium py-1"
              style={{ color: "#5e7983" }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {/* Empty leading cells */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="py-1" />
          ))}

          {/* Day numbers */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dateKey = toDateKey(year, month, day);
            const isSelected  = dateKey === selectedDate;
            const isToday     = dateKey === todayKey;
            const hasMeeting  = meetingDates.has(dateKey);
            const hasUpcoming = upcomingByDate.has(dateKey);

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                className="flex flex-col items-center py-1"
              >
                {/* Number circle */}
                <span
                  className="w-8 h-8 flex items-center justify-center rounded-full text-[13px] font-medium transition-colors"
                  style={{
                    background: isSelected
                      ? "#2d2d2d"
                      : isToday
                      ? "rgba(255,255,255,0.75)"
                      : "transparent",
                    color: isSelected ? "#fff" : "#000",
                    outline: hasUpcoming && !isSelected ? "1.5px solid #9b7fda" : "none",
                  }}
                >
                  {day}
                </span>

                {/* Indicator dots */}
                <div className="flex gap-[3px] mt-[3px] h-[5px]">
                  {hasMeeting && (
                    <span
                      className="w-[5px] h-[5px] rounded-full"
                      style={{ backgroundColor: "#5e7983" }}
                    />
                  )}
                  {hasUpcoming && (
                    <span
                      className="w-[5px] h-[5px] rounded-full"
                      style={{ backgroundColor: "#9b7fda" }}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-3 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-[5px] h-[5px] rounded-full inline-block" style={{ backgroundColor: "#5e7983" }} />
            <span className="text-[10px]" style={{ color: "#5e7983" }}>
              {ko ? "만남 기록" : "Past meeting"}
            </span>
          </div>
          {hasCalendarConnection && (
            <div className="flex items-center gap-1.5">
              <span className="w-[5px] h-[5px] rounded-full inline-block" style={{ backgroundColor: "#9b7fda" }} />
              <span className="text-[10px]" style={{ color: "#5e7983" }}>
                {ko ? "예정된 만남" : "Upcoming"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Google Calendar connect prompt ── */}
      {!hasCalendarConnection && (
        <ConnectCalendarBanner ko={ko} />
      )}

      {/* ── Upcoming meetings (always shown right below calendar) ── */}
      {upcomingAlerts.length > 0 && (
        <div className="space-y-3">
          <p
            className="text-[12px] uppercase px-1"
            style={{ fontFamily: "'Hammersmith One', sans-serif", color: "#9b7fda" }}
          >
            {ko ? "예정된 만남" : "Upcoming Meetings"}
          </p>

          {upcomingAlerts.map((alert) => {
            const eventDate = alert.event.start.slice(0, 10);
            const eventTime = new Date(alert.event.start).toLocaleTimeString(locale, {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={alert.event.id}
                className="p-4"
                style={{
                  borderRadius: "10px 2px 10px 2px",
                  background: "linear-gradient(52deg, #eef7ff 0%, #ede8ff 100%)",
                  border: "1.5px solid #dccaff",
                }}
              >
                {/* Event title + time */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p
                    className="text-[16px] text-black leading-tight"
                    style={{ fontFamily: "'Hammersmith One', sans-serif" }}
                  >
                    {alert.event.summary}
                  </p>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span
                      className="text-[10px] px-2 py-[3px] rounded-full text-white font-medium"
                      style={{ backgroundColor: "#9b7fda" }}
                    >
                      {formatDate(eventDate, locale)}
                    </span>
                    <span className="text-[11px] mt-1" style={{ color: "#5e7983" }}>
                      {eventTime}
                    </span>
                  </div>
                </div>

                {/* Full person cards for each matched person */}
                {alert.matchedPeople.map((person) => {
                  const mainInfo = person.attributes.filter((a) => !isInterest(a.key));
                  const lastMeeting = person.meetings[0] ?? null;
                  return (
                    <Link
                      key={person.id}
                      href={`/people/${person.id}`}
                      className="block mt-2 p-3 transition-opacity active:opacity-80"
                      style={{
                        borderRadius: "8px 2px 8px 2px",
                        background: "linear-gradient(52deg, #d0f2ff 0%, #dccaff 100%)",
                      }}
                    >
                      {/* Avatar + name */}
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] text-white font-medium flex-shrink-0"
                          style={{ background: "linear-gradient(135deg, #9b7fda, #5e7983)" }}
                        >
                          {person.name.charAt(0).toUpperCase()}
                        </div>
                        <span
                          className="text-[18px] text-black leading-tight"
                          style={{ fontFamily: "'Hammersmith One', sans-serif" }}
                        >
                          {person.name}
                        </span>
                      </div>

                      {/* Attribute chips */}
                      {mainInfo.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
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

                      {/* Last meeting summary */}
                      {lastMeeting?.summary && (
                        <p className="text-[11px] mt-2 line-clamp-2" style={{ color: "#5e7983" }}>
                          {lastMeeting.summary}
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Selected date: past meetings ── */}
      {selectedDate && (
        <div>
          {/* Date label */}
          <div className="flex items-baseline gap-2 mb-3 px-1">
            <span
              className="text-[14px] text-black uppercase"
              style={{ fontFamily: "'Hammersmith One', sans-serif" }}
            >
              {formatDate(selectedDate, locale)}
            </span>
            <span className="text-[11px]" style={{ color: "#5e7983" }}>
              {formatRelativeDate(selectedDate, locale)}
            </span>
          </div>

          {/* Past meetings on this day */}
          {selectedGroup && (
            <div className="space-y-3">
              {selectedGroup.entries.map(({ person, meetingId, summary }) => {
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
                      <p className="text-[11px] mt-2 line-clamp-2" style={{ color: "#5e7983" }}>
                        {summary}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Nothing on this day */}
          {!selectedGroup && (
            <p
              className="text-center text-[13px] py-8"
              style={{ color: "#5e7983" }}
            >
              {ko ? "이 날 기록된 만남이 없어요" : "No meetings on this day"}
            </p>
          )}
        </div>
      )}

      {/* ── Empty state (no people at all) ── */}
      {!hasPeople && (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
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
            {ko ? "아직 만남이 없어요" : "No meetings yet"}
          </p>
          <p className="text-[13px]" style={{ color: "#5e7983" }}>
            {ko
              ? "아래 마이크 버튼으로 첫 번째 만남을 기록하세요."
              : "Log your first meeting using the mic button below."}
          </p>
        </div>
      )}
    </div>
  );
}
