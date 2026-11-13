import osmPlaces from "@/data/osm-places.json";
import manualPlaces from "@/data/places.json";
import campusesData from "@/data/campuses.json";
import geoData from "@/data/geo.json";
import type { Campus, CampusInfo, Category, LatLngTuple, MappedPlace, Place } from "./types";

// ---------- places ----------

type PlacePatch = Partial<Place> & { id: string };

/**
 * OSM imports merged with hand edits. An entry in data/places.json with the same id
 * as an OSM place overrides its fields; entries with new ids are added as-is.
 */
function mergePlaces(): Place[] {
  const byId = new Map<string, Place>();
  for (const p of osmPlaces as Place[]) byId.set(p.id, p);
  for (const patch of manualPlaces as PlacePatch[]) {
    const base = byId.get(patch.id);
    if (base) byId.set(patch.id, { ...base, ...patch, aliases: patch.aliases ?? base.aliases });
    else byId.set(patch.id, { aliases: [], verified: false, lat: null, lng: null, ...patch } as Place);
  }
  return [...byId.values()];
}

export const places: Place[] = mergePlaces();

export function getPlace(slug: string): Place | undefined {
  return places.find((p) => p.id === slug);
}

export function hasLocation(place: Place): place is MappedPlace {
  return typeof place.lat === "number" && typeof place.lng === "number";
}

export function placesIn(campus: Campus): Place[] {
  return places.filter((p) => p.campus === campus);
}

// ---------- campuses ----------

const outlines = geoData.campuses as Record<Campus, LatLngTuple[]>;

function boundsOf(ring: LatLngTuple[]): [LatLngTuple, LatLngTuple] {
  const lats = ring.map((p) => p[0]);
  const lngs = ring.map((p) => p[1]);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}

export const campuses: CampusInfo[] = campusesData.campuses.map((c) => {
  const id = c.id as Campus;
  // Outlines stop at the dividing roads (East–West Road, Aluu Road); see scripts/import-osm.ts.
  const outline = outlines[id];
  // Frame the map on the outline plus any hand-added place just outside it (e.g. a gate on the road).
  const pts = places.filter((p) => p.campus === id && hasLocation(p)).map((p) => [p.lat, p.lng] as LatLngTuple);
  const bounds = boundsOf([...outline, ...pts]);
  return {
    ...c,
    id,
    outline,
    bounds,
    center: [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2],
  };
});

export const CAMPUS_IDS = campuses.map((c) => c.id);

export function isCampus(value: string): value is Campus {
  return (CAMPUS_IDS as string[]).includes(value);
}

export function getCampus(id: Campus): CampusInfo {
  return campuses.find((c) => c.id === id)!;
}

export function campusName(id: Campus): string {
  return getCampus(id).name;
}

// ---------- categories ----------

export interface CategoryMeta {
  label: string;
  plural: string;
  /** Shown with a label at medium zoom; others only when zoomed right in. */
  major: boolean;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  bank: { label: "Bank", plural: "Banks", major: true },
  atm: { label: "ATM", plural: "ATMs", major: true },
  faculty: { label: "Faculty", plural: "Faculties", major: true },
  library: { label: "Library", plural: "Libraries", major: true },
  admin: { label: "Admin", plural: "Admin", major: true },
  health: { label: "Health", plural: "Health", major: true },
  gate: { label: "Gate", plural: "Gates", major: true },
  department: { label: "Department", plural: "Departments", major: false },
  hostel: { label: "Hostel", plural: "Hostels", major: false },
  food: { label: "Food", plural: "Food", major: false },
  worship: { label: "Worship", plural: "Worship", major: false },
  sports: { label: "Sports", plural: "Sports", major: false },
  other: { label: "Place", plural: "Other", major: false },
};

/** Filter chips. "Banks" covers banks and ATMs. */
export interface FilterChip {
  id: string;
  label: string;
  /** Category whose icon represents the chip. */
  icon: Category;
  categories: Category[];
}

export const FILTER_CHIPS: FilterChip[] = [
  { id: "bank", label: "Banks", icon: "bank", categories: ["bank", "atm"] },
  { id: "faculty", label: "Faculties", icon: "faculty", categories: ["faculty"] },
  { id: "department", label: "Departments", icon: "department", categories: ["department"] },
  { id: "hostel", label: "Hostels", icon: "hostel", categories: ["hostel"] },
  { id: "food", label: "Food", icon: "food", categories: ["food"] },
  { id: "library", label: "Library", icon: "library", categories: ["library"] },
  { id: "admin", label: "Admin", icon: "admin", categories: ["admin"] },
  { id: "health", label: "Health", icon: "health", categories: ["health"] },
  { id: "worship", label: "Worship", icon: "worship", categories: ["worship"] },
  { id: "sports", label: "Sports", icon: "sports", categories: ["sports"] },
  { id: "gate", label: "Gates", icon: "gate", categories: ["gate"] },
  { id: "other", label: "Other", icon: "other", categories: ["other"] },
];

/** Returns a predicate for the selected chip ids (empty selection = everything). */
export function categoryFilter(chipIds: string[]): (p: Place) => boolean {
  if (chipIds.length === 0) return () => true;
  const allowed = new Set(FILTER_CHIPS.filter((c) => chipIds.includes(c.id)).flatMap((c) => c.categories));
  return (p) => allowed.has(p.category);
}
