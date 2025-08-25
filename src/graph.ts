
// ─────────────────────────────────────────────────────────────────────────────
// File: src/graph.ts
// ─────────────────────────────────────────────────────────────────────────────

import { V2 } from "./v2";
import { ViewportManager } from "./viewport";
import { parseColor } from "./color";
import type { RGBA } from "./types";
import { drawLine } from "./raster";

// avoid "-0"
function decimalsForStep(step: number): number { if (!isFinite(step) || step <= 0) return 0; const s = Math.abs(step); if (s >= 1) return 0; return Math.min(6, Math.ceil(-Math.log10(s))); }
function fmtTick(x: number, decimals: number): string { const n = +x.toFixed(decimals); const z = Math.abs(n) < 1e-12 ? 0 : n; return z.toFixed(decimals); }

export interface GraphOptions {
  showGrid?: boolean; showAxes?: boolean; showTicks?: boolean; drawBorder?: boolean; axisAtZero?: boolean;
  gridColor?: string; axisColor?: string; borderColor?: string; tickSizePx?: number; numTicksX?: number; numTicksY?: number;
  font?: string; textColor?: string; margin?: number; autoScale?: boolean;
}

export class Graph {
  public showGrid: boolean; public showAxes: boolean; public showTicks: boolean; public drawBorder: boolean; public axisAtZero: boolean;
  public gridColor: RGBA; public axisColor: RGBA; public borderColor: RGBA;
  public tickSizePx: number; public numTicksX?: number; public numTicksY?: number;
  public font: string; public textColor: string; public margin: number; public autoScale: boolean;

  constructor(public vp: ViewportManager, options: GraphOptions = {}) {
    this.showGrid = options.showGrid !== false;
    this.showAxes = options.showAxes !== false;
    this.showTicks = options.showTicks !== false;
    this.drawBorder = options.drawBorder || false;
    this.axisAtZero = options.axisAtZero !== false;

    this.gridColor = parseColor(options.gridColor || "#2a2a2a")!;
    this.axisColor = parseColor(options.axisColor || "#888")!;
    this.borderColor = parseColor(options.borderColor || "#555")!;

    this.tickSizePx = options.tickSizePx ?? 6;
    this.numTicksX = options.numTicksX; this.numTicksY = options.numTicksY;
    this.font = options.font || "12px sans-serif";
    this.textColor = options.textColor || "#fff";
    this.margin = options.margin || ((vp as any).viewport?.margin ?? 30);
    this.autoScale = options.autoScale !== false;
  }

  draw(app: { drawText: (...args: any[]) => void }, dataSeries: Array<Array<V2>> = []): void {
    const vp = this.vp.viewport;

    let xMin = 0, xMax = 1, yMin = 0, yMax = 1;
    if (this.vp.worldBounds) ({ xMin, xMax, yMin, yMax } = this.vp.worldBounds);

    // Auto-scale from data
    if (this.autoScale && dataSeries.length > 0) {
      const allX = dataSeries.flatMap(series => series.map(p => p.x));
      const allY = dataSeries.flatMap(series => series.map(p => p.y));
      xMin = Math.min(...allX); xMax = Math.max(...allX);
      yMin = Math.min(...allY); yMax = Math.max(...allY);
      if (!(isFinite(xMin) && isFinite(xMax) && isFinite(yMin) && isFinite(yMax))) { xMin = 0; xMax = 1; yMin = 0; yMax = 1; }
      if (xMin === xMax) { xMin -= 0.5; xMax += 0.5; }
      if (yMin === yMax) { yMin -= 0.5; yMax += 0.5; }
    }

    const xTicks = this.numTicksX
      ? Array.from({ length: this.numTicksX + 1 }, (_, i) => xMin + i * ((xMax - xMin) / this.numTicksX!))
      : computeTicks(xMin, xMax);

    const yTicks = this.numTicksY
      ? Array.from({ length: this.numTicksY + 1 }, (_, i) => yMin + i * ((yMax - yMin) / this.numTicksY!))
      : computeTicks(yMin, yMax);

    const safeXTicks = xTicks.length >= 2 ? xTicks : [xMin, xMax];
    const safeYTicks = yTicks.length >= 2 ? yTicks : [yMin, yMax];

    this.vp.worldBounds = {
      xMin: Math.min(safeXTicks[0], xMin),
      xMax: Math.max(safeXTicks[safeXTicks.length - 1], xMax),
      yMin: Math.min(safeYTicks[0], yMin),
      yMax: Math.max(safeYTicks[safeYTicks.length - 1], yMax)
    };

    const dx = (safeXTicks[1] - safeXTicks[0]) || (xMax - xMin) || 1;
    const dy = (safeYTicks[1] - safeYTicks[0]) || (yMax - yMin) || 1;
    const decimalsX = decimalsForStep(Math.abs(dx));
    const decimalsY = decimalsForStep(Math.abs(dy));

    // Plot edges in canvas space
    const plotLeft = vp.x, plotRight = vp.x + vp.width; const plotTop = vp.y, plotBottom = vp.y + vp.height;

    if (this.showGrid) {
      for (const x of safeXTicks) {
        const p0 = this.vp.worldToCanvas(x, this.vp.worldBounds.yMin);
        const p1 = this.vp.worldToCanvas(x, this.vp.worldBounds.yMax);
        drawLine(app as any, p0, p1, this.gridColor);
      }
      for (const y of safeYTicks) {
        const p0 = this.vp.worldToCanvas(this.vp.worldBounds.xMin, y);
        const p1 = this.vp.worldToCanvas(this.vp.worldBounds.xMax, y);
        drawLine(app as any, p0, p1, this.gridColor);
      }
    }

    if (this.showAxes) {
      if (!this.axisAtZero) {
        drawLine(app as any, new V2(plotLeft, plotTop), new V2(plotLeft, plotBottom), this.axisColor, 2);
        drawLine(app as any, new V2(plotLeft, plotBottom), new V2(plotRight, plotBottom), this.axisColor, 2);
      } else {
        if (this.vp.worldBounds.xMin <= 0 && this.vp.worldBounds.xMax >= 0) {
          const p0 = this.vp.worldToCanvas(0, this.vp.worldBounds.yMin);
          const p1 = this.vp.worldToCanvas(0, this.vp.worldBounds.yMax);
          drawLine(app as any, p0, p1, this.axisColor, 2);
        }
        if (this.vp.worldBounds.yMin <= 0 && this.vp.worldBounds.yMax >= 0) {
          const p0 = this.vp.worldToCanvas(this.vp.worldBounds.xMin, 0);
          const p1 = this.vp.worldToCanvas(this.vp.worldBounds.xMax, 0);
          drawLine(app as any, p0, p1, this.axisColor, 2);
        }
      }
    }

    if (this.showTicks && this.tickSizePx > 0) {
      const t = this.tickSizePx | 0;
      for (const x of safeXTicks) {
        const px = this.vp.worldToCanvas(x, this.vp.worldBounds.yMin).x;
        const p0 = new V2(px, plotBottom);
        const p1 = new V2(px, plotBottom - t);
        drawLine(app as any, p0, p1, this.axisColor);
      }
      for (const y of safeYTicks) {
        const py = this.vp.worldToCanvas(this.vp.worldBounds.xMin, y).y;
        const p0 = new V2(plotLeft, py);
        const p1 = new V2(plotLeft + t, py);
        drawLine(app as any, p0, p1, this.axisColor);
      }
    }

    for (const x of safeXTicks) {
      const p = this.vp.worldToCanvas(x, this.vp.worldBounds.yMin);
      const lx = Math.max(plotLeft, Math.min(p.x, plotRight));
      const ly = vp.y + vp.height + this.margin / 2;
      (app as any).drawText(fmtTick(x, decimalsX), new V2(lx, ly), this.textColor, this.font, "center", "top");
    }
    for (const y of safeYTicks) {
      const p = this.vp.worldToCanvas(this.vp.worldBounds.xMin, y);
      const lx = vp.x - this.margin / 2; const ly = Math.max(plotTop, Math.min(p.y, plotBottom));
      (app as any).drawText(fmtTick(y, decimalsY), new V2(lx, ly), this.textColor, this.font, "right", "middle");
    }

    if (this.drawBorder) {
      const tl = new V2(plotLeft, plotTop); const tr = new V2(plotRight, plotTop); const br = new V2(plotRight, plotBottom); const bl = new V2(plotLeft, plotBottom);
      drawLine(app as any, tl, tr, this.borderColor, 1);
      drawLine(app as any, tr, br, this.borderColor, 1);
      drawLine(app as any, br, bl, this.borderColor, 1);
      drawLine(app as any, bl, tl, this.borderColor, 1);
    }
  }
}

export function computeTicks(min: number, max: number, maxTicks: number = 10): number[] {
  const range = max - min;
  if (!isFinite(range) || range === 0) return [min, max];
  const roughStep = range / maxTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(roughStep))));
  const niceSteps = [1, 2, 5, 10];
  const step = (niceSteps.find(s => s * mag >= roughStep) ?? 10) * mag;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const numSteps = Math.round((niceMax - niceMin) / step);
  const ticks: number[] = [];
  for (let i = 0; i <= numSteps; i++) ticks.push(parseFloat((niceMin + i * step).toFixed(10)));
  return ticks;
}
