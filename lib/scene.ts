/**
 * Geometry for the overview "diorama": the three campuses as raised slabs with
 * 3D blue buildings, East–West Road and the river, in a tilted isometric view.
 * Everything is derived from real coordinates in data/geo.json and the places data.
 */
import geoData from "@/data/geo.json";
import { pointInPolygon } from "./geo";
import { campuses, hasLocation, places } from "./places";
import type { Campus, Category, LatLngTuple, Place } from "./types";

export type Pt = [number, number];

// ---- projection ----

const [S, W, N, E] = geoData.bbox as [number, number, number, number];
const LAT0 = (S + N) / 2;
const LNG0 = (W + E) / 2;
const KX = Math.cos((LAT0 * Math.PI) / 180) * 111_320;
const KY = 110_540;

/**
 * Rotation of the scene (radians) and vertical squash for the tilt.
 * +65° stands East–West Road upright, with Choba on its left and Abuja + Delta on its right.
 */
const THETA = (65 * Math.PI) / 180;
const TILT = 0.58;
/** Metres → scene units. */
const UNIT = 0.16;
/** Vertical units per metre of building height (exaggerated for drama). */
const HEIGHT = 0.16;

function ground(lat: number, lng: number): Pt {
  const x = (lng - LNG0) * KX;
  const y = -(lat - LAT0) * KY;
  const rx = x * Math.cos(THETA) - y * Math.sin(THETA);
  const ry = x * Math.sin(THETA) + y * Math.cos(THETA);
  return [rx * UNIT, ry * UNIT * TILT];
}

export function project([lat, lng]: LatLngTuple): Pt {
  return ground(lat, lng);
}

/** Offset in metres (east, north) from a lat/lng, projected. */
function projectOffset([lat, lng]: LatLngTuple, east: number, north: number): Pt {
  return ground(lat + north / KY, lng + east / KX);
}

const up = ([x, y]: Pt, h: number): Pt => [x, y - h * HEIGHT];

export const toPath = (pts: Pt[], close = true) =>
  pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") + (close ? " Z" : "");

// ---- extruded prisms ----

export type Shade = "left" | "right" | "top";
export interface Face {
  d: string;
  shade: Shade;
}

/** Faces of a vertical prism over `base`, in painter's order (sides, then top). */
function prism(base: Pt[], height: number): Face[] {
  const cx = base.reduce((s, p) => s + p[0], 0) / base.length;
  const cy = base.reduce((s, p) => s + p[1], 0) / base.length;
  const faces: Face[] = [];
  base.forEach((a, i) => {
    const b = base[(i + 1) % base.length];
    let nx = b[1] - a[1];
    let ny = -(b[0] - a[0]);
    const mx = (a[0] + b[0]) / 2 - cx;
    const my = (a[1] + b[1]) / 2 - cy;
    if (nx * mx + ny * my < 0) [nx, ny] = [-nx, -ny];
    if (ny <= 0) return; // faces away from the viewer
    faces.push({ d: toPath([a, b, up(b, height), up(a, height)]), shade: nx < 0 ? "left" : "right" });
  });
  faces.push({ d: toPath(base.map((p) => up(p, height))), shade: "top" });
  return faces;
}

// ---- campuses ----

export type Tone = "base" | "alt" | "hero";

export interface SceneBuilding {
  id: string;
  name: string;
  tone: Tone;
  faces: Face[];
  /** screen-space sort key */
  depth: number;
  top: Pt;
}

export interface SceneCampus {
  id: Campus;
  name: string;
  short: string;
  slab: Face[];
  buildings: SceneBuilding[];
  /** where the floating name tag points to */
  anchor: Pt;
  tagY: number;
  delay: number;
}

const SLAB = 55; // metres of slab thickness (visual only)

const HERO: Category[] = ["admin", "library", "faculty"];
const ALT: Category[] = ["hostel", "sports", "food", "worship"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 2 ** 32;
}

const PRIORITY: Partial<Record<Category, number>> = {
  admin: 0,
  library: 0,
  bank: 1,
  faculty: 1,
  health: 1,
  hostel: 2,
  department: 2,
  sports: 3,
  food: 3,
  worship: 3,
  other: 4,
};

function pickBuildings(list: Place[], max: number, minGap: number): Place[] {
  const ranked = list
    .filter(hasLocation)
    .filter((p) => p.category !== "gate")
    .sort((a, b) => (PRIORITY[a.category] ?? 5) - (PRIORITY[b.category] ?? 5) || a.id.localeCompare(b.id));
  const chosen: Place[] = [];
  for (const p of ranked) {
    if (chosen.length >= max) break;
    const tooClose = chosen.some(
      (q) => Math.hypot((p.lat! - q.lat!) * KY, (p.lng! - q.lng!) * KX) < minGap,
    );
    if (!tooClose) chosen.push(p);
  }
  return chosen;
}

function block(id: string, name: string, at: LatLngTuple, tone: Tone, half: number, height: number): SceneBuilding {
  const footprint = [
    projectOffset(at, -half, -half),
    projectOffset(at, half, -half),
    projectOffset(at, half, half),
    projectOffset(at, -half, half),
  ].map((pt) => up(pt, SLAB)); // stand on top of the slab
  const centre = project(at);
  return { id, name, tone, faces: prism(footprint, height), depth: centre[1], top: up(centre, SLAB + height) };
}

function buildCampus(id: Campus, index: number): SceneCampus {
  const info = campuses.find((c) => c.id === id)!;
  const base = info.outline.map(project);
  const slab = prism(base, SLAB);

  const big = id === "abuja";

  // Landmarks: real mapped places, drawn taller in the hero colours.
  const landmarks = pickBuildings(places.filter((p) => p.campus === id), big ? 16 : 7, big ? 95 : 60);
  const buildings: SceneBuilding[] = landmarks.map((p) => {
    const r = hash(p.id);
    const tone: Tone = HERO.includes(p.category) ? "hero" : ALT.includes(p.category) ? "alt" : "base";
    return block(p.id, p.name, [p.lat!, p.lng!], tone, (tone === "hero" ? 40 : 30) + r * 10, (tone === "hero" ? 170 : 110) + r * 90);
  });

  // Filler: low-rise blocks on a jittered grid so the whole campus reads as built-up.
  const step = big ? 92 : 68;
  const [[s0, w0], [n0, e0]] = info.bounds;
  for (let lat = s0; lat <= n0; lat += step / KY) {
    for (let lng = w0; lng <= e0; lng += step / KX) {
      const key = `${id}-${lat.toFixed(5)}-${lng.toFixed(5)}`;
      const r = hash(key);
      if (r < 0.22) continue; // leave some open ground
      const at: LatLngTuple = [lat + ((hash(key + "y") - 0.5) * step * 0.35) / KY, lng + ((hash(key + "x") - 0.5) * step * 0.35) / KX];
      const half = 16 + r * 12;
      const corners: LatLngTuple[] = [
        [at[0] - (half + 12) / KY, at[1] - (half + 12) / KX],
        [at[0] - (half + 12) / KY, at[1] + (half + 12) / KX],
        [at[0] + (half + 12) / KY, at[1] + (half + 12) / KX],
        [at[0] + (half + 12) / KY, at[1] - (half + 12) / KX],
      ];
      if (!corners.every(([la, ln]) => pointInPolygon({ lat: la, lng: ln }, info.outline))) continue;
      const nearLandmark = landmarks.some(
        (p) => Math.hypot((p.lat! - at[0]) * KY, (p.lng! - at[1]) * KX) < (big ? 70 : 52),
      );
      if (nearLandmark) continue;
      buildings.push(block(key, "", at, r > 0.7 ? "alt" : "base", half, 40 + hash(key + "h") * 55));
    }
  }
  buildings.sort((a, b) => a.depth - b.depth);

  const centre = project(info.center);
  const anchor = up(centre, SLAB);
  // Float the tag a little above the tallest landmark, directly over the campus centre.
  const tallest = Math.max(0, ...landmarks.map((p) => anchor[1] - buildings.find((b) => b.id === p.id)!.top[1]));
  return {
    id,
    name: info.name,
    short: info.short,
    slab,
    buildings,
    anchor,
    tagY: anchor[1] - Math.min(tallest, 300 * HEIGHT) - 10,
    delay: index * 140,
  };
}

// ---- roads, river, ground ----

export interface SceneLine {
  name: string;
  d: string;
  major: boolean;
}

function line(points: LatLngTuple[]): Pt[] {
  const pts = points.map(project);
  // Keep labels upright: run left → right.
  return pts[0][0] > pts[pts.length - 1][0] ? pts.reverse() : pts;
}

export interface Scene {
  viewBox: [number, number, number, number];
  /** Scene units per CSS pixel at a ~380px-wide phone; scale text and strokes by this. */
  k: number;
  ground: Face[];
  roads: SceneLine[];
  river: SceneLine | null;
  campuses: SceneCampus[];
}

function buildScene(): Scene {
  const order: Campus[] = ["delta", "abuja", "choba"];
  // Paint back (top of the screen) to front.
  const sceneCampuses = order.map(buildCampus).sort((a, b) => a.anchor[1] - b.anchor[1]);

  // Ground: a floating tile just around the campuses.
  const all = campuses.flatMap((c) => c.outline);
  const M = 0.0022;
  const gs = Math.min(...all.map((p) => p[0])) - M;
  const gn = Math.max(...all.map((p) => p[0])) + M;
  const gw = Math.min(...all.map((p) => p[1])) - M;
  const ge = Math.max(...all.map((p) => p[1])) + M;
  const corners = [project([gn, gw]), project([gn, ge]), project([gs, ge]), project([gs, gw])];
  // Frame the campuses (plus room for the floating tags).
  const pts = sceneCampuses.flatMap((c) => [
    ...c.slab.flatMap((f) => parsePath(f.d)),
    ...c.buildings.flatMap((b) => b.faces.flatMap((f) => parsePath(f.d))),
    [c.anchor[0], c.tagY - 30] as Pt,
  ]).concat(corners, corners.map(([x, y]) => [x, y + 18 * HEIGHT] as Pt));
  const minX = Math.min(...pts.map((p) => p[0])) - 8;
  const maxX = Math.max(...pts.map((p) => p[0])) + 8;
  const minY = Math.min(...pts.map((p) => p[1])) - 10;
  const maxY = Math.max(...pts.map((p) => p[1])) + 8;

  const groundFaces = prism(corners, 18).map((f) => ({ ...f, d: f.d }));
  // prism() puts the top last; shift the whole tile down so its top sits at y=0 ground level.
  const ground = groundFaces.map((f) => ({ ...f, d: shiftPath(f.d, 18 * HEIGHT) }));

  const roads = (geoData.roads as { name: string; major: boolean; points: LatLngTuple[] }[])
    .filter((r) => r.points?.length > 1)
    .map((r) => ({ name: r.name, major: r.major, d: toPath(line(r.points), false) }));

  const riverData = geoData.river as { name: string; points: LatLngTuple[] } | null;
  const river = riverData?.points?.length
    ? { name: riverData.name, major: false, d: toPath(line(riverData.points), false) }
    : null;

  return {
    viewBox: [minX, minY, maxX - minX, maxY - minY],
    k: (maxX - minX) / 380,
    ground,
    roads,
    river,
    campuses: sceneCampuses,
  };
}

function parsePath(d: string): Pt[] {
  return [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

function shiftPath(d: string, dy: number): string {
  return d.replace(/([ML])(-?[\d.]+) (-?[\d.]+)/g, (_, c, x, y) => `${c}${x} ${(Number(y) + dy).toFixed(1)}`);
}

export const scene: Scene = buildScene();
