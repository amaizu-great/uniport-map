"use client";

import QRCode from "qrcode";
import { useMemo, useSyncExternalStore } from "react";
import { APP_NAME } from "@/lib/config";

/** Current page URL on the client, null during server rendering. */
function useHref() {
  return useSyncExternalStore(
    (cb) => {
      // App Router navigations use history.pushState/replaceState, which fire no event,
      // so also re-check on popstate and focus.
      window.addEventListener("popstate", cb);
      window.addEventListener("focus", cb);
      return () => {
        window.removeEventListener("popstate", cb);
        window.removeEventListener("focus", cb);
      };
    },
    () => window.location.href,
    () => null,
  );
}

function QrSvg({ text }: { text: string }) {
  const { size, path } = useMemo(() => {
    const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
    let d = "";
    for (let y = 0; y < modules.size; y++)
      for (let x = 0; x < modules.size; x++) if (modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
    return { size: modules.size, path: d };
  }, [text]);
  return (
    <svg viewBox={`-2 -2 ${size + 4} ${size + 4}`} className="size-full" shapeRendering="crispEdges" aria-hidden="true">
      <rect x={-2} y={-2} width={size + 4} height={size + 4} fill="#fff" />
      <path d={path} fill="#0b1a3a" />
    </svg>
  );
}

/**
 * Shown instead of the app on screens wider than a phone (see .phone-only in globals.css).
 * Pure CSS decides when it appears, so there is no flash and no hydration mismatch.
 */
export default function PhoneOnly() {
  const href = useHref();
  return (
    <div className="phone-only" role="dialog" aria-modal="true" aria-labelledby="phone-only-title">
      <div className="w-full max-w-[420px] rounded-[28px] border border-line bg-surface p-8 text-center shadow-sheet">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="mx-auto size-14 rounded-2xl" />
        <h1 id="phone-only-title" className="mt-5 text-[22px] font-bold tracking-tight text-ink">
          {APP_NAME} is made for phones
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
          Open it on your phone to find your way around campus. Scan this code with your camera:
        </p>
        <div className="mx-auto mt-6 size-48 overflow-hidden rounded-2xl border border-line bg-white p-2">
          {href ? <QrSvg text={href} /> : <div className="size-full animate-pulse rounded-xl bg-surface-2" />}
        </div>
        {href && <p className="mt-4 break-all text-[13px] text-ink-muted">{href}</p>}
        <p className="mt-5 text-[13px] text-ink-muted">Using a phone in landscape? Turn it upright.</p>
      </div>
    </div>
  );
}
