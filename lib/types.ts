export type Campus = "abuja" | "choba" | "delta";

export type Category =
  | "faculty"
  | "department"
  | "bank"
  | "atm"
  | "hostel"
  | "admin"
  | "library"
  | "health"
  | "food"
  | "worship"
  | "sports"
  | "gate"
  | "other";

export interface Place {
  /** slug, e.g. "choba-first-bank" */
  id: string;
  name: string;
  /** nicknames students use */
  aliases: string[];
  category: Category;
  campus: Campus;
  /** for departments */
  faculty?: string;
  lat: number | null;
  lng: number | null;
  description?: string;
  /** e.g. "opposite the main library" */
  landmark?: string;
  photo?: string;
  /** false until checked on the ground */
  verified: boolean;
  /** where the entry came from; "osm" entries were imported automatically */
  source?: "osm" | "manual";
  osmId?: string;
}

export type LatLngTuple = [number, number];

export interface CampusInfo {
  id: Campus;
  name: string;
  short: string;
  blurb: string;
  /** campus outline, [lat, lng] ring */
  outline: LatLngTuple[];
  center: LatLngTuple;
  /** [[south, west], [north, east]] */
  bounds: [LatLngTuple, LatLngTuple];
}

/** A place whose coordinates are known. */
export type MappedPlace = Place & { lat: number; lng: number };

export type CampusFilter = Campus | "all";
