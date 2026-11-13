import type { LatLngTuple } from "./types";

export interface LatLng {
  lat: number;
  lng: number;
}

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distance(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function pointInPolygon({ lat, lng }: LatLng, poly: LatLngTuple[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Metres from a point to the nearest edge of a polygon (0 if inside). */
export function distanceToPolygon(p: LatLng, poly: LatLngTuple[]): number {
  if (pointInPolygon(p, poly)) return 0;
  // Work in a local flat projection; fine at campus scale.
  const kx = Math.cos(rad(p.lat)) * 111_320;
  const ky = 110_540;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ax = (a[1] - p.lng) * kx;
    const ay = (a[0] - p.lat) * ky;
    const bx = (b[1] - p.lng) * kx;
    const by = (b[0] - p.lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

/** Walking time at ~4.8 km/h. */
export function formatWalk(m: number): string {
  const min = Math.max(1, Math.round(m / 80));
  return min < 60 ? `${min} min walk` : `${Math.floor(min / 60)} h ${min % 60} min walk`;
}

/** Convex hull of [lat, lng] points (monotone chain). */
export function convexHull(points: LatLngTuple[]): LatLngTuple[] {
  const pts = [...points].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  if (pts.length < 3) return pts;
  const cross = (o: LatLngTuple, a: LatLngTuple, b: LatLngTuple) =>
    (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);
  const half = (list: LatLngTuple[]) => {
    const out: LatLngTuple[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return half(pts).concat(half([...pts].reverse()));
}
