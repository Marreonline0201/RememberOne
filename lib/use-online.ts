"use client";

// useOnline — tracks network connectivity in the WebView/browser.
// Defaults to true so SSR and the first client paint assume online (avoids a
// flash of the offline UI before hydration); then reflects navigator.onLine and
// the window online/offline events.

import { useEffect, useState } from "react";

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update(); // sync with the real state on mount
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
