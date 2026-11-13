"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "install-prompt-dismissed";

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || localStorage.getItem(DISMISS_KEY)) return;

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIos) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only state once on mount
      setIos(true);
      setHidden(false);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  }

  async function install() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      setHidden(true);
    } else if (ios) {
      setShowIosHelp((v) => !v);
    }
  }

  return (
    <div className="pointer-events-auto flex flex-col items-start gap-2">
      {showIosHelp && (
        <p className="max-w-64 rounded-2xl border border-line bg-surface p-3 text-sm text-ink shadow-xl shadow-ocean-900/20">
          Tap the <strong>Share</strong> button in Safari, then{" "}
          <strong>Add to Home Screen</strong>.
        </p>
      )}
      <div className="flex items-center overflow-hidden rounded-full bg-ocean-900 text-ocean-50 shadow-xl shadow-ocean-900/30 dark:bg-primary dark:text-on-primary">
        <button type="button" onClick={install} className="flex h-11 items-center gap-2 pl-4 pr-2 text-sm font-semibold">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
            <path fill="currentColor" d="M11 3h2v9.17l3.59-3.58L18 10l-6 6-6-6 1.41-1.41L11 12.17V3ZM5 18h14v2H5v-2Z" />
          </svg>
          Add to home screen
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="grid h-11 w-10 place-items-center opacity-80 hover:opacity-100"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
            <path
              fill="currentColor"
              d="m12 10.6 4.95-4.95 1.4 1.4L13.4 12l4.95 4.95-1.4 1.4L12 13.4l-4.95 4.95-1.4-1.4L10.6 12 5.65 7.05l1.4-1.4L12 10.6Z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
