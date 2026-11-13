import { type NextRequest } from "next/server";
import { isCampus, places } from "@/lib/places";
import { createSearcher } from "@/lib/search";

const search = createSearcher(places);

/** GET /api/places?campus=choba&q=enginering */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const campus = params.get("campus");
  const q = params.get("q");

  if (campus && !isCampus(campus)) {
    return Response.json({ error: `Unknown campus "${campus}"` }, { status: 400 });
  }

  let result = q ? search(q, places.length) : places;
  if (campus) result = result.filter((p) => p.campus === campus);

  return Response.json(
    { count: result.length, places: result },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400" } },
  );
}
