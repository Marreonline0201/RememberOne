"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearNativeSession } from "@/lib/native-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { LogOut, Loader2, Trash2, Mail, ShieldCheck, ChevronDown, ChevronUp, ScrollText, Baby, Languages, Check } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { languages, type LanguageCode } from "@/lib/i18n";

interface Props {
  user: SupabaseUser;
}

export function AccountPage({ user }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const { language, setLanguage, t } = useLanguage();
  const [signingOut, setSigningOut] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [savingLang, setSavingLang] = useState(false);

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
