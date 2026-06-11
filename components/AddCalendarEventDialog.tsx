"use client";

// Add / edit a Google Calendar event from the in-app calendar.
//
// Flow (per the calendar add button): pick who you're meeting (a saved person
// or "Just me"), set Start and End (date + time, or an All-day span), and
// optional details in a collapsible accordion (custom title, location, note).
// Saving writes to the phone's calendar (native) or Google Calendar (web /
// fallback) via /api/calendar/event.
//
// The dialog also owns the two non-form states:
//   - no connection      → Connect Google Calendar prompt
//   - readonly connection → one-tap Reconnect prompt (the API returns
//     "reauth_required" for connections granted under the old readonly scope)

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, User } from "lucide-react";
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
import {
  createDeviceEvent,
  modifyDeviceEvent,
  deleteDeviceEvent,
  ensureDeviceWriteAccess,
} from "@/lib/device-calendar";
import { cacheConnectionFlag } from "@/lib/offline-cache";
import { getLanguage } from "@/lib/i18n";
import { addDaysToKey, formatDate, dateKeyInZone, todayKeyInZone } from "@/lib/utils";
import type { CalendarEvent, PersonFull } from "@/types/app";

// How far ahead the app lets you add/move an event. The calendar fetches a
// 62-day window (timeMin = now), so anything past it would save fine in
// Google but silently never show in the app — cap the affordance instead.
export const MAX_ADD_DAYS_AHEAD = 61;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The tapped calendar date (YYYY-MM-DD) — the create-mode event date. */
  dateKey: string;
  people: PersonFull[];
  /** When set, the dialog edits this event instead of creating. */
  editing: CalendarEvent | null;
  /** The edited event's matched person (device events carry no tag). */
  editingPersonId: string | null;
  hasConnection: boolean;
  /** Native + calendar plugin present — the phone-calendar write path can be
   *  attempted (permission is requested at first save; a denial — e.g. an
   *  install whose manifest predates WRITE_CALENDAR — falls back to Google). */
  deviceAvailable: boolean;
  /** Called after a fresh device write grant — promotes read access too (the
   *  permissions share a group) so the just-saved event actually renders. */
  onDeviceGranted: () => void | Promise<void>;
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

// Add one hour to a wall-clock date/time, rolling the date over midnight (UTC
// arithmetic only — no zone conversion). Used to auto-follow the end with the
// start when the user hasn't set the end by hand.
function plusOneHour(date: string, time: string): { date: string; time: string } {
  const d = new Date(`${date}T${time}:00Z`);
  if (Number.isNaN(d.getTime())) return { date, time };
  d.setUTCMinutes(d.getUTCMinutes() + 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
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
  editingPersonId,
  hasConnection,
  deviceAvailable,
  onDeviceGranted,
  onSaved,
}: Props) {
  const { language, t } = useLanguage();
  const ko = language === "ko";
  const locale = getLanguage(language).locale;
  const { timezone } = useTimezone();

  const [personId, setPersonId] = useState<string>("me");
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState(dateKey);
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState(dateKey);
  const [endTime, setEndTime] = useState("10:00");
  const [title, setTitle] = useState(""); // "" = auto-generated
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Once the user edits the End by hand, stop auto-following it from the Start.
  const endTouched = useRef(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  // Phone-calendar write was attempted and denied this session (old install
  // without WRITE_CALENDAR, or the user refused) — stop retrying the prompt
  // and use the Google path instead.
  const [deviceDenied, setDeviceDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // (Re)initialize the form each time the dialog opens — not on later prop
  // identity changes (people refresh mid-edit must not wipe the user's input).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      if (editing) {
        // Person: the explicit app tag wins; else the matched person passed in
        // (device events carry no tag); else "me".
        const resolvedPersonId = editing.appPersonId ?? editingPersonId ?? "me";
        setPersonId(resolvedPersonId);

        const isAllDay = !editing.start.includes("T");
        setAllDay(isAllDay);
        const sDate = dateKeyInZone(editing.start, timezone);
        setStartDate(sDate);
        if (isAllDay) {
          // Stored all-day end is EXCLUSIVE; show the inclusive last day.
          const endIncl = addDaysToKey(dateKeyInZone(editing.end, timezone), -1);
          setEndDate(endIncl < sDate ? sDate : endIncl);
          setStartTime("09:00");
          setEndTime("10:00");
        } else {
          setStartTime(toHHmm(editing.start, timezone) || "09:00");
          setEndDate(dateKeyInZone(editing.end, timezone));
          setEndTime(toHHmm(editing.end, timezone) || "10:00");
        }
        endTouched.current = true; // an existing event has an explicit end

        // Auto-generated titles must STAY auto: prefill blank when the summary
        // is exactly the prefilled person's auto title, so switching the person
        // re-titles the event instead of keeping a stale "Meet {old name}".
        const prefillPerson =
          resolvedPersonId !== "me"
            ? people.find((p) => p.id === resolvedPersonId) ?? null
            : null;
        const prefillAuto = prefillPerson
          ? ko
            ? `${prefillPerson.name} 만나기`
            : `Meet ${prefillPerson.name}`
          : t("calendar.personal_plan");
        setTitle(editing.summary === prefillAuto ? "" : editing.summary);
        setLocation(editing.location ?? "");
        setNote(editing.description ?? "");
      } else {
        setPersonId("me");
        setAllDay(false);
        setStartDate(dateKey);
        setEndDate(dateKey);
        setStartTime("09:00");
        setEndTime("10:00");
        endTouched.current = false;
        setTitle("");
        setLocation("");
        setNote("");
      }
      setSearch("");
      setDetailsOpen(false);
      setSaving(false);
      setConfirmDelete(false);
      setNeedsReauth(false);
      setDeviceDenied(false);
      setError(null);
    }
    wasOpen.current = open;
  }, [open, editing, editingPersonId, dateKey, timezone, people, ko, t]);

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

  const maxDate = addDaysToKey(todayKey, MAX_ADD_DAYS_AHEAD);

  // End must be after start (all-day: end date on/after start date). A timed
  // event with a cleared time is invalid — block it rather than let the device
  // path silently save it as all-day or the Google path 400 with no hint.
  const timeError = useMemo(() => {
    if (allDay) return endDate < startDate;
    if (!startTime || !endTime) return true;
    return `${endDate}T${endTime}` <= `${startDate}T${startTime}`;
  }, [allDay, startDate, startTime, endDate, endTime]);

  // Start changes: keep the end aligned until the user sets it by hand.
  const onStartDateChange = (v: string) => {
    setStartDate(v);
    if (!endTouched.current) {
      // Re-derive the end so a past-midnight roll doesn't strand the end time
      // on the old day.
      const n = startTime ? plusOneHour(v, startTime) : { date: v, time: endTime };
      setEndDate(n.date);
      setEndTime(n.time);
    } else if (endDate < v) {
      setEndDate(v);
    }
  };
  const onStartTimeChange = (v: string) => {
    setStartTime(v);
    if (!endTouched.current && v) {
      const n = plusOneHour(startDate, v);
      setEndDate(n.date);
      setEndTime(n.time);
    }
  };

  // When the Google connect/reconnect prompt takes over the dialog body:
  // - needsReauth means a Google-routed write already failed on scope/session —
  //   only a (re)connect can fix it, so it shows even on native (a device-
  //   sourced event never sets it).
  // - otherwise only when the phone-calendar path can't carry the write
  //   (web, or a device-write denial) AND there's no Google connection.
  const showConnect =
    needsReauth || ((!deviceAvailable || deviceDenied) && !hasConnection);

  // Wall-clock fields shared by both write paths.
  const eventInput = () => ({
    startDate,
    startTime: allDay ? null : startTime,
    endDate,
    endTime: allDay ? null : endTime,
    allDay,
    timeZone: timezone,
    title: title.trim() || autoTitle,
    personId,
    location: location.trim() || null,
    note: note.trim() || null,
  });

  // Take (or confirm) phone-calendar write access for a CREATE. A denial flips
  // the dialog into Google-fallback mode for the rest of this open.
  async function takeDeviceWrite(): Promise<boolean> {
    const ok = await ensureDeviceWriteAccess();
    if (ok) await onDeviceGranted();
    else setDeviceDenied(true);
    return ok;
  }

  // Same, for editing/deleting a DEVICE event: a denial here must NOT swap the
  // dialog to the Google prompt — Google can't modify a device-id event.
  async function deviceWriteForExisting(): Promise<boolean> {
    const ok = await ensureDeviceWriteAccess();
    if (ok) await onDeviceGranted();
    else setError(t("calendar.save_failed"));
    return ok;
  }

  async function saveViaGoogle(): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError(t("calendar.save_failed"));
      return;
    }
    const res = await fetch("/api/calendar/event", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...eventInput(),
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
  }

  async function submit() {
    if (saving) return;
    if (timeError) {
      setError(t("calendar.end_before_start"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Device-sourced events only exist on the phone for us (no Google id) —
      // they must change on-device.
      if (editing && editing.source === "device") {
        if (await deviceWriteForExisting()) {
          await modifyDeviceEvent(editing.id, eventInput());
          await onSaved();
          onOpenChange(false);
        }
        return;
      }
      // Creates prefer the phone calendar when the plugin is present: works
      // offline, no Google account needed; the phone itself syncs the event up
      // to Google. Denied (old install / refusal) → Google fallback.
      if (!editing && deviceAvailable && !deviceDenied) {
        if (await takeDeviceWrite()) {
          await createDeviceEvent(eventInput());
          await onSaved();
          onOpenChange(false);
          return;
        }
        if (!hasConnection) return; // showConnect takes over the dialog body
      }
      // Google path: creates without a device, and edits of Google-sourced
      // events (any event — full charge — not just app-created ones).
      await saveViaGoogle();
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
      if (editing.source === "device") {
        if (await deviceWriteForExisting()) {
          await deleteDeviceEvent(editing.id);
          await onSaved();
          onOpenChange(false);
        }
        return;
      }
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
            {formatDate(startDate, locale)}
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

            {/* When — All-day toggle + Start/End date & time */}
            <div className="space-y-2.5">
              {/* All-day switch */}
              <div className="flex items-center justify-between gap-3">
                <span
                  className="text-[11px] uppercase tracking-wide"
                  style={{ fontFamily: "'Hammersmith One', sans-serif", color: "#5e7983" }}
                >
                  {t("calendar.all_day")}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allDay}
                  aria-label={t("calendar.all_day")}
                  onClick={() => setAllDay((v) => !v)}
                  className="relative shrink-0 w-11 h-6 rounded-full transition-colors"
                  style={{ backgroundColor: allDay ? "#284e72" : "#cdbce8" }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                    style={{ transform: allDay ? "translateX(20px)" : "translateX(0)" }}
                  />
                </button>
              </div>

              {/* Start */}
              <div className="flex items-center gap-2">
                <span
                  className="text-[11px] uppercase tracking-wide w-10 flex-shrink-0"
                  style={{ fontFamily: "'Hammersmith One', sans-serif", color: "#5e7983" }}
                >
                  {t("calendar.start")}
                </span>
                <input
                  type="date"
                  value={startDate}
                  min={todayKey}
                  max={maxDate}
                  onChange={(e) => onStartDateChange(e.target.value)}
                  className="flex-1 min-w-0 h-10 px-2 rounded-xl text-[13px] outline-none"
                  style={inputStyle}
                />
                {!allDay && (
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => onStartTimeChange(e.target.value)}
                    className="w-[94px] flex-shrink-0 h-10 px-2 rounded-xl text-[13px] outline-none"
                    style={inputStyle}
                  />
                )}
              </div>

              {/* End */}
              <div className="flex items-center gap-2">
                <span
                  className="text-[11px] uppercase tracking-wide w-10 flex-shrink-0"
                  style={{ fontFamily: "'Hammersmith One', sans-serif", color: "#5e7983" }}
                >
                  {t("calendar.end")}
                </span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={maxDate}
                  onChange={(e) => {
                    endTouched.current = true;
                    setEndDate(e.target.value);
                  }}
                  className="flex-1 min-w-0 h-10 px-2 rounded-xl text-[13px] outline-none"
                  style={inputStyle}
                />
                {!allDay && (
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => {
                      endTouched.current = true;
                      setEndTime(e.target.value);
                    }}
                    className="w-[94px] flex-shrink-0 h-10 px-2 rounded-xl text-[13px] outline-none"
                    style={inputStyle}
                  />
                )}
              </div>

              {timeError && (
                <p className="text-[11px]" style={{ color: "#c0392b" }}>
                  {t("calendar.end_before_start")}
                </p>
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
              disabled={saving || timeError}
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
