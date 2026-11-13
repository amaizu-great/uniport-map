# Map of UNIPORT

An installable PWA that helps students, staff and visitors find faculties, banks, hostels and other places across the University of Port Harcourt's **Abuja**, **Choba** and **Delta** campuses. It's built to be opened by scanning QR codes posted around campus.

Built with Next.js 16 (App Router), Tailwind CSS 4, Leaflet/react-leaflet, Fuse.js and a hand-written service worker. Maps use OpenStreetMap tiles (restyled to white streets with CSS) and Esri World Imagery for satellite. There are no paid map services or API keys.

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm build && pnpm start   # production build (the service worker only registers here)
```

## How it's laid out

- **`/`**: the overview. The three campuses are drawn as 3D blue models (`components/CampusScene.tsx`, geometry in `lib/scene.ts`), with East-West Road running up the middle (Choba on the left, Abuja and Delta on the right), Aluu Road between Delta and Abuja, and the river. Tap a campus to open it. "Near me" shows your blue dot and how far you are from each campus.
- **`/campus/[campus]`**: that campus's detailed map. Streets are white (grey in dark mode), and places show as a coloured icon and name. The pin button on the right hides or shows the place icons. A draggable bottom sheet holds search and categories.
- **`/place/[slug]`**: the same map, focused on one place. Directions opens Google Maps walking directions from your location.
- It's a phone app. On screens wider than 640 px, a "made for phones" screen with a QR code to the current page replaces it (`components/PhoneOnly.tsx`, `.phone-only` in `app/globals.css`). Phones in landscape aren't blocked.
- Light/dark toggle: the sun/moon button. It's saved per device and defaults to the system setting.

## Where things live

| Path | What |
| --- | --- |
| `data/osm-places.json` | Places imported from OpenStreetMap (generated, don't hand-edit) |
| `data/places.json` | **Your edits.** Same `id` as an OSM place overrides its fields; a new `id` adds a place |
| `data/geo.json` | Campus outlines, East-West Road, river (generated) |
| `data/campuses.json` | Campus names and blurbs |
| `app/theme.css` | **All colours**, light and dark, including the 3D scene |
| `scripts/import-osm.ts` | Re-imports places, outlines and roads from OpenStreetMap |
| `app/api/places/route.ts` | `GET /api/places?campus=choba&q=enginering` |
| `public/sw.js` | Offline caching (app shell, place data, up to 500 viewed map tiles) |
| `scripts/make-qr.ts` | Generates QR PNGs |

## Place data

Places come from OpenStreetMap (© OpenStreetMap contributors, ODbL). To refresh them:

```bash
pnpm import-osm
```

If the Overpass servers are busy, `pnpm import-osm --cached` re-runs the rules on the last download (kept in `.osm-cache/`).

Every imported place is `verified: false` and shows an "Unverified" note until someone checks it.

Campuses are split by roads, not drawn boundaries:

- **East-West Road**: everything south-west of it is Choba, and everything north-east of it is Abuja or Delta.
- **Aluu Road** (the road north from the East-West Road junction towards Aluu): west of it is Delta, east of it is Abuja. That puts the staff quarters and the Lulu Briggs Health Centre in Abuja.

Loose outer limits in `scripts/import-osm.ts` (`LIMITS`) keep the surrounding town out. Campus outlines are just a hull around each campus's places that stops at those roads; they frame the map and shape the 3D models.

## Adding or verifying a place

1. Find the spot in the app's **Satellite** layer, or on the ground. Copy its `lat, lng` from Google Maps (long-press on a phone).
2. In `data/places.json`, either patch an imported place by its id:

   ```json
   { "id": "abuja-uba", "verified": true, "landmark": "Opposite the soccer field", "aliases": ["UBA ATM"] }
   ```

   or add a new one:

   ```json
   {
     "id": "choba-uba-atm",
     "name": "UBA ATM",
     "aliases": ["ATM"],
     "category": "atm",
     "campus": "choba",
     "lat": 4.89312,
     "lng": 6.90655,
     "verified": true,
     "source": "manual"
   }
   ```

   - `id` becomes `/place/<id>`, so don't change it once QR codes are printed.
   - **Never guess coordinates.** If you don't know them, use `null`. The place still shows in search as "Location coming soon".
   - `category` is one of: faculty, department, bank, atm, hostel, admin, library, health, food, worship, sports, gate, other.
   - Photos go in `public/photos/` and are referenced as `"/photos/name.jpg"`. They appear at the top of the place sheet.
3. Bump `VERSION` in `public/sw.js` so installed phones pick up the change.
4. Commit and push. Vercel redeploys automatically.

## "Report a mistake" link

Set one of these environment variables (in Vercel → Settings → Environment Variables):

- `NEXT_PUBLIC_REPORT_FORM_URL`: a Google Form URL. The place id is appended as `?place=…`.
- `NEXT_PUBLIC_REPORT_EMAIL`: an address for a prefilled `mailto:`.

If neither is set, the link opens a prefilled email with an empty recipient.

## QR codes

```bash
SITE_URL=https://your-domain.vercel.app pnpm qr
```

This writes print-ready 1200 px PNGs to `qr/` (`home.png`, `campus/*.png`, `place/*.png`). They use error-correction level Q so they still scan when slightly dirty.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel, click **Add New → Project** and import the repo. The defaults (Next.js, `pnpm build`) work as they are.
3. Optionally set `NEXT_PUBLIC_SITE_URL` to your final domain (used for Open Graph links). Without it, Vercel's production URL is used.
4. Deploy, then generate the QR codes against the production URL.

## Offline behaviour

After one online visit, the service worker has cached the app shell, the overview and the three campus pages. The 3D overview needs no network at all. Map tiles you've viewed are cached too, up to about 500 (stale-while-revalidate). An offline banner appears whenever the connection drops.
