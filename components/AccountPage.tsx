"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearNativeSession } from "@/lib/native-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { LogOut, Loader2, Trash2, AlertTriangle, ShieldCheck, ChevronDown, ChevronUp, ChevronRight, ScrollText, Baby, Languages, Check, Globe, Search, Calendar, Link2, Unlink, WifiOff, Sparkles, HelpCircle } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTimezone } from "@/contexts/TimezoneContext";
import { useToast } from "@/components/ui/use-toast";
import { useOnline } from "@/lib/use-online";
import { useCalendarConnect } from "@/lib/use-calendar-connect";
import {
  useDismissFlag,
  useLocalFlag,
  useLocalNumber,
  GOOGLE_PROMPT_KEY,
  DEVICE_PROMPT_KEY,
  TODAY_FIRST_KEY,
  HOME_DAYS_AHEAD_KEY,
  NOTIFY_MEETINGS_KEY,
  NOTIFY_LEAD_KEY,
} from "@/lib/use-dismiss-flag";
import {
  notificationsSupported,
  ensureNotificationPermission,
  cancelAllMeetingNotifications,
} from "@/lib/meeting-notifications";
import {
  getCachedProfile,
  getCachedConnectionFlag,
  subscribeOffline,
  type CachedProfile,
} from "@/lib/offline-cache";
import { wipeLocalUserData, whenOwnerSettled } from "@/lib/offline-owner";
import { languages, type LanguageCode } from "@/lib/i18n";
import { useAiConsent } from "@/components/AiConsentProvider";
import { useTour } from "@/components/tour/TourProvider";

// Fallback if the WebView lacks Intl.supportedValuesOf (Chrome <99).
const FALLBACK_ZONES = [
  "UTC", "Asia/Seoul", "Asia/Tokyo", "Asia/Shanghai", "Asia/Singapore",
  "Asia/Kolkata", "Europe/London", "Europe/Paris", "Europe/Berlin",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Australia/Sydney",
];

export function AccountPage() {
  const router = useRouter();
  const supabase = createClient();
  const online = useOnline();
  const { toast } = useToast();
  const { language, setLanguage, t } = useLanguage();
  const { timezone, mode: tzMode, value: tzValue, setMode: setTzMode, setTimezone } = useTimezone();
  const { consented: aiConsented, revokeConsent } = useAiConsent();
  const { startTour } = useTour();
  const [revokingConsent, setRevokingConsent] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [savingLang, setSavingLang] = useState(false);
  const [tzOpen, setTzOpen] = useState(false);
  const [tzQuery, setTzQuery] = useState("");

  // Calendar settings
  const { connect, connecting } = useCalendarConnect();
  const { dismissed: googleDismissed, setDismissed: setGoogleDismissed } =
    useDismissFlag(GOOGLE_PROMPT_KEY);
  const { dismissed: deviceDismissed, setDismissed: setDeviceDismissed } =
    useDismissFlag(DEVICE_PROMPT_KEY);
  // Calendar screen order: selected day pinned above "Upcoming" (default ON).
  const { on: todayFirst, setOn: setTodayFirst } = useLocalFlag(
    TODAY_FIRST_KEY,
    true
  );
  const [calOpen, setCalOpen] = useState(false);
  const [isNative, setIsNative] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  // Home banner window + pre-meeting notification prefs (device-local).
  const { value: daysAhead, setValue: setDaysAhead } = useLocalNumber(
    HOME_DAYS_AHEAD_KEY,
    7
  );
  const { on: notifyOn, setOn: setNotifyOn } = useLocalFlag(NOTIFY_MEETINGS_KEY);
  const { value: leadMin, setValue: setLeadMin } = useLocalNumber(
    NOTIFY_LEAD_KEY,
    30
  );
  // Whether THIS build ships the LocalNotifications plugin (new native builds
  // only — old installs show the toggle disabled with an update hint).
  const [notifSupported, setNotifSupported] = useState(false);
  // Reflect a disconnect immediately. The connection prop is server-rendered and
  // the service worker caches that RSC (StaleWhileRevalidate), so router.refresh()
  // alone can keep showing "Connected" until a later load — this override flips
  // the UI optimistically so Disconnect never looks like a no-op.
  const [connectedOverride, setConnectedOverride] = useState<boolean | null>(null);

  // Profile + calendar-connection flag are read from the local store so the page
  // renders offline (seeded by the online home load). subscribeOffline keeps them
  // fresh after a sync.
  const [profile, setProfile] = useState<CachedProfile | null>(null);
  const [cachedConnection, setCachedConnection] = useState(false);
  useEffect(() => {
    const load = async () => {
      // If an account-switch wipe is in flight (owner gate), read after it —
      // never render the previous account's cached email/name.
      await whenOwnerSettled();
      setProfile(await getCachedProfile());
      setCachedConnection((await getCachedConnectionFlag()) ?? false);
    };
    void load();
    return subscribeOffline(load);
  }, []);

  const connected = connectedOverride ?? cachedConnection;

  useEffect(() => {
    import("@capacitor/core")
      .then(({ Capacitor }) => setIsNative(Capacitor.isNativePlatform()))
      .catch(() => {});
    void notificationsSupported().then(setNotifSupported);
  }, []);

  async function handleNotifyToggle() {
    if (notifyOn) {
      setNotifyOn(false);
      void cancelAllMeetingNotifications();
      return;
    }
    const granted = await ensureNotificationPermission();
    if (!granted) {
      toast({
        title: t("calendar.notify_toggle"),
        description: t("calendar.notify_denied"),
        variant: "destructive",
      });
      return;
    }
    setNotifyOn(true);
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/calendar/events", { method: "DELETE" });
      setConnectedOverride(false); // flip the UI now, don't wait on the cached RSC
    } catch {
      /* ignore — router.refresh reflects the actual state */
    } finally {
      setDisconnecting(false);
      router.refresh();
    }
  }

  const allZones = useMemo<string[]>(() => {
    try {
      const supported = (Intl as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
      if (typeof supported === "function") return supported("timeZone");
    } catch {
      // fall through
    }
    return FALLBACK_ZONES;
  }, []);

  const filteredZones = useMemo(() => {
    const q = tzQuery.trim().toLowerCase();
    if (!q) return allZones;
    return allZones.filter((z) => z.toLowerCase().replace(/_/g, " ").includes(q.replace(/_/g, " ")));
  }, [allZones, tzQuery]);

  const autoOn = tzMode === "auto";

  async function handleLanguageChange(code: LanguageCode) {
    if (code === language) { setLangOpen(false); return; }
    setSavingLang(true);
    await setLanguage(code);
    setSavingLang(false);
    setLangOpen(false);
  }

  const ko = language === "ko";
  const displayName = profile?.full_name ?? profile?.email ?? "User";

  async function handleSignOut() {
    setSigningOut(true);
    // Scrub this account's device-local data (IndexedDB people/outbox/profile,
    // native snapshot, SW page caches) so the next sign-in — possibly a
    // different account — inherits nothing. Best-effort: a failed wipe must
    // never block sign-out (the owner gate re-checks on next login anyway).
    try {
      await wipeLocalUserData();
    } catch {
      /* best-effort */
    }
    await supabase.auth.signOut();
    await clearNativeSession();
    // HARD navigation, not router.push: a soft nav keeps the whole client
    // runtime (router cache, module state, mounted data) alive across the
    // identity change — the next user could be served this user's screens.
    window.location.assign("/login");
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteFailed(false);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) throw new Error(`delete failed (${res.status})`);
      // The server account is gone — remove every local trace before leaving
      // (IndexedDB + native snapshot + SW page caches).
      try {
        await wipeLocalUserData();
      } catch {
        /* best-effort */
      }
      try {
        await clearNativeSession();
      } catch {
        /* best-effort */
      }
      // Local-only sign-out: the default (global) variant calls the server
      // with a session that no longer exists and would error.
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        /* ignore */
      }
      // Hard navigation — see handleSignOut.
      window.location.assign("/login");
    } catch {
      setDeleting(false);
      setDeleteFailed(true);
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-5">

      {/* Profile card */}
      <div
        className="p-5 rounded-[10px_2px_10px_2px]"
        style={{ background: "linear-gradient(52deg, #d0f2ff 0%, #dccaff 100%)" }}
      >
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 shrink-0">
            <AvatarFallback
              className="text-xl font-bold text-white"
              style={{ background: "linear-gradient(135deg, #284e72, #482d7c)" }}
            >
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p
              className="text-[22px] leading-tight text-black truncate"
              style={{ fontFamily: "'Hammersmith One', sans-serif" }}
            >
              {displayName}
            </p>
            <p className="text-[13px] mt-0.5 truncate" style={{ color: "#5e7983" }}>
              {profile?.email}
            </p>
          </div>
        </div>
      </div>

      {/* Settings — Language */}
      <div
        className="rounded-[10px_2px_10px_2px] border overflow-hidden"
        style={{ borderColor: "#dccaff", backgroundColor: "#f5f0ff" }}
      >
        <button
          onClick={() => setLangOpen((o) => !o)}
          className="flex items-center justify-between w-full h-11 px-4 text-sm transition-opacity active:opacity-80"
          style={{ color: "#284e72" }}
        >
          <span className="flex items-center gap-3">
            <Languages className="w-4 h-4 shrink-0" />
            {t("account.language")}
          </span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {languages.find((l) => l.code === language)?.nativeName}
            </span>
            {langOpen ? (
              <ChevronUp className="w-4 h-4 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 shrink-0" />
            )}
          </span>
        </button>

        {langOpen && (
          <div
            className="border-t px-4 py-3 grid grid-cols-2 gap-2"
            style={{ borderColor: "#dccaff" }}
          >
            {languages.map((lang) => {
              const isSelected = lang.code === language;
              return (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  disabled={savingLang}
                  className="relative flex items-center gap-2 p-2.5 rounded-[8px_2px_8px_2px] border text-left transition-all active:opacity-80 disabled:opacity-60"
                  style={{
                    borderColor: isSelected ? "#284e72" : "#dccaff",
                    backgroundColor: isSelected ? "#e8f4ff" : "white",
                  }}
                >
                  <span className="text-base leading-none">{lang.flag}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 leading-tight truncate">
                      {lang.nativeName}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{lang.name}</p>
                  </div>
                  {isSelected && (
                    <Check
                      className="absolute right-1.5 top-1.5 w-3 h-3 shrink-0"
                      style={{ color: "#284e72" }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Settings — Timezone */}
      <div
        className="rounded-[10px_2px_10px_2px] border overflow-hidden"
        style={{ borderColor: "#dccaff", backgroundColor: "#f5f0ff" }}
      >
        <button
          onClick={() => setTzOpen((o) => !o)}
          className="flex items-center justify-between w-full h-11 px-4 text-sm transition-opacity active:opacity-80"
          style={{ color: "#284e72" }}
        >
          <span className="flex items-center gap-3">
            <Globe className="w-4 h-4 shrink-0" />
            {t("account.timezone")}
          </span>
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
              {timezone.replace(/_/g, " ")}
              {autoOn ? ` · ${t("timezone.auto_short")}` : ""}
            </span>
            {tzOpen ? (
              <ChevronUp className="w-4 h-4 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 shrink-0" />
            )}
          </span>
        </button>

        {tzOpen && (
          <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: "#dccaff" }}>
            {/* Auto toggle */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: "#284e72" }}>
                  {t("timezone.auto")}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "#5e7983" }}>
                  {t("timezone.auto_hint")}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoOn}
                aria-label={t("timezone.auto")}
                onClick={() => setTzMode(autoOn ? "manual" : "auto")}
                className="relative shrink-0 w-11 h-6 rounded-full transition-colors"
                style={{ backgroundColor: autoOn ? "#284e72" : "#cdbce8" }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                  style={{ transform: autoOn ? "translateX(20px)" : "translateX(0)" }}
                />
              </button>
            </div>

            {/* Searchable list — dimmed/disabled when Auto is on */}
            <div
              className={autoOn ? "opacity-50 pointer-events-none select-none" : ""}
              aria-disabled={autoOn}
            >
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: "#5e7983" }}
                />
                <input
                  type="text"
                  value={tzQuery}
                  onChange={(e) => setTzQuery(e.target.value)}
                  disabled={autoOn}
                  placeholder={t("timezone.search_placeholder")}
                  className="w-full h-10 pl-9 pr-3 text-sm rounded-[8px_2px_8px_2px] border outline-none"
                  style={{ borderColor: "#dccaff", backgroundColor: "white", color: "#284e72" }}
                />
              </div>

              <div className="mt-2 max-h-56 overflow-y-auto rounded-[8px_2px_8px_2px] border" style={{ borderColor: "#dccaff" }}>
                {filteredZones.length === 0 ? (
                  <p className="text-[12px] px-3 py-3" style={{ color: "#5e7983" }}>
                    {t("timezone.none_found")}
                  </p>
                ) : (
                  filteredZones.map((zone) => {
                    const isSelected = !autoOn && (tzValue ?? timezone) === zone;
                    return (
                      <button
                        key={zone}
                        type="button"
                        disabled={autoOn}
                        onClick={() => {
                          setTimezone(zone);
                          setTzOpen(false);
                        }}
                        className="flex items-center justify-between w-full px-3 py-2 text-left text-[13px] transition-colors active:opacity-80"
                        style={{
                          color: "#284e72",
                          backgroundColor: isSelected ? "#e8f4ff" : "white",
                        }}
                      >
                        <span className="truncate">{zone.replace(/_/g, " ")}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#284e72" }} />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings — Calendar */}
      <div
        className="rounded-[10px_2px_10px_2px] border overflow-hidden"
        style={{ borderColor: "#dccaff", backgroundColor: "#f5f0ff" }}
      >
        <button
          onClick={() => setCalOpen((o) => !o)}
          className="flex items-center justify-between w-full h-11 px-4 text-sm transition-opacity active:opacity-80"
          style={{ color: "#284e72" }}
        >
          <span className="flex items-center gap-3">
            <Calendar className="w-4 h-4 shrink-0" />
            {t("account.calendar")}
          </span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {connected ? t("calendar.connected") : t("calendar.not_connected")}
            </span>
            {calOpen ? (
              <ChevronUp className="w-4 h-4 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 shrink-0" />
            )}
          </span>
        </button>

        {calOpen && (
          <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: "#dccaff" }}>
            {!online && (
              <p className="flex items-center gap-2 text-[12px]" style={{ color: "#5e7983" }}>
                <WifiOff className="w-3.5 h-3.5 shrink-0" />
                {ko ? "캘린더 연결은 인터넷이 필요해요" : "Calendar changes need a connection"}
              </p>
            )}
            {/* Connection status + primary action */}
            {connected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting || !online}
                className="flex items-center justify-center gap-2 w-full h-10 rounded-[8px_2px_8px_2px] text-sm font-medium border transition-opacity active:opacity-80 disabled:opacity-60"
                style={{ borderColor: "#dccaff", color: "#284e72", backgroundColor: "white" }}
              >
                {disconnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlink className="w-4 h-4" />
                )}
                {disconnecting ? t("calendar.disconnecting") : t("calendar.disconnect")}
              </button>
            ) : (
              <button
                type="button"
                onClick={connect}
                disabled={connecting || !online}
                className="flex items-center justify-center gap-2 w-full h-10 rounded-[8px_2px_8px_2px] text-sm font-medium text-white transition-opacity active:opacity-80 disabled:opacity-60"
                style={{ background: "linear-gradient(90deg, #5e7983, #9b7fda)" }}
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                {t("calendar.connect")}
              </button>
            )}

            {/* Re-show the Google connect prompt — only relevant while not connected */}
            {!connected && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: "#284e72" }}>
                    {t("calendar.show_google_prompt")}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#5e7983" }}>
                    {t("calendar.show_google_prompt_hint")}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!googleDismissed}
                  aria-label={t("calendar.show_google_prompt")}
                  onClick={() => setGoogleDismissed(!googleDismissed)}
                  className="relative shrink-0 w-11 h-6 rounded-full transition-colors"
                  style={{ backgroundColor: !googleDismissed ? "#284e72" : "#cdbce8" }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                    style={{ transform: !googleDismissed ? "translateX(20px)" : "translateX(0)" }}
                  />
                </button>
              </div>
            )}

            {/* Re-show the phone calendar prompt — native only */}
            {isNative && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: "#284e72" }}>
                    {t("calendar.show_phone_prompt")}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#5e7983" }}>
                    {t("calendar.show_phone_prompt_hint")}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!deviceDismissed}
                  aria-label={t("calendar.show_phone_prompt")}
                  onClick={() => setDeviceDismissed(!deviceDismissed)}
                  className="relative shrink-0 w-11 h-6 rounded-full transition-colors"
                  style={{ backgroundColor: !deviceDismissed ? "#284e72" : "#cdbce8" }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                    style={{ transform: !deviceDismissed ? "translateX(20px)" : "translateX(0)" }}
                  />
                </button>
              </div>
            )}

            {/* Calendar order: selected day above Upcoming (works without
                Google too — past meetings reorder the same way) */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: "#284e72" }}>
                  {t("calendar.today_first")}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "#5e7983" }}>
                  {t("calendar.today_first_hint")}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={todayFirst}
                aria-label={t("calendar.today_first")}
                onClick={() => setTodayFirst(!todayFirst)}
                className="relative shrink-0 w-11 h-6 rounded-full transition-colors"
                style={{ backgroundColor: todayFirst ? "#284e72" : "#cdbce8" }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                  style={{ transform: todayFirst ? "translateX(20px)" : "translateX(0)" }}
                />
              </button>
            </div>

            {/* Home banner window: how many days ahead of meetings to show */}
            <div>
              <p className="text-sm font-medium" style={{ color: "#284e72" }}>
                {t("calendar.days_ahead")}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "#5e7983" }}>
                {t("calendar.days_ahead_hint")}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {[1, 3, 7, 14, 31].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDaysAhead(d)}
                    className="h-8 px-3 text-[12px] rounded-[8px_2px_8px_2px] transition-opacity active:opacity-80"
                    style={
                      daysAhead === d
                        ? {
                            background: "linear-gradient(to right, #284e72, #482d7c)",
                            color: "#ffffff",
                          }
                        : {
                            backgroundColor: "#f0e8ff",
                            border: "1px solid #dccaff",
                            color: "#284e72",
                          }
                    }
                  >
                    {t(`calendar.days_${d}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Pre-meeting phone notification — native only. On builds without
                the LocalNotifications plugin the toggle is disabled with an
                update hint (this web bundle also serves old installs). */}
            {isNative && (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium" style={{ color: "#284e72" }}>
                      {t("calendar.notify_toggle")}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "#5e7983" }}>
                      {notifSupported
                        ? t("calendar.notify_toggle_hint")
                        : t("calendar.notify_requires_update")}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifyOn && notifSupported}
                    aria-label={t("calendar.notify_toggle")}
                    onClick={handleNotifyToggle}
                    disabled={!notifSupported}
                    className="relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor:
                        notifyOn && notifSupported ? "#284e72" : "#cdbce8",
                    }}
                  >
                    <span
                      className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                      style={{
                        transform:
                          notifyOn && notifSupported
                            ? "translateX(20px)"
                            : "translateX(0)",
                      }}
                    />
                  </button>
                </div>
                {notifyOn && notifSupported && (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-[11px]" style={{ color: "#5e7983" }}>
                      {t("calendar.notify_lead")}
                    </span>
                    {[10, 30, 60].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setLeadMin(m)}
                        className="h-8 px-3 text-[12px] rounded-[8px_2px_8px_2px] transition-opacity active:opacity-80"
                        style={
                          leadMin === m
                            ? {
                                background:
                                  "linear-gradient(to right, #284e72, #482d7c)",
                                color: "#ffffff",
                              }
                            : {
                                backgroundColor: "#f0e8ff",
                                border: "1px solid #dccaff",
                                color: "#284e72",
                              }
                        }
                      >
                        {t(`calendar.lead_${m}`)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sign out */}
      <div
        className="p-4 rounded-[10px_2px_10px_2px]"
        style={{ backgroundColor: "#f5f0ff", border: "1px solid #dccaff" }}
      >
        <p
          className="text-[13px] uppercase mb-3"
          style={{ color: "#665b7b", fontFamily: "'Hammersmith One', sans-serif" }}
        >
          {t("account.session")}
        </p>
        <button
          onClick={handleSignOut}
          disabled={signingOut || !online}
          className="flex items-center gap-3 w-full h-11 px-4 rounded-[8px_2px_8px_2px] text-sm font-medium text-white transition-opacity active:opacity-80 disabled:opacity-60"
          style={{ background: "linear-gradient(to right, #284e72, #482d7c)" }}
        >
          {signingOut ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          {signingOut ? t("account.signing_out") : t("account.sign_out")}
        </button>
        {!online && (
          <p className="flex items-center gap-2 text-[12px] mt-2" style={{ color: "#5e7983" }}>
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            {ko ? "오프라인에서는 로그아웃할 수 없어요" : "Signing out needs a connection"}
          </p>
        )}
      </div>

      {/* How to use this app — replays the first-open tour */}
      <div
        className="rounded-[10px_2px_10px_2px] border overflow-hidden"
        style={{ borderColor: "#dccaff", backgroundColor: "#f5f0ff" }}
      >
        <button
          type="button"
          onClick={() => startTour()}
          data-tour="account-help"
          className="flex items-center justify-between w-full h-11 px-4 text-sm transition-opacity active:opacity-80"
          style={{ color: "#284e72" }}
        >
          <span className="flex items-center gap-3">
            <HelpCircle className="w-4 h-4 shrink-0" />
            {t("account.how_to_use")}
          </span>
          <ChevronRight className="w-4 h-4 shrink-0" />
        </button>
      </div>

      {/* Policy */}
      <div
        className="rounded-[10px_2px_10px_2px] border overflow-hidden"
        style={{ borderColor: "#dccaff", backgroundColor: "#f5f0ff" }}
      >
        <button
          onClick={() => setPolicyOpen((o) => !o)}
          className="flex items-center justify-between w-full h-11 px-4 text-sm transition-opacity active:opacity-80"
          style={{ color: "#284e72" }}
        >
          <span className="flex items-center gap-3">
            <ScrollText className="w-4 h-4 shrink-0" />
            {t("account.policy")}
          </span>
          {policyOpen ? (
            <ChevronUp className="w-4 h-4 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 shrink-0" />
          )}
        </button>

        {policyOpen && (
          <div
            className="border-t px-4 py-3 space-y-2"
            style={{ borderColor: "#dccaff" }}
          >
            <Link
              href="/privacy"
              className="flex items-center gap-3 w-full h-10 px-3 rounded-[8px_2px_8px_2px] text-sm border transition-opacity active:opacity-80"
              style={{ borderColor: "#dccaff", color: "#284e72", backgroundColor: "white" }}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              {t("account.privacy_policy")}
            </Link>
            <Link
              href="/child-safety"
              className="flex items-center gap-3 w-full h-10 px-3 rounded-[8px_2px_8px_2px] text-sm border transition-opacity active:opacity-80"
              style={{ borderColor: "#dccaff", color: "#284e72", backgroundColor: "white" }}
            >
              <Baby className="w-4 h-4 shrink-0" />
              {t("account.child_safety")}
            </Link>
          </div>
        )}
      </div>

      {/* AI processing consent (App Store 5.1.2(i)) — disclosure of the Gemini
          data flow + the in-app way to withdraw consent that the privacy policy
          promises. When withdrawn, the AI routes hard-block until re-consented. */}
      <div
        className="p-4 rounded-[10px_2px_10px_2px]"
        style={{ backgroundColor: "#f5f0ff", border: "1px solid #dccaff" }}
      >
        <p
          className="text-[13px] uppercase mb-2 flex items-center gap-2"
          style={{ color: "#665b7b", fontFamily: "'Hammersmith One', sans-serif" }}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          {t("consent.account_title")}
        </p>
        <p className="text-[12px] leading-relaxed mb-3" style={{ color: "#5e7983" }}>
          {aiConsented ? t("consent.account_on") : t("consent.account_off")}
        </p>
        {aiConsented && (
          <button
            type="button"
            onClick={async () => {
              setRevokingConsent(true);
              try {
                await revokeConsent();
                toast({ title: t("consent.revoked_toast") });
              } catch {
                toast({ title: t("meet.something_wrong"), variant: "destructive" });
              } finally {
                setRevokingConsent(false);
              }
            }}
            disabled={revokingConsent || !online}
            className="flex items-center justify-center gap-2 w-full h-10 rounded-[8px_2px_8px_2px] text-sm font-medium border transition-opacity active:opacity-80 disabled:opacity-60"
            style={{ borderColor: "#dccaff", color: "#284e72", backgroundColor: "white" }}
          >
            {revokingConsent && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("consent.revoke")}
          </button>
        )}
      </div>

      {/* Account deletion — in-app and immediate (App Store guideline 5.1.1(v)
          and Play's data-deletion policy both require the user to be able to
          initiate full deletion from inside the app, not via email).
          Placed last so the destructive action sits at the bottom of the page. */}
      <div
        className="p-4 rounded-[10px_2px_10px_2px]"
        style={{ backgroundColor: "#fdf3f2", border: "1px solid #f3cdc9" }}
      >
        <p
          className="text-[13px] uppercase mb-3"
          style={{ color: "#9c4238", fontFamily: "'Hammersmith One', sans-serif" }}
        >
          {t("account.delete_account")}
        </p>

        <div className="space-y-3 text-sm">
          <p className="leading-relaxed text-[13px]" style={{ color: "#7a544e" }}>
            {t("account.delete_description")}
          </p>

          <div
            className="flex items-start gap-2 p-3 rounded-lg"
            style={{ backgroundColor: "rgba(243,205,201,0.35)" }}
          >
            <Trash2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#9c4238" }} />
            <p className="text-[12px]" style={{ color: "#9c4238" }}>
              {t("account.delete_data_note")}
            </p>
          </div>

          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => {
                setConfirmingDelete(true);
                setDeleteFailed(false);
              }}
              disabled={!online}
              className="flex items-center justify-center gap-2 w-full h-11 rounded-[8px_2px_8px_2px] text-sm font-medium border transition-opacity active:opacity-80 disabled:opacity-60"
              style={{ borderColor: "#e7a39b", color: "#b42318", backgroundColor: "white" }}
            >
              <Trash2 className="w-4 h-4" />
              {t("account.delete_button")}
            </button>
          ) : (
            <div
              className="space-y-3 p-3 rounded-[8px_2px_8px_2px] border"
              style={{ borderColor: "#e7a39b", backgroundColor: "white" }}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#b42318" }} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "#b42318" }}>
                    {t("account.delete_confirm_title")}
                  </p>
                  <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "#7a544e" }}>
                    {t("account.delete_confirm_body")}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="flex-1 h-10 rounded-[8px_2px_8px_2px] text-sm font-medium border transition-opacity active:opacity-80 disabled:opacity-60"
                  style={{ borderColor: "#dccaff", color: "#284e72", backgroundColor: "white" }}
                >
                  {t("account.delete_cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleting || !online}
                  className="flex-1 flex items-center justify-center gap-2 h-10 rounded-[8px_2px_8px_2px] text-sm font-medium text-white transition-opacity active:opacity-80 disabled:opacity-60"
                  style={{ backgroundColor: "#b42318" }}
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {deleting ? t("account.deleting") : t("account.delete_confirm_yes")}
                </button>
              </div>
            </div>
          )}

          {deleteFailed && (
            <p className="text-[12px]" style={{ color: "#b42318" }}>
              {t("account.delete_failed")}
            </p>
          )}

          {!online && (
            <p className="flex items-center gap-2 text-[12px]" style={{ color: "#5e7983" }}>
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              {t("account.delete_offline")}
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
