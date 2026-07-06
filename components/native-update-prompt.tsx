"use client";

import { useEffect, useState } from "react";
import { Download, X as XIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// Minimum native build users must be on, PER PLATFORM — Android versionCode
// and iOS CFBundleVersion are unrelated numbering universes, so they must
// never share one threshold (an iOS TestFlight build "2" is NOT older than
// Android versionCode 15). Anything lower triggers the banner on app launch.
//
// CRITICAL — DO NOT BUMP THESE AHEAD OF THE STORE.
// The JS bundle is hot-deployed via Vercel within ~1 min of every push, so
// raising a threshold here BEFORE the matching binary is actually live on its
// store makes the banner appear to users whose store still shows the old
// version as current. They tap Update, see no update available, get
// confused. Sequence must be:
//   1. Build + upload the new binary (.aab / TestFlight-then-App-Store)
//   2. Wait for it to ROLL OUT on the store
//   3. THEN bump the constant and push the JS change to Vercel
// android: keep in sync with android/app/build.gradle but only AFTER step 2.
// ios: 0 = disabled (no App Store release yet — TestFlight distributes its
// own updates); set to the CFBundleVersion once an App Store build is live.
const MIN_BUILD: Record<string, number> = {
  android: 15,
  ios: 0,
};

const STORE_URL: Record<string, string> = {
  android: "https://play.google.com/store/apps/details?id=com.rememberone.app",
  ios: "https://apps.apple.com/app/id6784896315",
};

// Module-level guard prevents the native version check from running more
// than once per JS runtime. Survives every React re-render and remount.
let didCheck = false;

export function NativeUpdatePrompt() {
  const { language } = useLanguage();
  const ko = language === "ko";

  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [platform, setPlatform] = useState<"android" | "ios">("android");

  useEffect(() => {
    if (didCheck) return;
    didCheck = true;

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        // Compare each platform's build number ONLY against its own threshold.
        const plat = Capacitor.getPlatform();
        if (plat !== "android" && plat !== "ios") return;
        const min = MIN_BUILD[plat];
        if (!min) return; // 0 = update prompt disabled for this platform

        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        const installed = parseInt(info.build, 10);
        if (Number.isNaN(installed) || installed >= min) return;

        setPlatform(plat);
        setNeedsUpdate(true);
      } catch (err) {
        // Reset so a later mount can retry (won't happen in practice, but
        // it's polite). Console-warn for diagnosis.
        didCheck = false;
        console.warn("[update-prompt] version check failed:", err);
      }
    })();
  }, []);

  if (!needsUpdate || dismissed) return null;

  const storeUrl = STORE_URL[platform];
  const storeNameKo = platform === "ios" ? "App Store" : "Play 스토어";
  const storeNameEn = platform === "ios" ? "App Store" : "Play Store";

  async function openStore() {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: storeUrl });
    } catch {
      window.location.href = storeUrl;
    }
  }

  return (
    <div
      // Fixed top banner above the dashboard nav (z-40 → we sit at z-50).
      // safe-top respects the status-bar inset on phones with notches.
      className="fixed top-0 inset-x-0 z-50 px-3 pt-3 safe-top pointer-events-none"
    >
      <div
        // The actual banner. `update-prompt-attention` class adds the
        // breathing halo + ring pulse defined in app/globals.css.
        className="pointer-events-auto max-w-lg mx-auto p-3 pr-2 update-prompt-attention"
        style={{ borderRadius: "10px 2px 10px 2px" }}
      >
        <div className="flex items-start gap-3">
          <Download
            className="w-5 h-5 mt-0.5 shrink-0"
            style={{ color: "#284e72" }}
            aria-hidden="true"
          />

          <div className="flex-1 min-w-0">
            <p
              className="text-[13px] uppercase tracking-wide leading-tight"
              style={{
                color: "#284e72",
                fontFamily: "'Hammersmith One', sans-serif",
              }}
            >
              {ko ? "업데이트 안내" : "Update available"}
            </p>
            <p
              className="text-[11px] leading-snug mt-0.5"
              style={{ color: "#5e7983" }}
            >
              {ko
                ? `새 버전이 ${storeNameKo}에 있어요.`
                : `A newer version is on the ${storeNameEn}.`}
            </p>
          </div>

          <button
            type="button"
            onClick={openStore}
            className="shrink-0 text-white h-8 px-3 text-[12px] hover:opacity-90"
            style={{
              background: "linear-gradient(to right, #284e72, #482d7c)",
              borderRadius: "10px 2px 10px 2px",
              fontFamily: "'Hammersmith One', sans-serif",
            }}
          >
            {ko ? "업데이트" : "Update"}
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label={ko ? "닫기" : "Dismiss"}
            className="shrink-0 w-6 h-6 -mt-0.5 -mr-1 flex items-center justify-center rounded-full hover:bg-black/5"
            style={{ color: "#665b7b" }}
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
