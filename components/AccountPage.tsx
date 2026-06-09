"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearNativeSession } from "@/lib/native-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { LogOut, Loader2, Trash2, Mail, ShieldCheck, ChevronDown, ChevronUp, ScrollText, Baby, Languages, Check, Globe, Search, Calendar, Link2, Unlink } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTimezone } from "@/contexts/TimezoneContext";
import { useCalendarConnect } from "@/lib/use-calendar-connect";
import { useDismissFlag, GOOGLE_PROMPT_KEY, DEVICE_PROMPT_KEY } from "@/lib/use-dismiss-flag";
import { languages, type LanguageCode } from "@/lib/i18n";

// Fallback if the WebView lacks Intl.supportedValuesOf (Chrome <99).
const FALLBACK_ZONES = [
  "UTC", "Asia/Seoul", "Asia/Tokyo", "Asia/Shanghai", "Asia/Singapore",
  "Asia/Kolkata", "Europe/London", "Europe/Paris", "Europe/Berlin",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Australia/Sydney",
];

interface Props {
  user: SupabaseUser;
  hasCalendarConnection: boolean;
}

export function AccountPage({ user, hasCalendarConnection }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const { language, setLanguage, t } = useLanguage();
  const { timezone, mode: tzMode, value: tzValue, setMode: setTzMode, setTimezone } = useTimezone();
  const [signingOut, setSigningOut] = useState(false);
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
  const [calOpen, setCalOpen] = useState(false);
  const [isNative, setIsNative] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  // Reflect a disconnect immediately. The connection prop is server-rendered and
  // the service worker caches that RSC (StaleWhileRevalidate), so router.refresh()
  // alone can keep showing "Connected" until a later load — this override flips
  // the UI optimistically so Disconnect never looks like a no-op.
  const [connectedOverride, setConnectedOverride] = useState<boolean | null>(null);
  const connected = connectedOverride ?? hasCalendarConnection;

  useEffect(() => {
    import("@capacitor/core")
      .then(({ Capacitor }) => setIsNative(Capacitor.isNativePlatform()))
      .catch(() => {});
  }, []);

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

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "User";

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    await clearNativeSession();
    router.push("/login");
    router.refresh();
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
              {user.email}
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
            {/* Connection status + primary action */}
            {connected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
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
                disabled={connecting}
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
          disabled={signingOut}
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
      </div>

      {/* Account deletion */}
      <div
        className="p-4 rounded-[10px_2px_10px_2px]"
        style={{ backgroundColor: "#f5f0ff", border: "1px solid #dccaff" }}
      >
        <p
          className="text-[13px] uppercase mb-3"
          style={{ color: "#665b7b", fontFamily: "'Hammersmith One', sans-serif" }}
        >
          {t("account.delete_account")}
        </p>

        <div className="space-y-3 text-sm" style={{ color: "#284e72" }}>
          <p className="leading-relaxed text-[13px]" style={{ color: "#5e7983" }}>
            {t("account.delete_description")}
          </p>

          <ol className="space-y-2.5">
            {([
              t("account.delete_step1"),
              t("account.delete_step2"),
              t("account.delete_step3"),
              t("account.delete_step4"),
              t("account.delete_step5"),
            ]).map((step, i) => (
              <li key={i} className="flex gap-3 text-[13px]" style={{ color: "#5e7983" }}>
                <span
                  className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                  style={{ backgroundColor: "#284e72" }}
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          <a
            href="mailto:comgamemarre@gmail.com"
            className="flex items-center gap-2 mt-3 h-11 px-4 rounded-[8px_2px_8px_2px] text-sm font-medium border transition-opacity active:opacity-80"
            style={{ borderColor: "#dccaff", color: "#284e72", backgroundColor: "white" }}
          >
            <Mail className="w-4 h-4" />
            comgamemarre@gmail.com
          </a>

          <p className="text-[11px] pt-1" style={{ color: "#5e7983" }}>
            {t("account.delete_note")}
          </p>
        </div>

        <div className="mt-4 flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: "rgba(220,202,255,0.4)" }}>
          <Trash2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#665b7b" }} />
          <p className="text-[12px]" style={{ color: "#665b7b" }}>
            {t("account.delete_data_note")}
          </p>
        </div>
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

    </div>
  );
}
