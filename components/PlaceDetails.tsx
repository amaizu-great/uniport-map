"use client";

import { useState } from "react";
import { Icon } from "./ui";
import { reportUrl } from "@/lib/config";
import { directionsUrl } from "@/lib/directions";
import { distance, formatDistance, formatWalk } from "@/lib/geo";
import { startLocating, useLocation } from "@/lib/location-store";
import { CATEGORY_META, campusName, hasLocation } from "@/lib/places";
import type { Place } from "@/lib/types";

/** Header part of the place sheet (stays visible when the sheet is collapsed). */
export function PlaceHeader({ place, onClose }: { place: Place; onClose: () => void }) {
  const { location } = useLocation();
  const meta = CATEGORY_META[place.category];
  const located = hasLocation(place);
  const d = location && located ? distance(location, { lat: place.lat, lng: place.lng }) : null;

  return (
    <div className="px-5 pb-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[21px] font-bold leading-tight tracking-tight text-ink">{place.name}</h2>
          <p className="mt-1 text-[14px] text-ink-muted">
            {meta.label} · {campusName(place.campus)}
            {d != null && (
              <>
                {" · "}
                <span className="font-semibold text-ink">{formatDistance(d)}</span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-muted hover:bg-surface-3"
        >
          <Icon name="close" className="size-[18px]" />
        </button>
      </div>
      <DirectionsRow place={place} />
    </div>
  );
}

function DirectionsRow({ place }: { place: Place }) {
  const { location, status } = useLocation();
  const [copied, setCopied] = useState(false);
  const located = hasLocation(place);
  const d = location && located ? distance(location, { lat: place.lat, lng: place.lng }) : null;

  async function share() {
    const url = `${window.location.origin}/place/${place.id}`;
    try {
      if (navigator.share) await navigator.share({ title: place.name, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="no-scrollbar -mx-5 mt-3.5 flex gap-2 overflow-x-auto px-5">
      {located ? (
        <a
          href={directionsUrl({ lat: place.lat, lng: place.lng }, location)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => status === "idle" && startLocating()}
          className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-semibold text-on-primary active:scale-95"
        >
          <Icon name="walk" className="size-[18px]" />
          {d != null ? formatWalk(d) : "Directions"}
        </a>
      ) : (
        <span className="flex h-11 shrink-0 items-center rounded-full bg-surface-2 px-5 text-[14px] font-semibold text-ink-muted">
          Location coming soon
        </span>
      )}
      {located && !location && (
        <button
          type="button"
          onClick={startLocating}
          className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-line px-4 text-[14px] font-semibold text-primary active:scale-95"
        >
          <Icon name="locate" className="size-4" />
          {status === "locating" ? "Finding you…" : "How far?"}
        </button>
      )}
      <button
        type="button"
        onClick={share}
        className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-line px-4 text-[14px] font-semibold text-primary active:scale-95"
      >
        <Icon name="share" className="size-4" />
        {copied ? "Link copied" : "Share"}
      </button>
    </div>
  );
}

/** Scrollable body of the place sheet. */
export function PlaceBody({ place }: { place: Place }) {
  return (
    <div className="px-5 pb-8">
      {place.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={place.photo}
          alt={`Photo of ${place.name}`}
          loading="lazy"
          className="mb-4 aspect-[16/10] w-full rounded-3xl object-cover"
        />
      )}

      {!place.verified && (
        <p className="mb-3 flex items-start gap-2.5 rounded-2xl bg-warn px-4 py-3 text-[13.5px] text-warn-ink">
          <Icon name="info" className="mt-px size-[18px] shrink-0" />
          <span>
            {place.source === "osm"
              ? "Unverified. This pin comes from OpenStreetMap and hasn’t been checked on the ground yet."
              : "Unverified. This position hasn’t been checked on the ground yet."}
          </span>
        </p>
      )}

      {place.description && <p className="text-[15px] leading-relaxed text-ink">{place.description}</p>}

      {place.landmark && (
        <p className="mt-3 flex gap-2.5 rounded-2xl bg-surface-2 px-4 py-3 text-[14px] text-ink">
          <Icon name="pin" className="mt-px size-[18px] shrink-0 text-primary" />
          <span>{place.landmark}</span>
        </p>
      )}

      {place.aliases.length > 0 && (
        <p className="mt-3 text-[13px] text-ink-muted">Also called: {place.aliases.join(", ")}</p>
      )}

      <a
        href={reportUrl(place)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 flex items-center gap-2 py-2 text-[14px] font-medium text-ink-muted hover:text-primary"
      >
        <Icon name="flag" className="size-4" />
        Wrong location or details? Report a mistake
      </a>
    </div>
  );
}
