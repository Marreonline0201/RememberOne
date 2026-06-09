"use client";

// CalendarView — monthly grid calendar with meeting dots and upcoming event indicators.

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { X, WifiOff } from "lucide-react";
import { formatDate, formatRelativeDate, localizeKey, formatTimeInZone, dateKeyInZone, todayKeyInZone } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTimezone } from "@/contexts/TimezoneContext";
import { useOnline } from "@/lib/use-online";
import { getLanguage } from "@/lib/i18n";
import { RecapLine } from "@/components/RecapLine";
import { useCalendarConnect } from "@/lib/use-calendar-connect";
import { useDeviceCalendar } from "@/lib/use-device-calendar";
import { useDismissFlag, GOOGLE_PROMPT_KEY, DEVICE_PROMPT_KEY } from "@/lib/use-dismiss-flag";
import { groupMeetingsByDate } from "@/lib/calendar-group";
import {
  getCachedPeople,
  getCachedConnectionFlag,
  getCachedCalendarEvents,
  cacheCalendarEvents,
  subscribeOffline,
  type CachedCalendar,
} from "@/lib/offline-cache";
import type { PersonFull, UpcomingMeetingAlert as UpcomingAlertType } from "@/types/app";

const INTEREST_KEYS = ["interest", "hobby", "hobbies", "sport", "sports", "passion", "likes"];
function isInterest(key: string) {
  const k = key.toLowerCase();
  return INTEREST_KEYS.some((ik) => k.includes(ik));
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ── Connect Calendar Banner ─────────────────────────────────
function ConnectCalendarBannerInner({ ko, onDismiss }: { ko: boolean; onDismiss: () => void }) {
  const searchParams = useSearchParams();
  const error = searchParams.get("calendar_error");
  const { connect, connecting } = useCalendarConnect();

  return (
    <div
      className="relative p-4 flex flex-col gap-3"
      style={{
        borderRadius: "10px 2px 10px 2px",
        background: "linear-gradient(52deg, #d0f2ff 0%, #dccaff 100%)",
      }}
    >
      <button
        onClick={onDismiss}
        aria-label={ko ? "닫기" : "Dismiss"}
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-black/50 hover:text-black hover:bg-white/40 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        {/* Calendar icon */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg"
          style={{ background: "rgba(255,255,255,0.6)" }}
        >
          📅
        </div>

        <div className="flex-1 pr-6">
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
        onClick={connect}
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

function ConnectCalendarBanner({ ko, onDismiss }: { ko: boolean; onDismiss: () => void }) {
  return (
    <Suspense fallback={null}>
      <ConnectCalendarBannerInner ko={ko} onDismiss={onDismiss} />
    </Suspense>
  );
}

// ── Phone (device) calendar prompt — native only ─────────────
function DeviceCalendarPrompt({
  ko,
  onConnect,
  onDismiss,
  busy,
}: {
  ko: boolean;
  onConnect: () => void;
  onDismiss: () => void;
  busy: boolean;
}) {
  return (
    <div
      className="relative p-4 flex flex-col gap-3"
      style={{
        borderRadius: "10px 2px 10px 2px",
        background: "linear-gradient(52deg, #d0f2ff 0%, #dccaff 100%)",
      }}
    >
      <button
        onClick={onDismiss}
        aria-label={ko ? "닫기" : "Dismiss"}
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-black/50 hover:text-black hover:bg-white/40 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg"
          style={{ background: "rgba(255,255,255,0.6)" }}
        >
          📱
        </div>
        <div className="flex-1 pr-6">
          <p
            className="text-[15px] text-black leading-tight"
            style={{ fontFamily: "'Hammersmith One', sans-serif" }}
          >
            {ko ? "휴대폰 캘린더 사용" : "Use your phone calendar"}
          </p>
          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "#5e7983" }}>
            {ko
              ? "이 휴대폰의 예정된 일정을 저장된 사람과 자동으로 연결해요."
              : "Match upcoming events on this phone to your saved people."}
          </p>
        </div>
      </div>

      <button
        onClick={onConnect}
        disabled={busy}
        className="w-full py-2.5 rounded-xl text-[13px] font-medium text-white transition-opacity active:opacity-80 disabled:opacity-60"
        style={{ background: "linear-gradient(90deg, #5e7983, #9b7fda)" }}
      >
        {busy
          ? ko
            ? "연결 중..."
            : "Connecting..."
          : ko
          ? "휴대폰 캘린더 연결"
          : "Connect phone calendar"}
      </button>
    </div>
  );
}

// ── CalendarView ─────────────────────────────────────────────
export function CalendarView() {
  const { language } = useLanguage();
  const { timezone } = useTimezone();
  const locale = getLanguage(language).locale;
  const ko = language === "ko";
  const online = useOnline();

  // Self-load people + calendar-connection flag from the local store so the
  // calendar renders offline (seeded by the online home load). subscribeOffline
  // keeps them fresh after edits/sync.
  const [people, setPeople] = useState<PersonFull[]>([]);
  const [hasCalendarConnection, setHasCalendarConnection] = useState(false);
  useEffect(() => {
    const load = async () => {
      setPeople(await getCachedPeople());
      setHasCalendarConnection((await getCachedConnectionFlag()) ?? false);
    };
    void load();
    return subscribeOffline(load);
  }, []);

  const hasPeople = people.length > 0;
  const groups = useMemo(() => groupMeetingsByDate(people), [people]);

  // Per-device "dismissed" flags for the two connect prompts (localStorage).
  // `hydrated` gates rendering so an already-dismissed banner never flashes.
  const {
    dismissed: googleDismissed,
    setDismissed: dismissGoogle,
    hydrated,
  } = useDismissFlag(GOOGLE_PROMPT_KEY);
  const { dismissed: deviceDismissed, setDismissed: dismissDevice } =
    useDismissFlag(DEVICE_PROMPT_KEY);

  const today = new Date();
  // "Today" highlight uses the user's chosen timezone, not the device/server zone.
  const todayKey = todayKeyInZone(timezone);

  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(todayKey);
  const [upcomingExpanded, setUpcomingExpanded] = useState(true);

  // Device (phone) calendar — native only. Reads on-device events and matches
  // them to people FULLY ON-DEVICE (offline-safe), independent of Google.
  const {
    alerts: deviceAlerts,
    status: deviceStatus,
    connect: connectDevice,
  } = useDeviceCalendar(hasPeople);

  // Cached Google calendar, stored NORMALIZED (matched person IDs) and hydrated
  // against the current people store at render time — so it shows offline (the
  // last sync) and auto-reflects edited/deleted people.
  const [cachedCalendar, setCachedCalendar] = useState<CachedCalendar | null>(null);
  useEffect(() => {
    let active = true;
    void getCachedCalendarEvents().then((c) => {
      if (active) setCachedCalendar(c);
    });
    return () => {
      active = false;
    };
  }, []);

  // When online + connected, refresh from Google, then re-cache normalized.
  useEffect(() => {
    if (!online || !hasCalendarConnection || !hasPeople) return;
    let active = true;
    fetch("/api/calendar/events")
      .then((r) => r.json())
      .then(({ data }) => {
        if (!active || !Array.isArray(data)) return;
        const alerts = data as UpcomingAlertType[];
        const normalized: CachedCalendar = {
          events: alerts.map((a) => ({
            event: a.event,
            matchedPersonIds: a.matchedPeople.map((p) => p.id),
          })),
          syncedAt: Date.now(),
        };
        setCachedCalendar(normalized);
        void cacheCalendarEvents(normalized);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [online, hasCalendarConnection, hasPeople]);

  // Hydrate the cached normalized events into full alerts using current people.
  const googleAlerts = useMemo<UpcomingAlertType[]>(() => {
    if (!cachedCalendar) return [];
    const byId = new Map(people.map((p) => [p.id, p]));
    return cachedCalendar.events
      .map(({ event, matchedPersonIds }) => ({
        event,
        matchedPeople: matchedPersonIds
          .map((id) => byId.get(id))
          .filter((p): p is PersonFull => !!p),
      }))
      .filter((a) => a.matchedPeople.length > 0);
  }, [cachedCalendar, people]);

  const calendarSyncedAt = cachedCalendar?.syncedAt ?? null;

  // autoTimezone is null on first render, so todayKey starts as the UTC day and
  // the initial selectedDate freezes on it. Once the real zone resolves (or the
  // user changes it), move the default selection to the new "today" — but only
  // if the user hasn't manually tapped a different day.
  const lastAutoTodayRef = useRef(todayKey);
  useEffect(() => {
    setSelectedDate((cur) => (cur === lastAutoTodayRef.current ? todayKey : cur));
    lastAutoTodayRef.current = todayKey;
  }, [todayKey]);

  // Merge Google + device-calendar alerts. Dedupe so a phone that syncs the
  // same Google event doesn't double-list it, then sort chronologically.
  // Key = normalized title + start INSTANT (epoch minute), not the raw ISO
  // string: Google returns a tz offset ("...T10:30:00+09:00") while the device
  // returns UTC ("...T01:30:00Z"), so comparing string prefixes never matched.
  const upcomingAlerts = useMemo(() => {
    const seen = new Set<string>();
    const merged: UpcomingAlertType[] = [];
    for (const a of [...googleAlerts, ...deviceAlerts]) {
      const startMs = new Date(a.event.start).getTime();
      const startKey = Number.isNaN(startMs)
        ? a.event.start
        : Math.floor(startMs / 60000); // same minute → same event
      const key = `${a.event.summary.trim().toLowerCase()}|${startKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(a);
    }
    merged.sort(
      (x, y) => new Date(x.event.start).getTime() - new Date(y.event.start).getTime()
    );
    return merged;
  }, [googleAlerts, deviceAlerts]);

  // Build fast lookup structures
  const meetingDates = new Set(groups.map((g) => g.dateKey));

  const upcomingByDate = new Map<string, UpcomingAlertType[]>();
  for (const alert of upcomingAlerts) {
    const dateKey = dateKeyInZone(alert.event.start, timezone);
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
          {(hasCalendarConnection || upcomingAlerts.length > 0) && (
            <div className="flex items-center gap-1.5">
              <span className="w-[5px] h-[5px] rounded-full inline-block" style={{ backgroundColor: "#9b7fda" }} />
              <span className="text-[10px]" style={{ color: "#5e7983" }}>
                {ko ? "예정된 만남" : "Upcoming"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Google Calendar connect prompt (online only — OAuth needs network) ── */}
      {hydrated && online && !hasCalendarConnection && !googleDismissed && (
        <ConnectCalendarBanner ko={ko} onDismiss={() => dismissGoogle(true)} />
      )}

      {/* ── Phone calendar prompt (native only, when not yet granted) ── */}
      {hydrated && hasPeople && deviceStatus === "prompt" && !deviceDismissed && (
        <DeviceCalendarPrompt
          ko={ko}
          onConnect={connectDevice}
          onDismiss={() => dismissDevice(true)}
          busy={false}
        />
      )}
      {hasPeople && deviceStatus === "denied" && (
        <p className="text-[11px] px-1" style={{ color: "#5e7983" }}>
          {ko
            ? "휴대폰 캘린더 권한이 거부되었습니다. 설정에서 허용하면 일정이 연결됩니다."
            : "Phone calendar permission was denied. Enable it in Settings to match phone events."}
        </p>
      )}

      {/* ── Upcoming meetings (always shown right below calendar) ── */}
      {upcomingAlerts.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setUpcomingExpanded((v) => !v)}
            className="flex items-center gap-2 px-1 w-full"
          >
            <p
              className="text-[12px] uppercase"
              style={{ fontFamily: "'Hammersmith One', sans-serif", color: "#9b7fda" }}
            >
              {ko ? "예정된 만남" : "Upcoming Meetings"}
            </p>
            <span className="text-[12px] ml-auto transition-transform" style={{ color: "#9b7fda", display: "inline-block", transform: upcomingExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}>
              ▾
            </span>
          </button>

          {!online && calendarSyncedAt && (
            <p className="flex items-center gap-1.5 px-1 -mt-1 text-[10px]" style={{ color: "#9b8ec9" }}>
              <WifiOff className="w-3 h-3 shrink-0" />
              {ko ? "마지막 동기화: " : "Last updated "}
              {formatRelativeDate(new Date(calendarSyncedAt).toISOString(), locale)}
            </p>
          )}

          {upcomingExpanded && upcomingAlerts.map((alert) => {
            const eventDate = dateKeyInZone(alert.event.start, timezone);
            const eventTime = formatTimeInZone(alert.event.start, timezone, locale);

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

                      {/* Last meeting summary — auto-translated to the
                          current app language by RecapLine. */}
                      {lastMeeting?.summary && (
                        <RecapLine
                          summary={lastMeeting.summary}
                          className="text-[11px] mt-2 line-clamp-2"
                          style={{ color: "#5e7983" }}
                        />
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
                      <RecapLine
                        summary={summary}
                        className="text-[11px] mt-2 line-clamp-2"
                        style={{ color: "#5e7983" }}
                      />
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
