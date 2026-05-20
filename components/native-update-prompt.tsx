"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Download } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// Minimum Android versionCode users must be on. Anything lower triggers
// the "Update available" toast on app launch. Bump this constant after
// each Play release whose changes can't be hot-reloaded via the
// Capacitor server.url web bundle (manifest changes, native plugin
// upgrades, etc.). Keep in sync with android/app/build.gradle.
const MIN_BUILD = 9;

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.rememberone.app";

// 24h — keeps the toast visible across an entire session unless the user
// dismisses it. Re-fires once per fresh app launch (one toast/session).
const SESSION_MS = 24 * 60 * 60 * 1000;

// Module-level guard. Survives component re-mounts and re-renders within
// the same JS runtime (the only way the toast fires again is a fresh page
// load / WebView reload, which is exactly the boundary we want). This
// replaces a per-component useRef whose value didn't survive the
// LanguageContext hydration re-render fast enough — the async IIFE
// inside the previous effect raced past the ref check, queueing duplicate
// toasts.
let hasShown = false;

export function NativeUpdatePrompt() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const ko = language === "ko";

  // Mirror `ko` into a ref so the toast text is up-to-date at fire time
  // without making the effect depend on `ko` (which would re-fire on
  // language hydration and cause the duplicate-toast bug).
  const koRef = useRef(ko);
  koRef.current = ko;

  useEffect(() => {
    if (hasShown) return;
    // Mark synchronously, BEFORE any async work, so a second pass through
    // the effect (e.g. from a context hydration re-render) bails immediately.
    hasShown = true;

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) {
          hasShown = false;
          return;
        }

        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        const installed = parseInt(info.build, 10);
        if (Number.isNaN(installed) || installed >= MIN_BUILD) {
          hasShown = false;
          return;
        }

        const isKo = koRef.current;
        toast({
          // Branded container: matches the lavender card gradient used
          // throughout the app. The `update-prompt-attention` class (in
          // app/globals.css) layers a slow shimmer + glow pulse for
          // attention. Both animations respect prefers-reduced-motion.
          className: "border-0 update-prompt-attention",
          style: {
            borderRadius: "10px 2px 10px 2px",
          },
          title: (
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4 shrink-0" style={{ color: "#284e72" }} />
              <span
                className="text-[14px] uppercase tracking-wide"
                style={{
                  color: "#284e72",
                  fontFamily: "'Hammersmith One', sans-serif",
                }}
              >
                {isKo ? "업데이트 안내" : "Update available"}
              </span>
            </span>
          ),
          description: (
            <span
              className="block text-[12px] leading-relaxed mt-1"
              style={{ color: "#5e7983" }}
            >
              {isKo
                ? "보안 개선이 포함된 새 버전이 Play 스토어에 있습니다. 업데이트해 주세요."
                : "A newer version with security improvements is on the Play Store. Please update."}
            </span>
          ),
          duration: SESSION_MS,
          action: (
            <ToastAction
              altText={isKo ? "Play 스토어 열기" : "Open Play Store"}
              onClick={async () => {
                try {
                  const { Browser } = await import("@capacitor/browser");
                  await Browser.open({ url: PLAY_STORE_URL });
                } catch {
                  window.location.href = PLAY_STORE_URL;
                }
              }}
              // Match the app's primary-action button: navy→purple gradient,
              // 10/2 corner radius, white Hammersmith One text.
              className="border-0 text-white h-9 px-4 hover:opacity-90"
              style={{
                background: "linear-gradient(to right, #284e72, #482d7c)",
                borderRadius: "10px 2px 10px 2px",
                fontFamily: "'Hammersmith One', sans-serif",
              }}
            >
              {isKo ? "업데이트" : "Update"}
            </ToastAction>
          ),
        });
      } catch (err) {
        hasShown = false;
        console.warn("[update-prompt] version check failed:", err);
      }
    })();
    // Intentionally only depends on `toast` (stable). `ko` is read from a
    // ref above so we don't re-fire the effect when LanguageContext hydrates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  return null;
}
