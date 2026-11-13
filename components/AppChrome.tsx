"use client";

import { useEffect } from "react";
import { applyTheme } from "@/lib/theme-store";
import OfflineBanner from "./OfflineBanner";

/** App-wide client bits: service worker, theme-colour sync, offline banner. */
export default function AppChrome() {
  useEffect(() => {
    applyTheme();
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((err) => console.warn("Service worker registration failed", err));
    }
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(4.25rem,calc(env(safe-area-inset-top)+3.5rem))] z-[1200] flex justify-center px-4">
      <OfflineBanner />
    </div>
  );
}
