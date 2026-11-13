import type { Place } from "./types";

export const APP_NAME = "Map of UNIPORT";
export const APP_DESCRIPTION =
  "Find faculties, departments, banks, hostels and more across UNIPORT's Abuja, Choba and Delta campuses.";

/** Public site URL, used for QR codes and Open Graph links. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

/**
 * Where "Report a mistake" goes. Set NEXT_PUBLIC_REPORT_FORM_URL to a Google Form
 * (place name is appended as ?place=...), or NEXT_PUBLIC_REPORT_EMAIL for mailto.
 */
const REPORT_FORM_URL = process.env.NEXT_PUBLIC_REPORT_FORM_URL ?? "";
const REPORT_EMAIL = process.env.NEXT_PUBLIC_REPORT_EMAIL ?? "";

export function reportUrl(place: Place): string {
  const summary = `"${place.name}" (${place.id}) on the Map of UNIPORT has the wrong location or details.`;
  if (REPORT_FORM_URL) {
    const url = new URL(REPORT_FORM_URL);
    url.searchParams.set("place", place.id);
    return url.toString();
  }
  const params = new URLSearchParams({
    subject: `Map of UNIPORT: wrong location for ${place.name}`,
    body: `${summary}\n\nWhat's wrong:\n\nWhere it actually is:\n`,
  });
  return `mailto:${REPORT_EMAIL}?${params.toString().replace(/\+/g, "%20")}`;
}
