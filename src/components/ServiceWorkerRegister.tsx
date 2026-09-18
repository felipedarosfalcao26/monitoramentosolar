"use client";

import { useEffect } from "react";

/** Registers the offline app-shell cache (public/sw.js) — see that file for exactly what it does and doesn't cache. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-critical — the app still works online without it.
      });
    }
  }, []);

  return null;
}
