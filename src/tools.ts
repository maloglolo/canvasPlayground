
// ─────────────────────────────────────────────────────────────────────────────
// File: src/tools.ts
// ─────────────────────────────────────────────────────────────────────────────

import { V2 } from "./v2";
import { Transform2D } from "./transform2d";
import { fillCircle } from "./raster";
import { parseColor, NAMED } from "./color";

export function rotatePoint(p: V2, center: V2, angle: number): V2 { return p.rotate(angle, center); }

export function rotateTriangleAroundCenter(tri: { points: V2[] }, center: V2, angle: number): void {
  tri.points = tri.points.map(p => rotatePoint(p, center, angle));
}

export function rotateTriangleVertical(tri: { points: V2[] }, center: V2, angle: number): void {
  const m = Transform2D.around(center, Transform2D.scale(Math.cos(angle), 1));
  tri.points = tri.points.map(p => m.transformV2(p));
}

/** 2.5D projection: keep Y, scale X by cos(angle) about `center`. */
export function projectYRotation(point: V2, center: V2, angle: number): V2 {
  const m = Transform2D.around(center, Transform2D.scale(Math.cos(angle), 1));
  return m.transformV2(point);
}

export class Intercepts {
  static findX(series: V2[]): number[] {
    const out: number[] = [];
    for (let i = 1; i < series.length; i++) {
      const y1 = series[i - 1].y, y2 = series[i].y;
      if (y1 === 0) out.push(series[i - 1].x);
      else if (y1 * y2 < 0) { const x1 = series[i - 1].x, x2 = series[i].x; out.push(x1 + (-y1 / (y2 - y1)) * (x2 - x1)); }
    }
    return out;
  }
  static drawX(app: any, graph: { vp: { worldToCanvas: (x: number, y: number) => V2 } }, series: V2[], color: string | readonly [number, number, number, number] = "yellow"): void {
    const col = parseColor(color) || NAMED.yellow; const xs = Intercepts.findX(series);
    for (const x of xs) { const p = graph.vp.worldToCanvas(x, 0); fillCircle(app as any, new V2((p.x + 0.5) | 0, (p.y + 0.5) | 0), 5, col); }
  }
}

