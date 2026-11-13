"use client";

import { useSyncExternalStore } from "react";

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

export type LocateStatus = "idle" | "locating" | "on" | "denied" | "unavailable";

interface State {
  status: LocateStatus;
  location: UserLocation | null;
  message: string | null;
}

/**
 * One shared geolocation watch for the whole app, so the blue dot survives
 * moving between the overview and a campus map. Permission is only ever
 * requested from `startLocating()`, which runs on a user tap.
 */
let state: State = { status: "idle", location: null, message: null };
let watchId: number | null = null;
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function startLocating() {
  if (watchId !== null) return;
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    set({ status: "unavailable", message: "Your browser can’t share your location." });
    return;
  }
  set({ status: "locating", message: null });
  watchId = navigator.geolocation.watchPosition(
    (pos) =>
      set({
        status: "on",
        message: null,
        location: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy },
      }),
    (err) => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
      if (err.code === err.PERMISSION_DENIED) {
        set({
          status: "denied",
          message:
            "No problem, location is off. You can still browse. To turn it on, allow location for this site in your browser settings.",
        });
      } else {
        set({ status: "unavailable", message: "Couldn’t find you right now. Try again in a moment, ideally outdoors." });
      }
    },
    { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
  );
}

export function dismissLocationMessage() {
  set({ message: null });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const serverState: State = { status: "idle", location: null, message: null };

export function useLocation(): State {
  return useSyncExternalStore(subscribe, () => state, () => serverState);
}

/** Runs `cb` once with the next location fix (or immediately if one is known). */
export function onNextFix(cb: (loc: UserLocation) => void) {
  if (state.location) {
    cb(state.location);
    return;
  }
  const listener = () => {
    if (state.location) {
      listeners.delete(listener);
      cb(state.location);
    } else if (state.status === "denied" || state.status === "unavailable") {
      listeners.delete(listener);
    }
  };
  listeners.add(listener);
}
