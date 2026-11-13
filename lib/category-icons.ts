/**
 * Category icons (Lucide line icons, ISC licence) and their badge colours.
 * Used both as React elements (lists, chips) and as SVG strings (Leaflet map pins).
 */
import {
  BedDouble,
  BookOpen,
  Building2,
  Church,
  CreditCard,
  DoorOpen,
  GraduationCap,
  Hospital,
  Landmark,
  School,
  Shapes,
  Trophy,
  Utensils,
  type IconNode,
} from "lucide";
import type { Category } from "./types";

export interface CategoryIcon {
  node: IconNode;
  /** Badge background; the glyph is drawn white on top. */
  color: string;
}

export const CATEGORY_ICONS: Record<Category, CategoryIcon> = {
  bank: { node: Landmark, color: "#0b8043" },
  atm: { node: CreditCard, color: "#0b8043" },
  faculty: { node: School, color: "#0077b6" },
  department: { node: GraduationCap, color: "#3f51b5" },
  library: { node: BookOpen, color: "#8e24aa" },
  admin: { node: Building2, color: "#455a64" },
  health: { node: Hospital, color: "#d93025" },
  gate: { node: DoorOpen, color: "#795548" },
  hostel: { node: BedDouble, color: "#c2185b" },
  food: { node: Utensils, color: "#e8710a" },
  worship: { node: Church, color: "#00897b" },
  sports: { node: Trophy, color: "#2e9d4f" },
  other: { node: Shapes, color: "#5f6b7a" },
};

const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Serialises an icon to an SVG string (for Leaflet divIcons). */
export function iconSvg(node: IconNode, size = 16, strokeWidth = 2.25): string {
  const children = node
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k, v]) => v !== undefined && k !== "key")
        .map(([k, v]) => `${kebab(k)}="${v}"`)
        .join(" ");
      return `<${tag} ${a}/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${children}</svg>`;
}
