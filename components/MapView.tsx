"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import { CATEGORY_ICONS, iconSvg } from "@/lib/category-icons";
import { CATEGORY_META } from "@/lib/places";
import type { UserLocation } from "@/lib/location-store";
import type { CampusInfo, LatLngTuple, MappedPlace } from "@/lib/types";

export type MapFocus =
  | { kind: "campus"; key: number }
  | { kind: "point"; center: LatLngTuple; zoom?: number; key: number };

export type BaseLayer = "map" | "satellite";

interface MapViewProps {
  campus: CampusInfo;
  places: MappedPlace[];
  selectedId: string | null;
  focus: MapFocus | null;
  user: UserLocation | null;
  layer: BaseLayer;
  /** Pixels hidden behind the bottom sheet, so focus targets stay visible. */
  bottomInset: number;
  onSelect: (id: string) => void;
  onMapClick?: () => void;
}

// OSM standard tiles, restyled to white/grey streets with a CSS filter (see .street-tiles).
const TILES = {
  street: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
};
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const ESRI_ATTR = "Tiles &copy; Esri, Maxar, Earthstar Geographics";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function poiIcon(place: MappedPlace, selected: boolean): L.DivIcon {
  const meta = CATEGORY_META[place.category];
  const { node, color } = CATEGORY_ICONS[place.category];
  const classes = [
    "poi",
    meta.major && "is-major",
    selected && "is-selected",
    !place.verified && "is-unverified",
  ]
    .filter(Boolean)
    .join(" ");
  return L.divIcon({
    className: "",
    html: `<div class="${classes}"><span class="poi-icon" style="background:${color}">${iconSvg(node, 15)}</span><span class="poi-label">${escapeHtml(place.name)}</span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

const userIcon = L.divIcon({
  className: "",
  html: '<div class="user-dot"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function padBounds(b: [LatLngTuple, LatLngTuple], pad: number): L.LatLngBounds {
  return L.latLngBounds([b[0][0] - pad, b[0][1] - pad], [b[1][0] + pad, b[1][1] + pad]);
}

/** Flies to focus requests, keeping the target above the bottom sheet. */
function FocusController({
  focus,
  campus,
  bottomInset,
}: {
  focus: MapFocus | null;
  campus: CampusInfo;
  bottomInset: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (focus.kind === "campus") {
      map.flyToBounds(campus.bounds, {
        paddingTopLeft: [16, 70],
        paddingBottomRight: [16, bottomInset + 16],
        animate,
        duration: 0.8,
      });
    } else {
      const zoom = focus.zoom ?? Math.max(map.getZoom(), 18);
      // Shift the centre down by half the sheet so the target sits in the visible area.
      const pt = map.project(focus.center, zoom).add([0, bottomInset / 2]);
      map.flyTo(map.unproject(pt, zoom), zoom, { animate, duration: 0.8 });
    }
    // Only react to new focus requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key, map]);
  return null;
}

/** Toggles label density classes on the map container as the zoom changes. */
function ZoomClasses() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const update = () => {
      const z = map.getZoom();
      el.classList.toggle("zoom-far", z < 16.5);
      el.classList.toggle("zoom-mid", z >= 16.5 && z < 17.5);
    };
    update();
    map.on("zoomend", update);
    return () => {
      map.off("zoomend", update);
    };
  }, [map]);
  return null;
}

function ClickCatcher({ onClick }: { onClick?: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (!onClick) return;
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map, onClick]);
  return null;
}

export default function MapView({
  campus,
  places,
  selectedId,
  focus,
  user,
  layer,
  bottomInset,
  onSelect,
  onMapClick,
}: MapViewProps) {
  const selected = places.find((p) => p.id === selectedId) ?? null;
  const maxBounds = useMemo(() => padBounds(campus.bounds, 0.012), [campus.bounds]);

  const markers = useMemo(
    () =>
      places
        // Majors on top of minors.
        .toSorted((a, b) => Number(CATEGORY_META[a.category].major) - Number(CATEGORY_META[b.category].major))
        .map((place) => (
          <Marker
            key={place.id}
            position={[place.lat, place.lng]}
            icon={poiIcon(place, place.id === selectedId)}
            zIndexOffset={place.id === selectedId ? 1000 : CATEGORY_META[place.category].major ? 100 : 0}
            title={place.name}
            alt={place.name}
            keyboard
            eventHandlers={{ click: () => onSelect(place.id) }}
          />
        )),
    [places, selectedId, onSelect],
  );

  const tileUrl = layer === "satellite" ? TILES.satellite : TILES.street;

  return (
    <MapContainer
      bounds={L.latLngBounds(campus.bounds)}
      boundsOptions={{ paddingTopLeft: [16, 70], paddingBottomRight: [16, bottomInset + 16] }}
      maxBounds={maxBounds}
      maxBoundsViscosity={0.9}
      minZoom={15}
      maxZoom={20}
      zoomControl={false}
      zoomSnap={0.25}
      className="h-full w-full"
    >
      <TileLayer
        key={tileUrl}
        url={tileUrl}
        attribution={layer === "satellite" ? ESRI_ATTR : OSM_ATTR}
        className={layer === "satellite" ? "" : "street-tiles"}
        maxNativeZoom={19}
        maxZoom={20}
        crossOrigin="anonymous"
      />

      {user && selected && (
        <Polyline
          positions={[
            [user.lat, user.lng],
            [selected.lat, selected.lng],
          ]}
          interactive={false}
          pathOptions={{ color: "#1a73e8", weight: 4, opacity: 0.85, dashArray: "2 9", lineCap: "round" }}
        />
      )}

      {markers}

      {user && (
        <>
          <Circle
            center={[user.lat, user.lng]}
            radius={user.accuracy}
            interactive={false}
            pathOptions={{ color: "#1a73e8", weight: 1, opacity: 0.4, fillOpacity: 0.1 }}
          />
          <Marker position={[user.lat, user.lng]} icon={userIcon} interactive={false} keyboard={false} zIndexOffset={2000} />
        </>
      )}

      <FocusController focus={focus} campus={campus} bottomInset={bottomInset} />
      <ZoomClasses />
      <ClickCatcher onClick={onMapClick} />
    </MapContainer>
  );
}
