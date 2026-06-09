"use client";

// Per-device "dismissed" flags for the calendar-screen prompts, kept in
// localStorage. localStorage is synchronous and offline-durable (survives
// reloads with no network and is untouched by the Serwist service worker),
// which matters in this offline-first app — a metadata write via
// supabase.auth.updateUser would be lost when dismissed offline. These flags
// are intentionally device-local (the phone-calendar prompt is about THIS
// phone, and the Google connect banner only ever shows while not connected).

import { useCallback, useEffect, useState } from "react";

export const GOOGLE_PROMPT_KEY = "ro.cal.googlePromptDismissed";
export const DEVICE_PROMPT_KEY = "ro.cal.devicePromptDismissed";

export function useDismissFlag(key: string) {
  // SSR-safe default: assume "not dismissed" until we've read localStorage on
  // the client. `hydrated` lets callers hold off rendering a prompt until then,
  // avoiding a one-frame flash of an already-dismissed banner.
  const [dismissed, setVal] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setVal(localStorage.getItem(key) === "1");
    } catch {
      /* localStorage unavailable — treat as not dismissed */
    }
    setHydrated(true);
  }, [key]);

  const setDismissed = useCallback(
    (v: boolean) => {
      setVal(v);
      try {
        localStorage.setItem(key, v ? "1" : "0");
      } catch {
        /* ignore write failures */
      }
    },
    [key]
  );

  return { dismissed, setDismissed, hydrated };
}
