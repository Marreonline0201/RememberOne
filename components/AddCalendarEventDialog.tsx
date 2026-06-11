"use client";

// Add / edit a Google Calendar event from the in-app calendar.
//
// Flow (per the calendar add button): pick who you're meeting (a saved person
// or "Just me"), optionally a time (empty = all-day), and optional details in
// a collapsible accordion (custom title, duration, location, note — plus the
// date itself in edit mode). Saving writes to Google Calendar via
// /api/calendar/event; the phone's calendar then shows it through the phone's
// own Google account sync.
//
// The dialog also owns the two non-form states:
//   - no connection      → Connect Google Calendar prompt
//   - readonly connection → one-tap Reconnect prompt (the API returns
//     "reauth_required" for connections granted under the old readonly scope)

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, User, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTimezone } from "@/contexts/TimezoneContext";
import { useCalendarConnect } from "@/lib/use-calendar-connect";
import { cacheConnectionFlag } from "@/lib/offline-cache";
import { getLanguage } from "@/lib/i18n";
import { formatDate, dateKeyInZone, todayKeyInZone } from "@/lib/utils";
import type { CalendarEvent, PersonFull } from "@/types/app";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The tapped calendar date (YYYY-MM-DD) — the create-mode event date. */
  dateKey: string;
  people: PersonFull[];
  /** When set, the dialog edits this (app-created) event instead of creating. */
  editing: CalendarEvent | null;
  hasConnection: boolean;
  /** Refetch + re-cache events; awaited before the dialog closes. */
  onSaved: () => Promise<void> | void;
}

// "HH:mm" (24h) of an instant in an explicit zone — prefills the time input.
function toHHmm(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function durationFromEvent(e: CalendarEvent): number {
  if (!e.start.includes("T") || !e.end.includes("T")) return 60;
  const ms = new Date(e.end).getTime() - new Date(e.start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 60;
  return Math.min(1440, Math.max(5, Math.round(ms / 60000)));
}

const inputStyle = {
  backgroundColor: "#f7f3ff",
  border: "1.5px solid #dccaff",
} as const;

export function AddCalendarEventDialog({
  open,
  onOpenChange,
  dateKey,
  people,
  editing,
  hasConnection,
  onSaved,
}: Props) {
  const { language, t } = useLanguage();
  const ko = language === "ko";
  const locale = getLanguage(language).locale;
  const { timezone } = useTimezone();

  const [personId, setPersonId] = useState<string>("me");
  const [date, setDate] = useState(dateKey);
  const [time, setTime] = useState(""); // "" = all-day
  const [duration, setDuration] = useState(60);
  const [title, setTitle] = useState(""); // "" = auto-generated
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // (Re)initialize the form each time the dialog opens — not on later prop
  // identity changes (people refresh mid-edit must not wipe the user's input).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      if (editing) {
        setPersonId(editing.appPersonId ?? "me");
        setDate(dateKeyInZone(editing.start, timezone));
        setTime(editing.start.includes("T") ? toHHmm(editing.start, timezone) : "");
        setDuration(durationFromEvent(editing));
        setTitle(editing.summary);
        setLocation(editing.location ?? "");
        setNote(editing.description ?? "");
      } else {
        setPersonId("me");
        setDate(dateKey);
        setTime("");
        setDuration(60);
        setTitle("");
        setLocation("");
        setNote("");
      }
      setSearch("");
      setDetailsOpen(false);
      setSaving(false);
      setConfirmDelete(false);
      setNeedsReauth(false);
      setError(null);
    }
    wasOpen.current = open;
  }, [open, editing, dateKey, timezone]);

  // After a successful native (re)connect, refresh the cached connection flag
  // directly — its normal writer is the home load, so the calendar page would
  // otherwise keep showing the connect prompt until the next home visit.
  // (The web flow full-page-redirects through Google, so it never reaches this.)
  const { connect, connecting } = useCalendarConnect(() => {
    void cacheConnectionFlag(true);
    setNeedsReauth(false);
  });

  const todayKey = todayKeyInZone(timezone);

  const sortedPeople = useMemo(
    () =>
      [...people].sort((a, b) =>
        a.name.localeCompare(b.name, ko ? "ko" : undefined)
      ),
    [people, ko]
  );
  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedPeople;
    return sortedPeople.filter((p) => p.name.toLowerCase().includes(q));
  }, [sortedPeople, search]);

  const selectedPerson =
    personId === "me" ? null : people.find((p) => p.id === personId) ?? null;
  const autoTitle = selectedPerson
    ? ko
      ? `${selectedPerson.name} 만나기`
      : `Meet ${selectedPerson.name}`
    : t("calendar.personal_plan");

  const durationOptions = useMemo(() => {
    const base = [30, 60, 90, 120];
    return base.includes(duration)
      ? base
      : [...base, duration].sort((a, b) => a - b);
  }, [duration]);
  const durationLabel = (m: number) =>
    m % 60 === 0 ? (ko ? `${m / 60}시간` : `${m / 60} h`) : ko ? `${m}분` : `${m} min`;

  const showConnect = !hasConnection || needsReauth;

  async function submit() {
    if (saving) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError(t("calendar.save_failed"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar/event", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          time: time || null,
          durationMin: duration,
          timeZone: timezone,
          title: title.trim() || autoTitle,
          personId,
          location: location.trim() || null,
          note: note.trim() || null,
          ...(editing ? { eventId: editing.id } : {}),
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        if (j?.error === "reauth_required" || j?.error === "not_connected") {
          setNeedsReauth(true);
        } else if (j?.error === "event_not_found") {
          setError(t("calendar.event_gone"));
          void onSaved(); // refresh so the stale event disappears
        } else {
          setError(t("calendar.save_failed"));
        }
        return;
      }
      await onSaved();
      onOpenChange(false);
    } catch {
      setError(t("calendar.save_failed"));
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent() {
    if (!editing || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar/event", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: editing.id }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        if (j?.error === "reauth_required" || j?.error === "not_connected") {
          setNeedsReauth(true);
        } else {
          setError(t("calendar.save_failed"));
        }
        return;
      }
      await onSaved();
      onOpenChange(false);
    } catch {
      setError(t("calendar.save_failed"));
    } finally {
      setSaving(false);
    }
  }

  const personRow = (
    id: string,
    name: string,
    avatar: React.ReactNode
  ) => {
    const selected = personId === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setPersonId(id)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
        style={{
          backgroundColor: selected ? "rgba(155,127,218,0.18)" : "transparent",
        }}
      >
        {avatar}
        <span className="text-[14px] text-black flex-1 truncate">{name}</span>
        <span
          className="w-[18px] h-[18px] rounded-full flex-shrink-0 flex items-center justify-center"
          style={{
            border: selected ? "none" : "1.5px solid #dccaff",
            background: selected
              ? "linear-gradient(135deg, #9b7fda, #5e7983)"
              : "transparent",
          }}
        >
          {selected && <span className="w-[7px] h-[7px] rounded-full bg-white" />}
        </span>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle
            className="text-left text-[18px] uppercase"
            style={{ fontFamily: "'Hammersmith One', sans-serif" }}
          >
            {editing ? t("calendar.edit_meeting") : t("calendar.add_meeting")}
          </DialogTitle>
          <DialogDescription className="text-left text-[12px]" style={{ color: "#5e7983" }}>
            {formatDate(date, locale)}
          </DialogDescription>
        </DialogHeader>

        {showConnect ? (
          // ── Connect / reconnect Google Calendar ──
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
              style={{ background: "linear-gradient(135deg, #d0f2ff, #dccaff)" }}
            >
              📅
            </div>
            <p className="text-[13px] leading-relaxed" style={{ color: "#5e7983" }}>
              {t(needsReauth ? "calendar.reconnect_hint" : "calendar.add_connect_hint")}
            </p>
            <button
              onClick={connect}
              disabled={connecting}
              className="w-full py-2.5 rounded-xl text-[13px] font-medium text-white transition-opacity active:opacity-80 disabled:opacity-60"
              style={{ background: "linear-gradient(90deg, #5e7983, #9b7fda)" }}
            >
              {connecting
                ? ko
                  ? "연결 중..."
                  : "Connecting..."
                : t(needsReauth ? "calendar.reconnect" : "calendar.connect")}
            </button>
          </div>
        ) : (
          // ── Event form ──
          <div className="space-y-4">
            {/* Who are you meeting? */}
            <div>
              <p
                className="text-[11px] uppercase tracking-wide mb-1.5"
                style={{ fontFamily: "'Hammersmith One', sans-serif", color: "#5e7983" }}
              >
                {t("calendar.who")}
              </p>
              {people.length > 6 && (
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("calendar.search_people")}
                  className="w-full h-9 px-3 mb-1.5 rounded-xl text-[13px] outline-none"
                  style={inputStyle}
                />
              )}
              <div
                className="max-h-44 overflow-y-auto rounded-xl"
                style={{
                  border: "1.5px solid #dccaff",
                  backgroundColor: "rgba(220,202,255,0.12)",
                }}
              >
                {personRow(
                  "me",
                  t("calendar.just_me"),
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(94,121,131,0.18)" }}
                  >
                    <User className="w-4 h-4" style={{ color: "#5e7983" }} />
                  </span>
                )}
                {filteredPeople.map((p) =>
                  personRow(
                    p.id,
                    p.name,
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] text-white font-medium flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #9b7fda, #5e7983)" }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                  )
                )}
                {filteredPeople.length === 0 && search.trim() && (
                  <p className="px-3 py-3 text-[12px]" style={{ color: "#5e7983" }}>
                    {t("calendar.no_people_found")}
                  </p>
                )}
              </div>
            </div>

            {/* Time (empty = all-day) */}
            <div className="flex items-center gap-3">
              <span
                className="text-[11px] uppercase tracking-wide w-16 flex-shrink-0"
                style={{ fontFamily: "'Hammersmith One', sans-serif", color: "#5e7983" }}
              >
                {t("calendar.time")}
              </span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="flex-1 h-10 px-3 rounded-xl text-[14px] outline-none"
                style={inputStyle}
              />
              {time ? (
                <button
                  type="button"
                  onClick={() => setTime("")}
                  aria-label={ko ? "시간 지우기" : "Clear time"}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-black/40 hover:text-black hover:bg-black/5 transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <span className="text-[11px] flex-shrink-0" style={{ color: "#9b8ec9" }}>
                  {t("calendar.all_day")}
                </span>
              )}
            </div>

            {/* Details accordion (optional fields) */}
            <div>
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                className="flex items-center gap-1.5 w-full"
              >
                <span
                  className="text-[11px] uppercase tracking-wide"
                  style={{ fontFamily: "'Hammersmith One', sans-serif", color: "#9b7fda" }}
                >
                  {t("calendar.details")}
                </span>
                <ChevronDown
                  className="w-3.5 h-3.5 transition-transform"
                  style={{
                    color: "#9b7fda",
                    transform: detailsOpen ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              </button>

              {detailsOpen && (
                <div className="space-y-2.5 mt-2.5">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`${t("calendar.event_title")}: ${autoTitle}`}
                    maxLength={200}
                    className="w-full h-10 px-3 rounded-xl text-[13px] outline-none"
                    style={inputStyle}
                  />
                  {time && (
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] w-16 flex-shrink-0" style={{ color: "#5e7983" }}>
                        {t("calendar.duration")}
                      </span>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                        className="flex-1 h-10 px-2 rounded-xl text-[13px] outline-none"
                        style={inputStyle}
                      >
                        {durationOptions.map((m) => (
                          <option key={m} value={m}>
                            {durationLabel(m)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={t("calendar.location")}
                    maxLength={300}
                    className="w-full h-10 px-3 rounded-xl text-[13px] outline-none"
                    style={inputStyle}
                  />
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t("calendar.note")}
                    maxLength={2000}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl text-[13px] outline-none resize-none"
                    style={inputStyle}
                  />
                  {editing && (
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] w-16 flex-shrink-0" style={{ color: "#5e7983" }}>
                        {t("calendar.date")}
                      </span>
                      <input
                        type="date"
                        value={date}
                        min={todayKey}
                        onChange={(e) => setDate(e.target.value)}
                        className="flex-1 h-10 px-3 rounded-xl text-[13px] outline-none"
                        style={inputStyle}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <p className="text-[12px]" style={{ color: "#c0392b" }}>
                {error}
              </p>
            )}

            {/* Actions */}
            <button
              onClick={submit}
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-[13px] font-medium text-white transition-opacity active:opacity-80 disabled:opacity-60"
              style={{ background: "linear-gradient(to right, #284e72, #482d7c)" }}
            >
              {saving
                ? t("calendar.saving")
                : editing
                  ? t("calendar.save_action")
                  : t("calendar.add_action")}
            </button>

            {editing &&
              (confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-[12px] flex-1" style={{ color: "#c0392b" }}>
                    {t("calendar.delete_confirm")}
                  </span>
                  <button
                    onClick={removeEvent}
                    disabled={saving}
                    className="px-3 py-2 rounded-xl text-[12px] font-medium text-white disabled:opacity-60"
                    style={{ backgroundColor: "#c0392b" }}
                  >
                    {t("calendar.delete_action")}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={saving}
                    className="px-3 py-2 rounded-xl text-[12px]"
                    style={{ color: "#5e7983", border: "1.5px solid #dccaff" }}
                  >
                    {ko ? "취소" : "Cancel"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full py-2 text-[12px] transition-opacity active:opacity-80"
                  style={{ color: "#c0392b" }}
                >
                  {t("calendar.delete_action")}
                </button>
              ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
