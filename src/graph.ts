// ─────────────────────────────────────────────────────────────
// File: src/graph.ts
// ─────────────────────────────────────────────────────────────

import { V2 } from "./v2";
import { ViewportManager, getDrawableBounds } from "./viewport";
import { parseColor } from "./color";
import type { RGBA } from "./types";
import { drawLine } from "./raster";

function decimalsForStep(step: number): number {
  if (!isFinite(step) || step <= 0) return 0;
  const s = Math.abs(step);
  if (s >= 1) return 0;
  return Math.min(6, Math.ceil(-Math.log10(s)));
}

function fmtTick(x: number, decimals: number): string {
  const n = +x.toFixed(decimals);
  const z = Math.abs(n) < 1e-12 ? 0 : n;
  return z.toFixed(decimals);
}

export interface GraphOptions {
  showGrid?: boolean;
  showAxes?: boolean;
  showTicks?: boolean;
  drawBorder?: boolean;
  axisAtZero?: boolean;
  gridColor?: string;
  axisColor?: string;
  borderColor?: string;
  tickSizePx?: number;
  tickThickness?: number;
  axisThickness?: number;
  font?: string;
  textColor?: string;
  margin?: number;
  labelOffset?: number;
  numTicksX?: number;
  numTicksY?: number;
  autoScale?: boolean;
}

export class Graph {
  public showGrid: boolean;
  public showAxes: boolean;
  public showTicks: boolean;
  public drawBorder: boolean;
  public axisAtZero: boolean;

  public gridColor: RGBA;
  public axisColor: RGBA;
  public borderColor: RGBA;

  public tickSizePx: number;
  public tickThickness: number;
  public axisThickness: number;
  public font: string;
  public textColor: string;
  public margin: number;
  public labelOffset: number;

  public numTicksX: number;
  public numTicksY: number;
  public autoScale: boolean;

  public axisXPos: number;
  public axisYPos: number;

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
    this.tickThickness = options.tickThickness ?? 1;
    this.axisThickness = options.axisThickness ?? 2;
    this.font = options.font || "12px sans-serif";
    this.textColor = options.textColor || "#fff";
    this.margin = options.margin ?? 30;
    this.labelOffset = options.labelOffset ?? 10;

    this.numTicksX = options.numTicksX ?? 5;
    this.numTicksY = options.numTicksY ?? 5;
    this.autoScale = options.autoScale ?? false;

    this.axisXPos = 0;
    this.axisYPos = 0;
  }

  public setAxisPosition(x: number, y: number) {
    this.axisXPos = x;
    this.axisYPos = y;
  }

  public setLabelStyle(font: string, color: string, offset?: number) {
    this.font = font;
    this.textColor = color;
    if (offset !== undefined) this.labelOffset = offset;
  }

  private computeTicks(min: number, max: number, n: number): number[] {
    if (!isFinite(min) || !isFinite(max) || n <= 0) return [];
    const range = max - min;
    if (range === 0) return [min];

    const stepRaw = range / n;
    const magnitude = Math.pow(10, Math.floor(Math.log10(stepRaw)));
    const step = Math.ceil(stepRaw / magnitude) * magnitude;

    const first = Math.ceil(min / step) * step;
    const ticks: number[] = [];
    for (let x = first; x <= max + 1e-12; x += step) {
      ticks.push(+x.toFixed(6));
    }
    return ticks;
  }

  private autoScaleTicks() {
    if (!this.autoScale) return;

    const world = this.vp.worldBounds;
    const xRange = Math.abs(world.xMax - world.xMin);
    const yRange = Math.abs(world.yMax - world.yMin);

    if (xRange > 0) this.numTicksX = Math.max(2, Math.floor(this.vp.viewport.width / 80));
    if (yRange > 0) this.numTicksY = Math.max(2, Math.floor(this.vp.viewport.height / 80));
  }

  /**
   * Automatically scale the Graph to fit the given drawables.
   * Delegates scaling to the ViewportManager.
   */
  public autoScaleToDrawables(drawables: any[], padding: number = 0.05) {
    const boundsArr = drawables.map(getDrawableBounds).filter(b => b != null);
    if (!boundsArr.length) return;
    this.vp.fitToBounds(boundsArr, padding);
  }

  draw(app: { drawText: (...args: any[]) => void }): void {
    const vpRect = this.vp.viewport;
    const world = this.vp.worldBounds;
    if (!vpRect || !world) return;

    if (this.autoScale) {
      this.autoScaleTicks();
    }

    const xTicks = this.computeTicks(world.xMin, world.xMax, this.numTicksX);
    const yTicks = this.computeTicks(world.yMin, world.yMax, this.numTicksY);

    const decimalsX = decimalsForStep(xTicks.length > 1 ? Math.abs(xTicks[1] - xTicks[0]) : 1);
    const decimalsY = decimalsForStep(yTicks.length > 1 ? Math.abs(yTicks[1] - yTicks[0]) : 1);

    const drawX = this.axisAtZero && world.yMin <= 0 && world.yMax >= 0 ? this.axisXPos : world.yMin;
    const drawY = this.axisAtZero && world.xMin <= 0 && world.xMax >= 0 ? this.axisYPos : world.xMin;

    if (this.showGrid) {
      for (const x of xTicks) {
        const p0 = this.vp.worldToCanvas(x, world.yMin);
        const p1 = this.vp.worldToCanvas(x, world.yMax);
        drawLine(app as any, p0, p1, this.gridColor, 1);
      }

      for (const y of yTicks) {
        const p0 = this.vp.worldToCanvas(world.xMin, y);
        const p1 = this.vp.worldToCanvas(world.xMax, y);
        drawLine(app as any, p0, p1, this.gridColor, 1);
      }
    }

    if (this.showAxes) {
      const x0 = this.vp.worldToCanvas(world.xMin, drawX);
      const x1 = this.vp.worldToCanvas(world.xMax, drawX);
      const y0 = this.vp.worldToCanvas(drawY, world.yMin);
      const y1 = this.vp.worldToCanvas(drawY, world.yMax);

      drawLine(app as any, x0, x1, this.axisColor, this.axisThickness);
      drawLine(app as any, y0, y1, this.axisColor, this.axisThickness);
    }

    if (this.showTicks && this.tickSizePx > 0) {
      const t = this.tickSizePx;

      for (const x of xTicks) {
        const canvasPos = this.vp.worldToCanvas(x, drawX);
        drawLine(
          app as any,
          new V2(canvasPos.x, canvasPos.y - t / 2),
          new V2(canvasPos.x, canvasPos.y + t / 2),
          this.axisColor,
          this.tickThickness
        );
        app.drawText(
          fmtTick(x, decimalsX),
          new V2(canvasPos.x, canvasPos.y + this.labelOffset),
          this.textColor,
          this.font,
          "center",
          "top"
        );
      }

      for (const y of yTicks) {
        const canvasPos = this.vp.worldToCanvas(drawY, y);
        drawLine(
          app as any,
          new V2(canvasPos.x - t / 2, canvasPos.y),
          new V2(canvasPos.x + t / 2, canvasPos.y),
          this.axisColor,
          this.tickThickness
        );
        app.drawText(
          fmtTick(y, decimalsY),
          new V2(canvasPos.x - this.labelOffset, canvasPos.y),
          this.textColor,
          this.font,
          "right",
          "middle"
        );
      }
    }
  }
}