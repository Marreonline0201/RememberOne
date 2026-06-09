"use client";

// RecapLine — render a one-sentence meeting summary in the user's currently
// selected app language. Summaries are stored verbatim from extraction time
// (whatever language Gemini wrote them in), so when the user toggles the
// language we translate on-the-fly via /api/ai/translate-summary and cache
// the result in localStorage. Same text + same target → 0 calls after the
// first one.

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  summary: string;
  className?: string;
  style?: React.CSSProperties;
}

// Hangul detection: if any Hangul syllable codepoint appears, treat the text
// as Korean. Otherwise default to English. Good enough for ko/en recap text
// which never mixes scripts in practice.
function detectLang(text: string): "ko" | "en" {
  return /[가-힯]/.test(text) ? "ko" : "en";
}

function cacheKey(text: string, target: "ko" | "en") {
  return `recap:${target}:${text}`;
}

function readCache(text: string, target: "ko" | "en"): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(cacheKey(text, target));
  } catch {
    return null;
  }
}

function writeCache(text: string, target: "ko" | "en", translated: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cacheKey(text, target), translated);
  } catch {
    // localStorage may be full or disabled in private mode — non-fatal.
  }
}

export function RecapLine({ summary, className, style }: Props) {
  const { language } = useLanguage();

  // SSR-safe initial state: render the source verbatim. The first client
  // effect tick will hydrate from cache (instant) or trigger translation
  // (still renders original until it returns — never blanks the line).
  const [displayed, setDisplayed] = useState<string>(summary);

  // Tracks the latest (summary, target) we want shown — used to ignore late
  // API replies if the user toggled language again mid-flight.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!summary) return;
    const myRequest = ++requestIdRef.current;
    const source = detectLang(summary);

    // No translation needed when source already matches target.
    if (source === language) {
      setDisplayed(summary);
      return;
    }

    const cached = readCache(summary, language);
    if (cached) {
      setDisplayed(cached);
      return;
    }

    // Show the original while we fetch — better than a blank line.
    setDisplayed(summary);

    // Offline: translation needs the network — keep the original verbatim and
    // skip the doomed request.
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    (async () => {
      try {
        const res = await fetch("/api/ai/translate-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: summary, targetLang: language }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          data?: { translated?: string };
          error?: string | null;
        };
        const translated = (json?.data?.translated ?? "").trim();
        if (!translated) return;
        writeCache(summary, language, translated);
        // Drop the result if the user has since toggled again.
        if (requestIdRef.current !== myRequest) return;
        setDisplayed(translated);
      } catch {
        // Silent — original stays visible.
      }
    })();
  }, [summary, language]);

  if (!summary) return null;

  return (
    <p className={className} style={style}>
      {displayed}
    </p>
  );
}
