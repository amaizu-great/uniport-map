"use client";

import { useSyncExternalStore } from "react";

export type ThemePref = "light" | "dark" | "system";
export type Theme = "light" | "dark";

const KEY = "theme";
const listeners = new Set<() => void>();

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function resolve(pref: ThemePref): Theme {
  if (pref !== "system") return pref;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme() {
  const theme = resolve(readPref());
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]:not([media])')
    ?.setAttribute("content", theme === "dark" ? "#121212" : "#FFFFFF");
  listeners.forEach((l) => l());
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* storage unavailable */
  }
  applyTheme();
}

/** Flip between light and dark (leaving "system" once the user chooses). */
export function toggleTheme() {
  setThemePref(resolve(readPref()) === "dark" ? "light" : "dark");
}

let mql: MediaQueryList | null = null;
function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!mql) {
    mql = matchMedia("(prefers-color-scheme: dark)");
    mql.addEventListener("change", () => readPref() === "system" && applyTheme());
  }
  return () => listeners.delete(cb);
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    () => "light",
  );
}
