import Fuse, { type IFuseOptions } from "fuse.js";
import type { Place } from "./types";
import { CATEGORY_META, campusName } from "./places";

interface SearchDoc {
  place: Place;
  name: string;
  aliases: string[];
  category: string;
  faculty: string;
  campus: string;
}

const options: IFuseOptions<SearchDoc> = {
  keys: [
    { name: "name", weight: 0.45 },
    { name: "aliases", weight: 0.3 },
    { name: "category", weight: 0.1 },
    { name: "faculty", weight: 0.1 },
    { name: "campus", weight: 0.05 },
  ],
  // Tolerant enough for typos like "enginering", strict enough to stay useful.
  threshold: 0.38,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

export function createSearcher(places: Place[]) {
  const docs: SearchDoc[] = places.map((place) => ({
    place,
    name: place.name,
    aliases: place.aliases,
    category: CATEGORY_META[place.category].label,
    faculty: place.faculty ?? "",
    campus: `${place.campus} ${campusName(place.campus)}`,
  }));
  const fuse = new Fuse(docs, options);

  return function search(query: string, limit = 12): Place[] {
    const q = query.trim();
    if (!q) return [];
    return fuse.search(q, { limit }).map((r) => r.item.place);
  };
}
