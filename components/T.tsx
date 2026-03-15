"use client";

// T — tiny inline translation component.
// Usage: <T k="some.key" /> renders the translated string for the current language.

import { useLanguage } from "@/contexts/LanguageContext";

export function T({ k }: { k: string }) {
  const { t } = useLanguage();
  return <>{t(k)}</>;
}
