
// ─────────────────────────────────────────────────────────────────────────────
// File: src/raster.ts
// ─────────────────────────────────────────────────────────────────────────────

import { V2 } from "./v2";
import { toColor, blendRGBA } from "./color";
import { CanvasRenderer } from "./renderer";

export function rawLine(app: CanvasRenderer, p0: V2, p1: V2, color: Readonly<[number, number, number, number]>): void {
  const col = color;
  let x0 = Math.round(p0.x), y0 = Math.round(p0.y);
  const x1 = Math.round(p1.x), y1 = Math.round(p1.y);

  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  const buf = app.buffer;
  while (true) {
    buf.putPixelBlend(x0, y0, col);
    if (x0 === x1 && y0 === y1) break;
    const e2 = err << 1;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

export interface RawPointOptions { type?: "circle" | "cross" | "square"; size?: number }

export function rawPoint(app: CanvasRenderer, pos: V2, color: Readonly<[number, number, number, number]>, { type = "circle", size = 3 }: RawPointOptions = {}): void {
  if (type === "circle") {
    fillCircle(app, pos, size, color);
  } else if (type === "cross") {
    rawLine(app, new V2(pos.x - size, pos.y), new V2(pos.x + size, pos.y), color);
    rawLine(app, new V2(pos.x, pos.y - size), new V2(pos.x, pos.y + size), color);
  } else if (type === "square") {
    const half = size | 0;
    const p = [ new V2(pos.x - half, pos.y - half), new V2(pos.x + half, pos.y - half), new V2(pos.x + half, pos.y + half), new V2(pos.x - half, pos.y + half) ];
    strokeShape(app, p, color, 1);
  }
}

export function strokeShape(app: CanvasRenderer, points: V2[], color: Readonly<[number, number, number, number]>, width: number = 1): void {
  for (let i = 0; i < points.length; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    if (width <= 1) { rawLine(app, p0, p1, color); continue; }
    const d = p1.sub(p0); const len = d.len() || 1;
    const u = d.scale(1 / len);
    const n = new V2(-u.y, u.x);
    const half = (width / 2) | 0;
    for (let o = -half; o <= half; o++) {
      const off = n.scale(o);
      rawLine(app, p0.add(off), p1.add(off), color);
    }
  }
}

export function fillCircle(app: CanvasRenderer, c: V2, r: number, color: Readonly<[number, number, number, number]>): void {
  const r2 = r * r;
  const xMin = Math.max(0, Math.floor(c.x) | 0);
  const xMax = Math.min(app.buffer.width - 1, Math.ceil(c.x) | 0);
  const yMin = Math.max(0, Math.floor(c.y) | 0);
  const yMax = Math.min(app.buffer.height - 1, Math.ceil(c.y) | 0);
  const pix = app.buffer.pixels; const w = app.buffer.width;
  for (let y = yMin; y <= yMax; y++) {
    const dy = y - c.y; const dy2 = dy * dy;
    let idx = ((y * w + xMin) | 0) * 4;
    for (let x = xMin; x <= xMax; x++, idx += 4) {
      const dx = x - c.x;
      if (dx * dx + dy2 <= r2) {
        const dr = pix[idx], dg = pix[idx + 1], db = pix[idx + 2], da = pix[idx + 3];
        const [r0, g0, b0, a0] = blendRGBA(dr, dg, db, da, color[0], color[1], color[2], color[3]);
        pix[idx] = (r0 + 0.5) | 0; pix[idx + 1] = (g0 + 0.5) | 0; pix[idx + 2] = (b0 + 0.5) | 0; pix[idx + 3] = (a0 + 0.5) | 0;
      }
    }
  }
}

/** Scanline polygon fill (Active Edge Table). `points` in CANVAS space */
export function fillPolygon(app: CanvasRenderer, points: V2[], color: Readonly<[number, number, number, number]>): void {
  const n = points?.length | 0; if (n < 3) return;
  const h = app.buffer.height | 0, w = app.buffer.width | 0;
  let minY = Infinity, maxY = -Infinity;
  const edges: Array<{ ymin: number; ymax: number; x: number; invSlope: number }> = [];
  for (let i = 0; i < n; i++) {
    const p1 = points[i], p2 = points[(i + 1) % n];
    const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
    if (y1 === y2) continue; // skip horizontals
    const ymin = Math.min(y1, y2), ymax = Math.max(y1, y2);
    const xAtYmin = y1 < y2 ? x1 : x2;
    const invSlope = (x2 - x1) / (y2 - y1);
    edges.push({ ymin, ymax, x: xAtYmin, invSlope });
    if (ymin < minY) minY = ymin; if (ymax > maxY) maxY = ymax;
  }
  minY = Math.max(0, Math.floor(minY) | 0);
  maxY = Math.min(h - 1, Math.ceil(maxY) | 0);

  const pix = app.buffer.pixels;
  for (let y = minY; y <= maxY; y++) {
    const crossings: number[] = [];
    for (const e of edges) if (y >= e.ymin && y < e.ymax) crossings.push(e.x + (y - e.ymin) * e.invSlope);
    if (!crossings.length) continue;
    crossings.sort((a, b) => a - b);
    for (let k = 0; k < crossings.length; k += 2) {
      const xStart = Math.max(0, Math.floor(crossings[k]) | 0);
      const xEnd = Math.min(w - 1, Math.ceil(crossings[k + 1]) | 0);
      let idx = ((y * w + xStart) | 0) * 4;
      for (let x = xStart; x <= xEnd; x++, idx += 4) {
        const dr = pix[idx], dg = pix[idx + 1], db = pix[idx + 2], da = pix[idx + 3];
        const [r0, g0, b0, a0] = blendRGBA(dr, dg, db, da, color[0], color[1], color[2], color[3]);
        pix[idx] = (r0 + 0.5) | 0; pix[idx + 1] = (g0 + 0.5) | 0; pix[idx + 2] = (b0 + 0.5) | 0; pix[idx + 3] = (a0 + 0.5) | 0;
      }
    }
  }
}

export const drawLine = (app: CanvasRenderer, p0: V2, p1: V2, color: Readonly<[number, number, number, number]>, width: number = 1): void => strokeShape(app, [p0, p1], color, width);

export function drawCircleOutline(app: CanvasRenderer, c: V2, r: number, color: Readonly<[number, number, number, number]>, width: number = 1, segments: number = 32): void {
  const pts: V2[] = [];
  for (let i = 0; i < segments; i++) { const t = (i / segments) * Math.PI * 2; pts.push(new V2(c.x + r * Math.cos(t), c.y + r * Math.sin(t))); }
  strokeShape(app, pts, color, width);
}
