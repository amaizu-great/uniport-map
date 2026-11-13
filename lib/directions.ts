import type { LatLng } from "./geo";

export type { LatLng };

/** Google Maps walking directions to `destination`, from `origin` if known. */
export function directionsUrl(destination: LatLng, origin?: LatLng | null): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "walking",
  });
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
