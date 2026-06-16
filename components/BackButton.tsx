"use client";

// Shared top-of-page "back" affordance for subpages (person detail, policy
// pages) that otherwise rely only on the system/hardware back button.
//
// Goes to the REAL previous screen (router.back) so it returns wherever the user
// came from — home, calendar, account — preserving their scroll/state. Falls
// back to `fallbackHref` when there's no in-app history (a deep link, or a
// public visit to /privacy or /account-deletion from a store listing).
//
// `label` is required on pages OUTSIDE the dashboard's LanguageProvider (the
// policy pages): there, useLanguage() yields the default context whose t()
// returns the key, so the caller passes an already-translated string instead.

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function BackButton({
  fallbackHref = "/",
  label,
  className,
}: {
  fallbackHref?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const text = label ?? t("common.back");

  const handleBack = () => {
    // history.length > 1 means there's an in-app entry to return to. In the
    // long-lived Capacitor webview this is reliably true for any screen the user
    // navigated to; === 1 only for a fresh deep link / public page open.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={text}
      className={
        className ??
        "inline-flex items-center gap-1 -ml-1 px-1 h-9 text-sm transition-opacity active:opacity-70 hover:opacity-70"
      }
      style={{ color: "#284e72" }}
    >
      <ArrowLeft className="w-4 h-4 shrink-0" />
      {text}
    </button>
  );
}
