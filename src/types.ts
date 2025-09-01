// ─────────────────────────────────────────────────────────────────────────────
// File: src/types.ts
// ─────────────────────────────────────────────────────────────────────────────

export type RGBA = readonly [number, number, number, number];

export type ColorLike = RGBA | string | number[];

export interface Vec2Like { x: number; y: number }

export interface Rect { x: number; y: number; width: number; height: number }

export interface WorldBounds { xMin: number; xMax: number; yMin: number; yMax: number }

export type ViewportRect = { x: number; y: number; width: number; height: number };