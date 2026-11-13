/**
 * Generates print-ready QR code PNGs for every campus and place into qr/.
 * Run: SITE_URL=https://your-domain pnpm qr
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import { campuses, places } from "../lib/places";
import { palette } from "../lib/theme";

const base = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
if (!base) {
  console.error("Set SITE_URL to the deployed address, e.g. SITE_URL=https://uniport-map.vercel.app pnpm qr");
  process.exit(1);
}

const outDir = path.join(process.cwd(), "qr");
const options: QRCode.QRCodeToFileOptions = {
  type: "png",
  width: 1200, // ~10 cm at 300 dpi
  margin: 4,
  errorCorrectionLevel: "Q", // survives a little dirt and weather
  color: { dark: palette.navy900, light: "#FFFFFF" },
};

async function make(dir: string, name: string, urlPath: string) {
  const target = path.join(outDir, dir);
  mkdirSync(target, { recursive: true });
  const url = `${base}${urlPath}`;
  await QRCode.toFile(path.join(target, `${name}.png`), url, options);
  console.log(`${dir}/${name}.png → ${url}`);
}

async function main() {
  await make(".", "home", "/");
  for (const c of campuses) await make("campus", c.id, `/campus/${c.id}`);
  for (const p of places) await make("place", p.id, `/place/${p.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
