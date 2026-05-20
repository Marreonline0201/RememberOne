"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";

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

export function NativeUpdatePrompt() {
  const { toast } = useToast();
  const shownRef = useRef(false);

  useEffect(() => {
    if (shownRef.current) return;

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        const installed = parseInt(info.build, 10);
        if (Number.isNaN(installed) || installed >= MIN_BUILD) return;

        shownRef.current = true;
        toast({
          title: "Update available",
          description:
            "A newer version of RememberOne is on the Play Store with important security improvements. Please update.",
          duration: SESSION_MS,
          action: (
            <ToastAction
              altText="Open Play Store"
              onClick={async () => {
                try {
                  const { Browser } = await import("@capacitor/browser");
                  await Browser.open({ url: PLAY_STORE_URL });
                } catch {
                  window.location.href = PLAY_STORE_URL;
                }
              }}
            >
              Update
            </ToastAction>
          ),
        });
      } catch (err) {
        console.warn("[update-prompt] version check failed:", err);
      }
    })();
  }, [toast]);

  return null;
}
