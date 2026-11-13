"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import BottomSheet from "./BottomSheet";
import type { BaseLayer, MapFocus } from "./MapView";
import { PlaceBody, PlaceHeader } from "./PlaceDetails";
import { CategoryBadge, Icon, LocationToast, PlaceRow, RoundButton, SearchField, ThemeToggle } from "./ui";
import { distance, distanceToPolygon, formatDistance } from "@/lib/geo";
import { onNextFix, startLocating, useLocation } from "@/lib/location-store";
import { CATEGORY_META, FILTER_CHIPS, campuses, categoryFilter, getCampus, getPlace, hasLocation, placesIn } from "@/lib/places";
import { usePlaceSearch } from "@/lib/use-search";
import type { Campus, Place } from "@/lib/types";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
});

const BROWSE_SNAPS = [212, 0.52, 0.93];
const PLACE_SNAPS = [176, 0.55, 0.93];

interface CampusMapProps {
  campus: Campus;
  initialPlaceId?: string;
}

export default function CampusMap({ campus: campusId, initialPlaceId }: CampusMapProps) {
  const router = useRouter();
  const campus = getCampus(campusId);
  const { location, status } = useLocation();

  const all = useMemo(() => placesIn(campusId), [campusId]);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPlaceId && getPlace(initialPlaceId)?.campus === campusId ? initialPlaceId : null,
  );
  const selected = selectedId ? (getPlace(selectedId) ?? null) : null;

  const [chips, setChips] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [snap, setSnap] = useState(0);
  const [sheetH, setSheetH] = useState(0);
  const [frameH, setFrameH] = useState(0);
  const [layer, setLayer] = useState<BaseLayer>("map");
  const [showPins, setShowPins] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const keyRef = useRef(1);
  const [focus, setFocus] = useState<MapFocus | null>(() =>
    selected && hasLocation(selected)
      ? { kind: "point", center: [selected.lat, selected.lng], zoom: 18, key: 0 }
      : null,
  );

  // ---- URL sync (QR-friendly links) ----
  const syncUrl = useCallback((path: string) => {
    if (window.location.pathname !== path) window.history.replaceState(null, "", path);
  }, []);

  const select = useCallback(
    (place: Place) => {
      setSelectedId(place.id);
      setSnap(0);
      setQuery("");
      if (hasLocation(place)) {
        setFocus({ kind: "point", center: [place.lat, place.lng], zoom: 18, key: keyRef.current++ });
      }
      syncUrl(`/place/${place.id}`);
    },
    [syncUrl],
  );

  const selectById = useCallback(
    (id: string) => {
      const p = getPlace(id);
      if (p) select(p);
    },
    [select],
  );

  const closePlace = useCallback(() => {
    setSelectedId(null);
    setSnap(0);
    syncUrl(`/campus/${campusId}`);
  }, [campusId, syncUrl]);

  // ---- filtering & search ----
  const filter = useMemo(() => categoryFilter(chips), [chips]);
  const pins = useMemo(
    () =>
      all
        .filter(hasLocation)
        // With icons hidden, only the place you picked stays on the map.
        .filter((p) => p.id === selectedId || (showPins && filter(p))),
    [all, filter, selectedId, showPins],
  );
  const { results, active, setActive, onKeyDown } = usePlaceSearch(all, query, select, 40);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const chip of FILTER_CHIPS) c[chip.id] = all.filter((p) => chip.categories.includes(p.category)).length;
    return c;
  }, [all]);

  const list = useMemo(() => {
    const base = query.trim() ? results.filter(filter) : all.filter(filter);
    if (query.trim()) return base;
    const d = (p: Place) => (location && p.lat !== null ? distance(location, { lat: p.lat, lng: p.lng! }) : Infinity);
    return [...base].sort((a, b) =>
      Number(a.lat === null) - Number(b.lat === null) ||
      (location
        ? d(a) - d(b)
        : Number(CATEGORY_META[b.category].major) - Number(CATEGORY_META[a.category].major) ||
          a.name.localeCompare(b.name)),
    );
  }, [query, results, filter, all, location]);

  // ---- location ----
  function locate() {
    startLocating();
    onNextFix((loc) => {
      const away = distanceToPolygon(loc, campus.outline);
      if (away > 1200) {
        setHint(`You’re ${formatDistance(away)} from ${campus.name}.`);
        setTimeout(() => setHint(null), 5000);
        return;
      }
      setFocus({ kind: "point", center: [loc.lat, loc.lng], zoom: 18, key: keyRef.current++ });
    });
  }

  const onHeightChange = useCallback((h: number, container: number) => {
    setSheetH(h);
    setFrameH(container);
  }, []);
  const peekInset = (selected ? PLACE_SNAPS[0] : BROWSE_SNAPS[0]) as number;
  const controlsVisible = frameH === 0 || sheetH < frameH * 0.6;

  const toggleChip = (id: string) =>
    setChips((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg">
      <main className="absolute inset-0 z-0">
        <MapView
          campus={campus}
          places={pins}
          selectedId={selectedId}
          focus={focus}
          user={location}
          layer={layer}
          bottomInset={peekInset}
          onSelect={selectById}
          onMapClick={selected ? closePlace : undefined}
        />
      </main>

      {/* Top bar: back · campus pill · search */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-center justify-between gap-3 px-4 pt-[max(0.9rem,env(safe-area-inset-top))]">
        <RoundButton icon="back" label="All campuses" onClick={() => router.push("/")} />
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="pointer-events-auto flex h-11 items-center gap-1.5 rounded-full border border-line bg-glass px-5 text-[15px] font-bold text-ink shadow-float backdrop-blur-md"
          >
            <h1>{campus.name}</h1>
            <Icon name="chevronDown" className="size-4 text-ink-muted" />
          </button>
          {menuOpen && (
            <ul
              role="menu"
              className="pointer-events-auto absolute left-1/2 top-13 w-52 -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-float"
            >
              {campuses.map((c) => (
                <li key={c.id} role="none">
                  <Link
                    role="menuitem"
                    href={`/campus/${c.id}`}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center justify-between px-4 py-3 text-[15px] hover:bg-surface-2 ${
                      c.id === campusId ? "font-bold text-primary" : "text-ink"
                    }`}
                  >
                    {c.name}
                    {c.id === campusId && <Icon name="check" className="size-[18px]" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <RoundButton
          icon="search"
          label="Search this campus"
          onClick={() => {
            closePlace();
            setSnap(2);
            setTimeout(() => inputRef.current?.focus(), 330);
          }}
        />
      </header>

      {/* Right-hand controls, floating above the sheet */}
      <div
        className="absolute right-4 z-[1050] flex flex-col gap-2.5 transition-[bottom,opacity] duration-300"
        style={{
          bottom: sheetH + 14,
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? "auto" : "none",
        }}
      >
        <ThemeToggle />
        <RoundButton
          icon={showPins ? "pin" : "pinOff"}
          label={showPins ? "Hide place icons" : "Show place icons"}
          active={showPins}
          onClick={() => setShowPins((v) => !v)}
        />
        <RoundButton
          icon="layers"
          label={layer === "map" ? "Show satellite" : "Show street map"}
          active={layer === "satellite"}
          onClick={() => setLayer((l) => (l === "map" ? "satellite" : "map"))}
        />
        <RoundButton
          icon="locate"
          label={status === "on" ? "Centre on me" : "Show my location"}
          active={status === "on"}
          className={status === "locating" ? "animate-pulse" : ""}
          onClick={locate}
        />
      </div>

      {hint && (
        <div className="pointer-events-none absolute inset-x-4 z-[1150] flex justify-center" style={{ bottom: sheetH + 14 }}>
          <p role="status" className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-[14px] text-ink shadow-float">
            <Icon name="pin" className="size-[18px] shrink-0 text-primary" />
            {hint}
          </p>
        </div>
      )}
      <LocationToast bottom={sheetH + 14} />

      {selected ? (
        <BottomSheet
          key={`place-${selected.id}`}
          label={selected.name}
          snaps={PLACE_SNAPS}
          snap={snap}
          onSnapChange={setSnap}
          onHeightChange={onHeightChange}
          header={<PlaceHeader place={selected} onClose={closePlace} />}
        >
          <PlaceBody place={selected} />
        </BottomSheet>
      ) : (
        <BottomSheet
          key="browse"
          label={`${campus.name} places`}
          snaps={BROWSE_SNAPS}
          snap={snap}
          onSnapChange={setSnap}
          onHeightChange={onHeightChange}
          header={
            <div className="pb-2">
              <div className="px-4">
                <SearchField
                  inputRef={inputRef}
                  value={query}
                  onChange={(v) => {
                    setQuery(v);
                    setActive(0);
                    if (v && snap < 1) setSnap(1);
                  }}
                  onFocus={() => snap < 1 && setSnap(1)}
                  onKeyDown={onKeyDown}
                  placeholder={`Search ${campus.short}…`}
                />
              </div>
              {/* Category tray, like the reference */}
              <div role="group" aria-label="Filter by category" className="no-scrollbar mt-2 flex gap-1 overflow-x-auto px-2">
                {FILTER_CHIPS.filter((c) => counts[c.id] > 0).map((chip) => {
                  const on = chips.includes(chip.id);
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleChip(chip.id)}
                      className={`relative flex w-[76px] shrink-0 flex-col items-center gap-1 rounded-2xl px-1 pb-1.5 pt-2 transition-colors ${
                        on ? "bg-surface-3" : "hover:bg-surface-2"
                      }`}
                    >
                      <CategoryBadge category={chip.icon} size={40} />
                      <span className={`text-[12.5px] font-semibold ${on ? "text-primary" : "text-ink"}`}>{chip.label}</span>
                      <span className="absolute right-2 top-0.5 min-w-6 rounded-full bg-ink px-1.5 text-center text-[10.5px] font-bold leading-[18px] text-bg">
                        {counts[chip.id]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          }
        >
          {list.length ? (
            <ul role="listbox" aria-label="Places" className="pb-8">
              {list.map((p, i) => (
                <PlaceRow
                  key={p.id}
                  place={p}
                  active={query.trim() !== "" && i === active}
                  distance={location && p.lat !== null ? distance(location, { lat: p.lat, lng: p.lng! }) : null}
                  onClick={() => select(p)}
                />
              ))}
            </ul>
          ) : (
            <p className="px-8 py-10 text-center text-[15px] text-ink-muted">
              {query.trim() ? `Nothing on ${campus.short} matches “${query.trim()}”.` : "No places in this category yet."}
              {chips.length > 0 && (
                <>
                  {" "}
                  <button type="button" className="font-semibold text-primary" onClick={() => setChips([])}>
                    Clear filters
                  </button>
                </>
              )}
            </p>
          )}
        </BottomSheet>
      )}
    </div>
  );
}
