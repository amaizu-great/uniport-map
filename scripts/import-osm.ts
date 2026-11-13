/**
 * Imports named places, campus outlines and the main roads from OpenStreetMap.
 *
 *   pnpm import-osm            # fetch fresh data
 *   pnpm import-osm --cached   # reuse the last download (.osm-cache/), e.g. after tweaking the rules below
 *
 * Writes:
 *   data/osm-places.json — every named place we could categorise, all `verified: false`
 *   data/geo.json        — campus outlines, East–West Road and other roads/river for the overview scene
 *
 * Hand-edited entries in data/places.json override OSM entries with the same id,
 * so re-running this never loses your verified edits.
 * Data © OpenStreetMap contributors, ODbL.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Campus, Category, Place } from "../lib/types";

/** Public Overpass servers, tried in turn when one is busy. */
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
/** Scene extent: [south, west, north, east] */
const BBOX = [4.884, 6.897, 4.914, 6.932] as const;
const CHOBA_PARK_REL = 10720689;
const DELTA_PARK_REL = 19306562;
/**
 * Campuses are split by roads, not drawn boundaries:
 *  - East–West Road: Choba is south-west of it, Abuja and Delta north-east.
 *  - The road heading north from the East–West Road junction towards Aluu: Delta is west of it, Abuja east.
 */
const EAST_WEST_WAYS = [832956096, 354327664]; // F103, northern carriageway
const ALUU_ROAD_WAYS = [560627356, 374446594]; // junction → Rumuokoro–Rumu–Ahunwa Road
/** Loose outer limits so nearby town (Aluu, Choba village) isn't swept in. */
const LIMITS = { abuja: { north: 4.9115, east: 6.9285 }, delta: { north: 4.906, west: 6.9 } };

type LatLng = [number, number];
interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  members?: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[];
}

const CACHE_DIR = path.join(process.cwd(), ".osm-cache");

async function overpass(query: string): Promise<OsmElement[]> {
  const file = path.join(CACHE_DIR, createHash("sha1").update(query).digest("hex").slice(0, 12) + ".json");
  if (process.argv.includes("--cached") && existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const elements = await fetchOverpass(query);
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(elements));
  return elements;
}

async function fetchOverpass(query: string, attempts = 7): Promise<OsmElement[]> {
  for (let i = 0, wait = 5_000; ; i++, wait *= 2) {
    const url = OVERPASS[i % OVERPASS.length];
    const res = await fetch(url, {
      signal: AbortSignal.timeout(120_000),
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "uniport-map-import" },
      body: new URLSearchParams({ data: query }),
    }).catch((err: Error) => {
      if (i >= attempts - 1) throw err;
      console.log(`Overpass ${new URL(url).host} failed (${err.message}), trying again…`);
      return null;
    });
    if (!res) continue;
    if (res.ok) return (await res.json()).elements;
    // The public server asks clients to back off when it is at capacity.
    if ((res.status === 429 || res.status >= 500) && i < attempts - 1) {
      console.log(`Overpass busy (${res.status} from ${new URL(url).host}), retrying in ${wait / 1000}s…`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`Overpass ${res.status}: ${await res.text()}`);
  }
}

const r5 = (n: number) => Math.round(n * 1e5) / 1e5;

// ---------- geometry helpers ----------

function joinRing(segments: LatLng[][]): LatLng[] {
  const segs = segments.map((s) => [...s]);
  const ring = segs.shift() ?? [];
  const same = (a: LatLng, b: LatLng) => a[0] === b[0] && a[1] === b[1];
  while (segs.length) {
    const end = ring[ring.length - 1];
    const i = segs.findIndex((s) => same(s[0], end) || same(s[s.length - 1], end));
    if (i < 0) break;
    const [s] = segs.splice(i, 1);
    ring.push(...(same(s[0], end) ? s : s.reverse()).slice(1));
  }
  return ring;
}

function pointInPolygon([lat, lng]: LatLng, poly: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function convexHull(points: LatLng[]): LatLng[] {
  const pts = [...points].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const cross = (o: LatLng, a: LatLng, b: LatLng) =>
    (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);
  const lower: LatLng[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: LatLng[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Push every hull vertex outward from the centroid by `pad` degrees. */
function inflate(poly: LatLng[], pad: number): LatLng[] {
  const c: LatLng = [
    poly.reduce((s, p) => s + p[0], 0) / poly.length,
    poly.reduce((s, p) => s + p[1], 0) / poly.length,
  ];
  return poly.map(([lat, lng]) => {
    const d = Math.hypot(lat - c[0], lng - c[1]) || 1;
    return [r5(lat + ((lat - c[0]) / d) * pad), r5(lng + ((lng - c[1]) / d) * pad)];
  });
}

function simplify(points: LatLng[], tolerance: number): LatLng[] {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points[points.length - 1]];
  let max = 0;
  let idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const len = Math.hypot(b[1] - a[1], b[0] - a[0]);
    // Closed rings start and end on the same point: fall back to distance from it.
    const d = len
      ? Math.abs((b[1] - a[1]) * (a[0] - p[0]) - (a[1] - p[1]) * (b[0] - a[0])) / len
      : Math.hypot(p[0] - a[0], p[1] - a[1]);
    if (d > max) [max, idx] = [d, i];
  }
  if (max <= tolerance) return [a, b];
  return simplify(points.slice(0, idx + 1), tolerance).slice(0, -1).concat(simplify(points.slice(idx), tolerance));
}

const inBox = ([lat, lng]: LatLng, pad = 0) =>
  lat >= BBOX[0] - pad && lat <= BBOX[2] + pad && lng >= BBOX[1] - pad && lng <= BBOX[3] + pad;

/** Keep the longest run of consecutive points inside the scene box. */
function clip(line: LatLng[]): LatLng[] {
  let best: LatLng[] = [];
  let cur: LatLng[] = [];
  for (const p of line) {
    if (inBox(p, 0.002)) cur.push(p);
    else {
      if (cur.length > best.length) best = cur;
      cur = [];
    }
  }
  return (cur.length > best.length ? cur : best).map(([a, b]) => [r5(a), r5(b)]);
}

// ---------- categorisation ----------

const SKIP =
  /staff quart|staff quat|compound|house \d|^house|self-contain|under construction|^shops?$|generator|power ?house|power store|public conv|toilet|muster|security|car ?park|carport|^osc$|loading point|^a house$|estate|hilton|suite|guest house|mortuary|upth|teaching hospital|court|indomie|market|motors|filling station|^uniport$|recycl|zarakoza|keygitte|etisalat|icon mobile/i;

function categorise(t: Record<string, string>): Category | null {
  const name = t.name ?? "";
  const kind = [t.amenity, t.building, t.shop, t.office, t.leisure, t.landuse, t.tourism, t.healthcare]
    .filter(Boolean)
    .join(" ");
  if (/\bgate\b/i.test(name) || t.barrier === "gate") return "gate";
  if (t.amenity === "atm") return "atm";
  if (t.amenity === "bank" || /\bbank\b|micro ?finance|flex hub/i.test(name)) return /atm/i.test(name) ? "atm" : "bank";
  if (/library/i.test(name) || t.amenity === "library") return "library";
  if (/faculty|college of|school of|institute|centre of excellence|center of excellence/i.test(name)) return "faculty";
  if (/dep(artmen)?t\.?|dpt/i.test(name)) return "department";
  if (/lecture|theatre|auditorium/i.test(name)) return "other";
  if (/hostel|bostel|jaja hall|mandela block|lodge/i.test(name) || /hostel|dormitory/.test(kind))
    return "hostel";
  if (/health|clinic|medical cent/i.test(name) || /clinic|hospital|doctors|pharmacy/.test(kind)) return "health";
  if (/restaurant|fast_food|cafe|food_court|bakery|supermarket|convenience/.test(kind) || /kitchen|food|shawarma|shawama|eatery|joint|bakery|mall/i.test(name))
    return "food";
  if (/church|chapel|mosque|fellowship|place_of_worship|religio/i.test(kind + " " + name) || /\bcss hall\b|chaplain|sucf|scm sec/i.test(name))
    return "worship";
  if (/pitch|stadium|sports_centre|swimming_pool|grandstand|track/.test(kind) || /sport|stadium|field|court|pool|arena field|cricket|volleyball|basketball|tennis/i.test(name))
    return "sports";
  if (/senate|admission|students affairs|administrat|bursary|registry|vice.?chancellor/i.test(name) || /administrative|government/.test(kind))
    return "admin";
  if (/lecture|theatre|auditorium|hall|museum|gallery|studio|lab|laborator|centre|center|press|radio|ict|workshop|convocation|building|annex|anex|book/i.test(name))
    return "other";
  return null;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function tidyName(name: string) {
  const cleaned = name.replace(/[••]/g, "").replace(/\s+/g, " ").replace(/\s,/g, ",").trim();
  // Title-case names that were typed in all lower or all upper case.
  if (cleaned === cleaned.toLowerCase() || cleaned === cleaned.toUpperCase()) {
    return cleaned.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bUba\b/, "UBA");
  }
  // Capitalise stray lower-case words ("science Workshop"), leaving small joining words alone.
  const small = new Set(["of", "and", "the", "for", "in", "on", "at", "to"]);
  return cleaned.replace(/\b[a-z][a-z]+\b/g, (word, offset: number) =>
    offset > 0 && small.has(word) ? word : word[0].toUpperCase() + word.slice(1),
  );
}

// ---------- main ----------

async function main() {
  const [s, w, n, e] = BBOX;
  console.log("Fetching campus outlines and roads…");
  const geo = await overpass(`[out:json][timeout:90];
    (
      relation(${CHOBA_PARK_REL}); relation(${DELTA_PARK_REL});
      way(id:${[...EAST_WEST_WAYS, ...ALUU_ROAD_WAYS].join(",")});
      way["highway"~"^(trunk|primary|secondary|tertiary)$"](${s},${w},${n},${e});
      way["waterway"="river"](${s - 0.01},${w - 0.01},${n},${e});
    );
    out geom;`);

  const ringOf = (relId: number): LatLng[] => {
    const rel = geo.find((x) => x.type === "relation" && x.id === relId);
    const outers = (rel?.members ?? [])
      .filter((m) => m.type === "way" && m.role !== "inner" && m.geometry)
      .map((m) => m.geometry!.map((g) => [g.lat, g.lon] as LatLng));
    return simplify(joinRing(outers), 0.00004).map(([a, b]) => [r5(a), r5(b)]);
  };
  const choba = ringOf(CHOBA_PARK_REL);
  const delta = ringOf(DELTA_PARK_REL);

  const lineOf = (el: OsmElement) => (el.geometry ?? []).map((g) => [g.lat, g.lon] as LatLng);
  const ways = geo.filter((x) => x.type === "way");

  // One carriageway of East–West Road is enough for the scene.
  const eastWest = ways
    .filter((x) => /east\s*-?\s*west/i.test(x.tags?.name ?? ""))
    .map((x) => clip(lineOf(x)))
    .sort((a, b) => b.length - a.length)[0];
  const wayLine = (ids: number[]) => ids.flatMap((id) => lineOf(ways.find((w) => w.id === id)!));
  const dedupe = (pts: LatLng[]) => pts.filter((q, i) => i === 0 || q[0] !== pts[i - 1][0] || q[1] !== pts[i - 1][1]);
  // East–West Road runs west→east with longitude always increasing, so lat = f(lng).
  const ewLine = dedupe(wayLine(EAST_WEST_WAYS).sort((a, b) => a[1] - b[1]));
  // Aluu Road runs south→north, so lng = g(lat).
  const aluuLine = dedupe(wayLine(ALUU_ROAD_WAYS).sort((a, b) => a[0] - b[0]));
  const interp = (line: LatLng[], key: 0 | 1, x: number) => {
    const other = key === 0 ? 1 : 0;
    if (x <= line[0][key]) return line[0][other];
    for (let i = 1; i < line.length; i++) {
      const [a, b] = [line[i - 1], line[i]];
      if (x <= b[key]) return a[other] + ((x - a[key]) / (b[key] - a[key] || 1)) * (b[other] - a[other]);
    }
    return line[line.length - 1][other];
  };
  const ewLatAt = (lng: number) => interp(ewLine, 1, lng);
  const aluuLngAt = (lat: number) => interp(aluuLine, 0, lat);
  const northOfEastWest = ([lat, lng]: LatLng) => lat > ewLatAt(lng);
  const westOfAluu = ([lat, lng]: LatLng) => lng < aluuLngAt(lat);
  const river = ways
    .filter((x) => x.tags?.waterway === "river")
    .map((x) => clip(lineOf(x)))
    .sort((a, b) => b.length - a.length)[0];

  console.log("Fetching named places…");
  const named = await overpass(`[out:json][timeout:90];
    (
      nwr["name"]["highway"!~"."](${s},${w},${n},${e});
      node["amenity"="atm"](${s},${w},${n},${e});
    );
    out tags center;`);

  const nearEdge = ([lat, lng]: LatLng, poly: LatLng[], max: number) =>
    poly.some((q, i) => {
      const r = poly[(i + 1) % poly.length];
      const [dy, dx] = [r[0] - q[0], r[1] - q[1]];
      const len2 = dy * dy + dx * dx || 1;
      const k = Math.max(0, Math.min(1, ((lat - q[0]) * dy + (lng - q[1]) * dx) / len2));
      return Math.hypot(lat - (q[0] + k * dy), lng - (q[1] + k * dx)) < max;
    });
  const campusOf = (p: LatLng): Campus | null => {
    const [lat, lng] = p;
    if (!northOfEastWest(p)) return pointInPolygon(p, choba) || nearEdge(p, choba, 0.0006) ? "choba" : null;
    if (westOfAluu(p))
      return pointInPolygon(p, delta) || (lat <= LIMITS.delta.north && lng >= LIMITS.delta.west) ? "delta" : null;
    return lat <= LIMITS.abuja.north && lng <= LIMITS.abuja.east ? "abuja" : null;
  };

  // Gates sit on the campus edge, so assign them by name instead.
  const gateCampus = (name: string): Campus | null =>
    /choba/i.test(name) ? "choba" : /delta|unipark/i.test(name) ? "delta" : /abuja/i.test(name) ? "abuja" : null;

  const places: Place[] = [];
  const seen = new Map<string, number>();
  const pointsBy: Record<Campus, LatLng[]> = { abuja: [], choba: [], delta: [] };

  for (const el of named) {
    const t = el.tags ?? {};
    if (!t.name && t.amenity !== "atm") continue;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;
    const pt: LatLng = [lat, lng];
    const name = tidyName(t.name ?? `${t.operator ?? ""} ATM`.trim());
    if (SKIP.test(name)) continue;
    const category = categorise({ ...t, name });
    if (!category) continue;
    const campus = (category === "gate" && gateCampus(name)) || campusOf(pt);
    if (!campus) continue;
    pointsBy[campus].push(pt);

    // Merge duplicates (same name on the same campus, e.g. several "PGD Hostel" blocks).
    const key = `${campus}|${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.set(key, places.length);

    let id = `${campus}-${slugify(name)}`;
    if (places.some((p) => p.id === id)) id = `${id}-${el.id}`;
    places.push({
      id,
      name,
      aliases: [],
      category,
      campus,
      lat: r5(lat),
      lng: r5(lng),
      verified: false,
      source: "osm",
      osmId: `${el.type}/${el.id}`,
    });
  }

  // Outlines (for the 3D overview and map framing): a hull around each campus's places that
  // reaches right up to the dividing roads, and never crosses them.
  const EDGE = 0.0004; // ~45 m back from the road centre line, so the road stays visible in the 3D overview
  const ewEdge = (from: number, to: number, side: 1 | -1) =>
    ewLine.filter(([, lng]) => lng >= from && lng <= to).map(([lat, lng]) => [lat + side * EDGE, lng] as LatLng);
  const aluuEdge = (to: number, side: 1 | -1) =>
    aluuLine.filter(([lat]) => lat <= to).map(([lat, lng]) => [lat, lng + side * EDGE] as LatLng);
  const outline = (pts: LatLng[], keep: (p: LatLng) => LatLng) =>
    simplify(convexHull(pts).map(keep), 0.00003).map(([x, y]) => [r5(x), r5(y)] as LatLng);
  const junction: LatLng = aluuLine[0];

  const abujaPts = inflate(convexHull(pointsBy.abuja), 0.0005);
  const abujaEast = Math.max(...abujaPts.map((q) => q[1]));
  const abujaNorth = Math.max(...abujaPts.map((q) => q[0]));
  const abuja = outline(
    [...abujaPts, ...ewEdge(junction[1], abujaEast, 1), ...aluuEdge(abujaNorth, 1)],
    (q) => {
      let [lat, lng] = q;
      lat = Math.max(lat, ewLatAt(lng) + EDGE);
      lng = Math.max(lng, aluuLngAt(lat) + EDGE);
      return [lat, lng];
    },
  );

  const deltaPts = [...delta, ...inflate(convexHull(pointsBy.delta), 0.0003)];
  const deltaWest = Math.min(...deltaPts.map((q) => q[1]));
  const deltaNorth = Math.max(...deltaPts.map((q) => q[0]));
  const deltaOutline = outline(
    [...deltaPts, ...ewEdge(deltaWest, junction[1], 1), ...aluuEdge(deltaNorth, -1)],
    (q) => {
      let [lat, lng] = q;
      lat = Math.max(lat, ewLatAt(lng) + EDGE);
      lng = Math.min(lng, aluuLngAt(lat) - EDGE);
      return [lat, lng];
    },
  );

  const chobaPts = [...choba, ...inflate(convexHull(pointsBy.choba), 0.0003)];
  const chobaWest = Math.min(...chobaPts.map((q) => q[1]));
  const chobaEast = Math.max(...chobaPts.map((q) => q[1]));
  const chobaOutline = outline([...chobaPts, ...ewEdge(chobaWest, chobaEast, -1)], (q) => [
    Math.min(q[0], ewLatAt(q[1]) - EDGE),
    q[1],
  ]);
  places.sort((a, b) => a.campus.localeCompare(b.campus) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const dataDir = path.join(process.cwd(), "data");
  writeFileSync(path.join(dataDir, "osm-places.json"), JSON.stringify(places, null, 2) + "\n");
  writeFileSync(
    path.join(dataDir, "geo.json"),
    JSON.stringify(
      {
        _comment:
          "Generated by scripts/import-osm.ts from OpenStreetMap (© OpenStreetMap contributors, ODbL). Campuses are split by East–West Road and Aluu Road; outlines are hulls around each campus's places that stop at those roads.",
        bbox: BBOX,
        campuses: { abuja, choba: chobaOutline, delta: deltaOutline },
        roads: [
          { name: "East–West Road", major: true, points: eastWest },
          { name: "Aluu Road", major: false, points: simplify(aluuLine, 0.00004).map(([x, y]) => [r5(x), r5(y)]) },
        ],
        river: river?.length ? { name: "New Calabar River", points: simplify(river, 0.00005) } : null,
      },
      null,
      1,
    ) + "\n",
  );

  const counts = places.reduce<Record<string, number>>((acc, p) => {
    acc[`${p.campus}/${p.category}`] = (acc[`${p.campus}/${p.category}`] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Wrote ${places.length} places`, counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
