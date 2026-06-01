"use client";

// useCalendarConnect — starts the Google Calendar OAuth flow and handles its
// return, working around Google's WebView block (disallowed_useragent).
//
// Native (Capacitor): fetch the auth URL (?mode=native), open it in Chrome
// Custom Tabs, then catch the redirect that re-enters the app via the verified
// /auth/callback app link (state prefixed "cal_") and finish the exchange in
// the WebView via /api/calendar/exchange.
//
// Web: unchanged — a normal full-page redirect to /api/calendar/connect.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";

const APP_LINK_PREFIX = "https://rememberone.online/auth/callback";

export function useCalendarConnect() {
  const router = useRouter();
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const busyRef = useRef(false);

  // Native only: catch the OAuth return that re-enters the app via the app link.
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    import("@capacitor/core").then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;
      import("@capacitor/app").then(({ App }) => {
        const handle = App.addListener("appUrlOpen", async ({ url }) => {
          if (!url.startsWith(APP_LINK_PREFIX)) return;

          let parsed: URL;
          try {
            parsed = new URL(url);
          } catch {
            return;
          }

          // Only handle OUR calendar return; ignore Supabase login callbacks.
          const state = parsed.searchParams.get("state");
          if (!state || !state.startsWith("cal_")) return;

          // Bring the user back from the Custom Tab to the app view.
          try {
            const { Browser } = await import("@capacitor/browser");
            await Browser.close();
          } catch {
            // Plugin unavailable — safe to ignore.
          }

          const code = parsed.searchParams.get("code");
          const errParam =
            parsed.searchParams.get("error_description") ??
            parsed.searchParams.get("error");

          if (errParam || !code) {
            setConnecting(false);
            toast({
              title: "Google Calendar not connected",
              description: errParam
                ? decodeURIComponent(errParam)
                : "No authorization code was returned.",
              variant: "destructive",
            });
            return;
          }

          try {
            const res = await fetch("/api/calendar/exchange", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code, state }),
            });
            if (!res.ok) {
              let message = "Calendar connection failed";
              try {
                const j = await res.json();
                if (j?.error) message = j.error;
              } catch {
                /* non-JSON error body */
              }
              throw new Error(message);
            }
            toast({ title: "Google Calendar connected" });
            router.refresh();
          } catch (err: unknown) {
            console.error("[calendar connect] exchange failed:", err);
            toast({
              title: "Calendar connection failed",
              description: err instanceof Error ? err.message : "Unknown error",
              variant: "destructive",
            });
          } finally {
            setConnecting(false);
          }
        });
        cleanup = () => handle.then((h) => h.remove());
      });
    });
    return () => cleanup?.();
  }, [router, toast]);

  const connect = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setConnecting(true);

    let isNative = false;
    try {
      const { Capacitor } = await import("@capacitor/core");
      isNative = Capacitor.isNativePlatform();
    } catch {
      // not native
    }

    if (isNative) {
      try {
        const res = await fetch("/api/calendar/connect?mode=native");
        if (!res.ok) throw new Error("connect_init_failed");
        const { url } = await res.json();
        if (!url) throw new Error("no_url");
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url });
        // Leave `connecting` true until appUrlOpen resolves the return.
      } catch (err: unknown) {
        console.error("[calendar connect] native init failed:", err);
        toast({
          title: "Couldn't start Google Calendar connection",
          description: "Please try again.",
          variant: "destructive",
        });
        setConnecting(false);
      } finally {
        busyRef.current = false;
      }
      return;
    }

    // Web: full-page redirect (works in a real browser).
    busyRef.current = false;
    window.location.href = "/api/calendar/connect";
  }, [toast]);

  return { connect, connecting };
}
