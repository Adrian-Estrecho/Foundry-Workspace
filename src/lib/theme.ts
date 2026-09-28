/**
 * Accent colour system.
 *
 * Every user can pick an accent (a preset or any hex). From that one colour we
 * derive a small set of CSS variables:
 *   --brand-h            hue, also used to tint the neutral background
 *   --tint               1 = neutrals pick up the accent hue, 0 = pure greys
 *   --brand-dark/light   the accent, lightness-clamped so it reads well on
 *                        dark and light backgrounds respectively
 *   --brand-fg-*         text colour to put on top of the accent
 * globals.css maps these onto the shadcn tokens (primary, ring, charts...).
 */

export const DEFAULT_ACCENT = "#F2711C";

export const ACCENT_PRESETS = [
  { name: "Ember", hex: "#F2711C" },
  { name: "Amber", hex: "#F5A524" },
  { name: "Teal", hex: "#14B8A6" },
  { name: "Ocean", hex: "#3B82F6" },
  { name: "Violet", hex: "#8B5CF6" },
  { name: "Magenta", hex: "#EC4899" },
] as const;

export const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_PATTERN.test(value);
}

type Oklch = { l: number; c: number; h: number };

function srgbToLinear(channel: number) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** Converts #rrggbb to OKLCH (L 0–1, C ~0–0.37, H degrees). */
export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = [1, 3, 5].map((i) => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255));

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const hue = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.sqrt(A * A + B * B), h: hue < 0 ? hue + 360 : hue };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const fmt = ({ l, c, h }: Oklch) => `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;

const TEXT_ON_LIGHT = "oklch(0.2 0.02 60)";
const TEXT_ON_DARK = "oklch(0.99 0 0)";

export type BrandTokens = Record<
  "--brand-h" | "--tint" | "--brand-dark" | "--brand-light" | "--brand-fg-dark" | "--brand-fg-light",
  string
>;

export function brandTokens(hex: string | null | undefined, tintBackground = true): BrandTokens {
  const base = hexToOklch(isHexColor(hex) ? hex : DEFAULT_ACCENT);
  const chroma = Math.min(base.c, 0.25);
  const dark = { l: clamp(base.l, 0.62, 0.84), c: chroma, h: base.h };
  const light = { l: clamp(base.l, 0.5, 0.7), c: chroma, h: base.h };
  // A near-grey accent has no meaningful hue, so don't tint neutrals with it.
  const tint = tintBackground && base.c > 0.04 ? 1 : 0;

  return {
    "--brand-h": base.h.toFixed(1),
    "--tint": String(tint),
    "--brand-dark": fmt(dark),
    "--brand-light": fmt(light),
    "--brand-fg-dark": dark.l >= 0.78 ? TEXT_ON_LIGHT : TEXT_ON_DARK,
    "--brand-fg-light": light.l >= 0.78 ? TEXT_ON_LIGHT : TEXT_ON_DARK,
  };
}

/** CSS text for a :root rule, used by <AccentStyle> during server render. */
export function brandCss(hex: string | null | undefined, tintBackground = true) {
  const tokens = brandTokens(hex, tintBackground);
  return `:root{${Object.entries(tokens)
    .map(([key, value]) => `${key}:${value}`)
    .join(";")}}`;
}

/** Applies tokens on <html> for instant preview while picking a colour. */
export function applyBrandTokens(hex: string, tintBackground: boolean) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(brandTokens(hex, tintBackground))) {
    root.style.setProperty(key, value);
  }
}

/** Drops the preview so the server-rendered <AccentStyle> applies again. */
export function clearBrandTokens() {
  const root = document.documentElement;
  for (const key of Object.keys(brandTokens(DEFAULT_ACCENT))) root.style.removeProperty(key);
}

// -----------------------------------------------------------------------------
// Light / dark mode
// -----------------------------------------------------------------------------
export type ThemeMode = "dark" | "light" | "system";
export const THEME_STORAGE_KEY = "foundry-theme";

/**
 * Inline script placed in <head> so the right mode is applied before first
 * paint (no flash). Dark is the default.
 */
export const themeInitScript = `(function(){try{var m=localStorage.getItem('${THEME_STORAGE_KEY}')||'dark';var d=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){document.documentElement.classList.add('dark');}})();`;
