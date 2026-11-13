/**
 * "Ocean Blue Serenity" palette. The CSS side lives in app/theme.css —
 * keep the two in sync. This file only exists for places CSS can't reach
 * (manifest, viewport theme colour, generated icons and QR codes).
 */
export const palette = {
  navy900: "#03045E",
  navy700: "#023E8A",
  blue600: "#0077B6",
  blue500: "#0096C7",
  cyan500: "#00B4D8",
  cyan400: "#48CAE4",
  cyan300: "#90E0EF",
  cyan200: "#ADE8F4",
  cyan100: "#CAF0F8",
  cyan50: "#E7FBFF",
} as const;

export const themeColor = {
  light: palette.navy900,
  dark: "#121212",
};
