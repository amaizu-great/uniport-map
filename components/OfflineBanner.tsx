"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export default function OfflineBanner() {
  const offline = useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
  if (!offline) return null;
  return (
    <div
      role="status"
      className="pointer-events-auto rounded-full bg-warn px-4 py-2 text-center text-sm font-medium text-warn-ink shadow-lg"
    >
      Offline · showing saved places and map areas you’ve viewed
    </div>
  );
}
