"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import BottomSheet from "./BottomSheet";
import CampusScene from "./CampusScene";
import InstallPrompt from "./InstallPrompt";
import { Icon, LocationToast, PlaceRow, RoundButton, SearchField, SectionTitle, ThemeToggle } from "./ui";
import { distance, distanceToPolygon, formatDistance, formatWalk } from "@/lib/geo";
import { startLocating, useLocation } from "@/lib/location-store";
import { campuses, getPlace, places } from "@/lib/places";
import { usePlaceSearch } from "@/lib/use-search";
import type { Campus, Place } from "@/lib/types";

const SNAPS = [0.4, 0.93];
const QUICK = ["abuja-uba", "abuja-donald-ekong-library", "abuja-senate-building", "delta-o-b-lulu-briggs-health-center"];

export default function Overview() {
  const router = useRouter();
  const { status, location } = useLocation();
  const [snap, setSnap] = useState(0);
  const [sheetH, setSheetH] = useState(0);
  const [frameH, setFrameH] = useState(0);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const openPlace = useCallback((p: Place) => router.push(`/place/${p.id}`), [router]);
  const openCampus = useCallback((id: Campus) => router.push(`/campus/${id}`), [router]);
  const { results, active, setActive, onKeyDown } = usePlaceSearch(places, query, openPlace);

  const distances = useMemo(() => {
    if (!location) return null;
    return Object.fromEntries(
      campuses.map((c) => [c.id, distanceToPolygon(location, c.outline)]),
    ) as Record<Campus, number>;
  }, [location]);
  const here = distances ? (campuses.find((c) => distances[c.id] === 0)?.id ?? null) : null;
  const sortedCampuses = distances ? [...campuses].sort((a, b) => distances[a.id] - distances[b.id]) : campuses;

  const onHeightChange = useCallback((h: number, container: number) => {
    setSheetH(h);
    setFrameH(container);
  }, []);
  const quick = QUICK.map(getPlace).filter((p): p is Place => !!p);

  const subtitle =
    status === "locating"
      ? "Finding you…"
      : here
        ? `You’re on ${campuses.find((c) => c.id === here)!.name}`
        : distances
          ? `Nearest: ${sortedCampuses[0].name}, ${formatDistance(distances[sortedCampuses[0].id])} away`
          : "Pick a campus to explore";

  return (
    <div className="fixed inset-0 overflow-hidden bg-[linear-gradient(180deg,var(--scene-sky-top),var(--scene-sky-bottom))]">
      {/* Top bar */}
      <header className="absolute inset-x-0 top-0 z-[1000] flex items-center gap-3 px-4 pb-2 pt-[max(0.9rem,env(safe-area-inset-top))]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="size-10 rounded-xl shadow-float" />
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="text-[17px] font-extrabold tracking-tight text-ink">Map of UNIPORT</h1>
          <p className="text-[12.5px] text-ink-muted">Abuja · Choba · Delta</p>
        </div>
        <RoundButton
          icon="search"
          label="Search places"
          onClick={() => {
            setSnap(1);
            setTimeout(() => inputRef.current?.focus(), 330);
          }}
        />
        <ThemeToggle />
      </header>

      {/* 3D campus scene */}
      <div
        className="absolute inset-x-0 top-16 px-2"
        style={{ bottom: frameH ? SNAPS[0] * frameH + 4 : "40%" }}
      >
        <CampusScene user={location} here={here} onOpen={openCampus} />
      </div>

      {/* Locate */}
      <div
        className="absolute right-4 z-[1050] flex flex-col items-end gap-2 transition-[bottom] duration-300"
        style={{ bottom: sheetH + 12, opacity: snap === 0 ? 1 : 0, pointerEvents: snap === 0 ? "auto" : "none" }}
      >
        <button
          type="button"
          onClick={startLocating}
          className={`pointer-events-auto flex h-11 items-center gap-2 rounded-full border border-line bg-glass px-4 text-[14px] font-semibold shadow-float backdrop-blur-md active:scale-95 ${
            status === "on" ? "text-[#1a73e8]" : "text-ink"
          }`}
        >
          <Icon name="locate" className={`size-4 ${status === "locating" ? "animate-pulse" : ""}`} />
          {status === "on" ? "Located" : "Near me"}
        </button>
      </div>
      <LocationToast bottom={sheetH + 68} />

      <BottomSheet
        label="Campuses and search"
        snaps={SNAPS}
        snap={snap}
        onSnapChange={setSnap}
        onHeightChange={onHeightChange}
        header={
          <div className="px-5 pb-3">
            <h2 className="text-[22px] font-bold tracking-tight text-ink">Where to?</h2>
            <p className="mb-3 text-[14px] text-ink-muted">{subtitle}</p>
            <SearchField
              inputRef={inputRef}
              value={query}
              onChange={(v) => {
                setQuery(v);
                setActive(0);
                if (v) setSnap(1);
              }}
              onFocus={() => setSnap(1)}
              onKeyDown={onKeyDown}
              placeholder="Search banks, faculties, hostels…"
            />
          </div>
        }
      >
        {query.trim() ? (
          results.length ? (
            <ul role="listbox" aria-label="Search results" className="pb-6">
              {results.map((p, i) => (
                <PlaceRow
                  key={p.id}
                  place={p}
                  showCampus
                  active={i === active}
                  distance={location && p.lat !== null ? distance(location, { lat: p.lat, lng: p.lng! }) : null}
                  onClick={() => openPlace(p)}
                />
              ))}
            </ul>
          ) : (
            <p className="px-8 py-10 text-center text-[15px] text-ink-muted">
              Nothing matches &ldquo;{query.trim()}&rdquo;. Try a different spelling, or a nickname like
              &ldquo;Ofrima&rdquo; or &ldquo;UL&rdquo;.
            </p>
          )
        ) : (
          <div className="pb-8">
            <ul className="flex flex-col gap-2.5 px-4 pt-1">
              {sortedCampuses.map((c) => {
                const d = distances?.[c.id];
                const count = places.filter((p) => p.campus === c.id && p.lat !== null).length;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/campus/${c.id}`}
                      className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-3.5 transition active:scale-[0.99] hover:bg-surface-2"
                    >
                      <CampusBadge id={c.id} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-[16px] font-bold text-ink">{c.name}</span>
                          {here === c.id && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-on-primary">
                              You’re here
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[13px] text-ink-muted">{c.blurb}</span>
                        <span className="mt-0.5 block text-[12.5px] font-medium text-primary">
                          {d != null && d > 0 ? `${formatDistance(d)} · ${formatWalk(d)}` : `${count} places mapped`}
                        </span>
                      </span>
                      <Icon name="chevron" className="size-5 shrink-0 text-ink-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>

            <SectionTitle>Popular</SectionTitle>
            <ul>
              {quick.map((p) => (
                <PlaceRow
                  key={p.id}
                  place={p}
                  showCampus
                  distance={location && p.lat !== null ? distance(location, { lat: p.lat, lng: p.lng! }) : null}
                  onClick={() => openPlace(p)}
                />
              ))}
            </ul>

            <div className="flex justify-center px-5 pt-5">
              <InstallPrompt />
            </div>
            <p className="px-6 pt-5 text-center text-[11.5px] leading-relaxed text-ink-muted">
              Place data © OpenStreetMap contributors. Pins are unverified until checked on the ground.
            </p>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

/** Tiny isometric cube in the campus palette. */
function CampusBadge({ id }: { id: Campus }) {
  const tone = id === "abuja" ? "-hero" : id === "delta" ? "-alt" : "";
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-14 shrink-0 rounded-2xl bg-surface-2 p-2">
      <path d="M24 6 42 16 24 26 6 16Z" fill={`var(--scene-bld-top${tone})`} />
      <path d="M6 16 24 26v16L6 32Z" fill={`var(--scene-bld-left${tone})`} />
      <path d="M42 16 24 26v16l18-10Z" fill={`var(--scene-bld-right${tone})`} />
    </svg>
  );
}
