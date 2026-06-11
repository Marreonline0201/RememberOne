"use client";

// Per-device boolean flags kept in localStorage. localStorage is synchronous
// and offline-durable (survives reloads with no network and is untouched by
// the Serwist service worker), which matters in this offline-first app — a
// metadata write via supabase.auth.updateUser would be lost when set offline.
// These flags are intentionally device-local: prompt dismissals are about THIS
// phone, and display preferences follow the same pattern.

import { useCallback, useEffect, useState } from "react";

export const GOOGLE_PROMPT_KEY = "ro.cal.googlePromptDismissed";
export const DEVICE_PROMPT_KEY = "ro.cal.devicePromptDismissed";
// Calendar screen order: selected day (default today) directly below the grid,
// above "Upcoming Meetings". Default ON — absent key means enabled.
export const TODAY_FIRST_KEY = "ro.cal.todayFirst";

// Generic on/off flag. `defaultOn` applies pre-hydration AND when the key has
// never been written ("1"/"0" once set, so an explicit off survives).
export function useLocalFlag(key: string, defaultOn = false) {
  const [on, setVal] = useState(defaultOn);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      setVal(raw === null ? defaultOn : raw === "1");
    } catch {
      /* localStorage unavailable — keep the default */
    }
    setHydrated(true);
  }, [key, defaultOn]);

  const setOn = useCallback(
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

  return { on, setOn, hydrated };
}

// Dismiss-flavored alias used by the calendar-screen prompts. SSR-safe default
// is "not dismissed"; `hydrated` lets callers hold off rendering a prompt until
// localStorage was read, avoiding a one-frame flash of a dismissed banner.
export function useDismissFlag(key: string) {
  const { on, setOn, hydrated } = useLocalFlag(key, false);
  return { dismissed: on, setDismissed: setOn, hydrated };
}
