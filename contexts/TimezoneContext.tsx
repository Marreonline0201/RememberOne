"use client";

// Per-user timezone preference, mirroring LanguageContext.
// - mode "auto"  → use the device's timezone (resolved client-side)
// - mode "manual" → use the explicitly chosen IANA zone (`value`)
// Persisted to Supabase user metadata as { tz_mode, tz_value }.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { createClient } from "@/lib/supabase/client";

export type TimezoneMode = "auto" | "manual";

interface TimezoneContextType {
  /** Effective IANA timezone to format with (resolved from mode). */
  timezone: string;
  mode: TimezoneMode;
  /** Device timezone detected on the client (null until mounted). */
  autoTimezone: string | null;
  /** The manually-chosen zone (used when mode === "manual"). */
  value: string | null;
  setMode: (mode: TimezoneMode) => Promise<void>;
  setTimezone: (tz: string) => Promise<void>;
}

const FALLBACK_TZ = "UTC";

const TimezoneContext = createContext<TimezoneContextType>({
  timezone: FALLBACK_TZ,
  mode: "auto",
  autoTimezone: null,
  value: null,
  setMode: async () => {},
  setTimezone: async () => {},
});

export function useTimezone() {
  return useContext(TimezoneContext);
}

function detectDeviceTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function TimezoneProvider({
  children,
  initialMode,
  initialValue,
}: {
  children: React.ReactNode;
  initialMode: string | null;
  initialValue: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setModeState] = useState<TimezoneMode>(
    initialMode === "manual" ? "manual" : "auto"
  );
  const [value, setValueState] = useState<string | null>(initialValue);
  const [autoTimezone, setAutoTimezone] = useState<string | null>(null);

  // The device zone can only be read on the client.
  useEffect(() => {
    setAutoTimezone(detectDeviceTimezone());
  }, []);

  const timezone =
    mode === "manual"
      ? value ?? autoTimezone ?? FALLBACK_TZ
      : autoTimezone ?? value ?? FALLBACK_TZ;

  // Persist to the server only when online — offline updateUser would hang/reject
  // and nothing queues it; the choice still applies locally for this session.
  const persistTz = useCallback(
    async (data: { tz_mode: string; tz_value: string | null }) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      try {
        await supabase.auth.updateUser({ data });
      } catch {
        /* transient — local state already updated */
      }
    },
    [supabase]
  );

  const setMode = useCallback(
    async (next: TimezoneMode) => {
      setModeState(next);
      // When switching to manual without a prior choice, seed with the current
      // effective zone so the picker starts on something sensible.
      let nextValue = value;
      if (next === "manual" && !nextValue) {
        nextValue = autoTimezone ?? FALLBACK_TZ;
        setValueState(nextValue);
      }
      await persistTz({ tz_mode: next, tz_value: nextValue });
    },
    [value, autoTimezone, persistTz]
  );

  const setTimezone = useCallback(
    async (tz: string) => {
      setValueState(tz);
      setModeState("manual");
      await persistTz({ tz_mode: "manual", tz_value: tz });
    },
    [persistTz]
  );

  // Memoize so timezone-aware consumers (CalendarView, formatters) don't
  // re-render on every unrelated parent render.
  const contextValue = useMemo(
    () => ({ timezone, mode, autoTimezone, value, setMode, setTimezone }),
    [timezone, mode, autoTimezone, value, setMode, setTimezone]
  );

  return (
    <TimezoneContext.Provider value={contextValue}>
      {children}
    </TimezoneContext.Provider>
  );
}
