"use client";

import { useEffect } from "react";

// Registers the service worker once on mount. Lives at the root layout so
// the SW is up and running on every route, not just the dashboard.
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    // Register in idle time so the SW install doesn't compete with the
    // initial page paint.
    const handle = window.setTimeout(() => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          console.warn("[pwa] service-worker registration failed", err);
        });
    }, 1500);

    return () => window.clearTimeout(handle);
  }, []);

  return null;
}
