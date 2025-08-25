// ─────────────────────────────────────────────────────────────────────────────
// File: src/color.ts
// ─────────────────────────────────────────────────────────────────────────────

import type { RGBA, ColorLike } from "./types";

/** Named colors (sRGB) → RGBA (0..255) */
export const NAMED: Readonly<Record<string, RGBA>> = Object.freeze({
  black: [0, 0, 0, 255], white: [255, 255, 255, 255], red: [255, 0, 0, 255], green: [0, 255, 0, 255],
  blue: [0, 0, 255, 255], yellow: [255, 255, 0, 255], cyan: [0, 255, 255, 255], magenta: [255, 0, 255, 255],
  gray: [128, 128, 128, 255], grey: [128, 128, 128, 255], orange: [255, 165, 0, 255],
  transparent: [0, 0, 0, 0]
});

export function clamp255(v: number): number { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }
export function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v; }

/** Parse CSS-like colors into [r,g,b,a] (0..255). Returns null if invalid. */
export function parseColor(c: ColorLike): RGBA | null {
  if (Array.isArray(c)) {
    const [r, g, b, a = 255] = c as number[];
    return [r | 0, g | 0, b | 0, a | 0];
  }
  if (typeof c !== "string") return null;
  const s = c.trim().toLowerCase();
  if (s in NAMED) return NAMED[s];

  if (s[0] === "#") {
    const hex = s.slice(1);
    const len = hex.length;
    const hx = (i: number) => parseInt(hex[i] + (len < 6 ? hex[i] : hex[i + 1] || hex[i]), 16);
    switch (len) {
      case 3: return [hx(0), hx(1), hx(2), 255];
      case 4: return [hx(0), hx(1), hx(2), hx(3)];
      case 6: return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 255];
      case 8: return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), parseInt(hex.slice(6, 8), 16)];
      default: return null;
    }
  }

  if (s.startsWith("rgb")) {
    const nums = s.match(/\d+\.?\d*/g);
    if (!nums || (nums.length !== 3 && nums.length !== 4)) return null;
    const r = clamp255(+nums[0]);
    const g = clamp255(+nums[1]);
    const b = clamp255(+nums[2]);
    const a = nums[3] == null ? 255 : (clamp01(+nums[3]) * 255 + 0.5) | 0;
    return [r, g, b, a];
  }
  return null;
}

/** Pack [r,g,b,a] → ABGR uint32 for fast TypedArray blits (little-endian). */
export function packABGR(r: number, g: number, b: number, a: number): number {
  return (a << 24) | (b << 16) | (g << 8) | r;
}

/** Unpack ABGR uint32 → [r,g,b,a] */
export function unpackABGR(px: number): RGBA {
  return [px & 255, (px >>> 8) & 255, (px >>> 16) & 255, (px >>> 24) & 255];
}

/** Canonical Porter-Duff source-over blend. Inputs are non-premultiplied 0..255. */
export function blendRGBA(dr: number, dg: number, db: number, da: number, sr: number, sg: number, sb: number, sa: number): [number, number, number, number] {
  const dna = da / 255, sna = sa / 255;
  const outA = sna + dna * (1 - sna);
  if (outA <= 0) return [0, 0, 0, 0];
  const inv = 1 - sna;
  const r = (sr * sna + dr * dna * inv) / outA;
  const g = (sg * sna + dg * dna * inv) / outA;
  const b = (sb * sna + db * dna * inv) / outA;
  return [r, g, b, outA * 255];
}

/** Normalize any color-like into RGBA (falls back to white). */
export function toColor(col: ColorLike): RGBA {
  if (Array.isArray(col)) {
    const arr: number[] = col;
    const rgba: RGBA = [
      arr[0] | 0,
      arr[1] | 0,
      arr[2] | 0,
      (arr[3] ?? 255) | 0
    ] as RGBA;
    return rgba;
  } else {
    return (parseColor(col) || NAMED.white) as RGBA;
  }
}
