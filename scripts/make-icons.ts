/**
 * Generates the PWA icons and Open Graph image from an SVG logo.
 * Run: pnpm icons
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { palette } from "../lib/theme";

const out = path.join(process.cwd(), "public", "icons");
mkdirSync(out, { recursive: true });

/** Map pin with a "U" inside. `inset` shrinks it for maskable safe zones. */
function logo(size: number, { rounded = true, inset = 0 } = {}) {
  const s = 512;
  const scale = 1 - inset * 2;
  const offset = s * inset;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${palette.navy700}"/>
      <stop offset="1" stop-color="${palette.navy900}"/>
    </linearGradient>
    <linearGradient id="pin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${palette.cyan400}"/>
      <stop offset="1" stop-color="${palette.blue500}"/>
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" rx="${rounded ? 112 : 0}" fill="url(#bg)"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="M256 70c-84 0-150 64-150 146 0 104 150 236 150 236s150-132 150-236c0-82-66-146-150-146Z" fill="url(#pin)"/>
    <circle cx="256" cy="214" r="92" fill="${palette.cyan50}"/>
    <path d="M206 160v62c0 32 21 54 50 54s50-22 50-54v-62h-28v62c0 17-9 28-22 28s-22-11-22-28v-62Z" fill="${palette.navy900}"/>
  </g>
</svg>`;
}

function og() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${palette.cyan100}"/>
      <stop offset="1" stop-color="${palette.cyan300}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <g transform="translate(90 155) scale(0.625)">${logo(512).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g>
  <text x="460" y="290" font-family="Arial, Helvetica, sans-serif" font-size="84" font-weight="700" fill="${palette.navy900}">Map of UNIPORT</text>
  <text x="462" y="360" font-family="Arial, Helvetica, sans-serif" font-size="36" fill="${palette.navy700}">Abuja · Choba · Delta campuses</text>
  <text x="462" y="420" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="${palette.blue600}">Find faculties, banks, hostels and more</text>
</svg>`;
}

async function png(svg: string, file: string, size?: number) {
  let img = sharp(Buffer.from(svg));
  if (size) img = img.resize(size, size);
  await img.png({ compressionLevel: 9, palette: true }).toFile(path.join(out, file));
  console.log("wrote", file);
}

async function main() {
  await png(logo(512), "icon-512.png", 512);
  await png(logo(192), "icon-192.png", 192);
  await png(logo(512, { rounded: false, inset: 0.12 }), "maskable-512.png", 512);
  await png(logo(192, { rounded: false, inset: 0.12 }), "maskable-192.png", 192);
  await png(logo(180, { rounded: false, inset: 0.06 }), "apple-touch-icon.png", 180);
  await png(og(), "og.png");
  writeFileSync(path.join(process.cwd(), "app", "icon.svg"), logo(64));
  console.log("wrote app/icon.svg");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
