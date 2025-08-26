// ─────────────────────────────────────────────────────────────────────────────
// File: src/viewport.ts
// World→canvas mapping 
// ─────────────────────────────────────────────────────────────────────────────

import { V2 } from "./v2";
import type { Rect, WorldBounds } from "./types";

export class ViewportManager {
    public xTicks: number[] = [];
    public yTicks: number[] = [];

    constructor(
        public app: { size: V2 },
        public worldBounds: WorldBounds,
        private _viewport: Rect | ((app: { size: V2 }) => Rect) = {
            x: 0,
            y: 0,
            width: app.size.x,
            height: app.size.y,
        },
        public preserveAspect: boolean | "fit" | "cover" | "none" = false
    ) {}

    get viewport(): Rect {
        return typeof this._viewport === "function" ? this._viewport(this.app) : this._viewport;
    }

    get scale(): V2 {
        const { xMin, xMax, yMin, yMax } = this.worldBounds;
        const xRange = xMax - xMin,
            yRange = yMax - yMin;
        const vp = this.viewport;

        if (!this.preserveAspect || this.preserveAspect === "none") {
            return new V2(vp.width / xRange, vp.height / yRange);
        }

        const viewRatio = vp.width / vp.height;
        const dataRatio = xRange / yRange;
        const s = viewRatio > dataRatio ? vp.height / yRange : vp.width / xRange;
        return new V2(s, s);
    }

    worldToCanvas(x: number, y: number): V2 {
        const vp = this.viewport;
        const { xMin, xMax, yMin, yMax } = this.worldBounds;
        const xRange = xMax - xMin,
            yRange = yMax - yMin;

        if (this.preserveAspect && this.preserveAspect !== "none") {
            const s = this.scale.x;
            const scaledWidth = s * xRange,
                scaledHeight = s * yRange;
            const offsetX = vp.x + (vp.width - scaledWidth) / 2;
            const offsetY = vp.y + (vp.height - scaledHeight) / 2;
            return new V2(offsetX + (x - xMin) * s, offsetY + (yRange - (y - yMin)) * s);
        } else {
            const sc = this.scale;
            return new V2(vp.x + (x - xMin) * sc.x, vp.y + (yMax - y) * sc.y);
        }
    }

    canvasToWorld(px: number, py: number): V2 {
        const vp = this.viewport;
        const { xMin, xMax, yMin, yMax } = this.worldBounds;
        const xRange = xMax - xMin,
            yRange = yMax - yMin;

        if (this.preserveAspect && this.preserveAspect !== "none") {
            const s = this.scale.x;
            const scaledWidth = s * xRange,
                scaledHeight = s * yRange;
            const offsetX = vp.x + (vp.width - scaledWidth) / 2;
            const offsetY = vp.y + (vp.height - scaledHeight) / 2;
            return new V2(xMin + (px - offsetX) / s, yMax - (py - offsetY) / s);
        } else {
            const sc = this.scale;
            return new V2(xMin + (px - vp.x) / sc.x, yMax - (py - vp.y) / sc.y);
        }
    }

    /** Convert world units to canvas pixels in X (assumes uniform when preserveAspect). */
    unitsToPixels(units: number): number {
        return units * this.scale.x;
    }

    /**
     * Update world bounds and ticks.
     * @param bounds 
     * @param numTicks 
     */
    updateWorld(bounds?: WorldBounds, numTicks: number = 10) {
        if (bounds) {
            this.worldBounds = bounds;
        }

        const { xMin, xMax, yMin, yMax } = this.worldBounds;

        this.xTicks = this.computeTicks(xMin, xMax, numTicks);
        this.yTicks = this.computeTicks(yMin, yMax, numTicks);
    }

    private computeTicks(min: number, max: number, numTicks: number): number[] {
        const range = max - min;
        if (range <= 0) return [min];

        const step = this.nicify(range / numTicks);
        const start = Math.ceil(min / step) * step;
        const ticks: number[] = [];
        for (let v = start; v <= max; v += step) {
            ticks.push(+v.toFixed(10)); // clamp fp error
        }
        return ticks;
    }

    private nicify(step: number): number {
        const exp = Math.floor(Math.log10(step));
        const base = step / Math.pow(10, exp);
        let niceBase: number;
        if (base < 1.5) niceBase = 1;
        else if (base < 3) niceBase = 2;
        else if (base < 7) niceBase = 5;
        else niceBase = 10;
        return niceBase * Math.pow(10, exp);
    }
}

export function getDivViewport(
    div: HTMLElement,
    targetAspect: number = 1,
    margin: number = 30
): Rect & { margin: number } {
    const rect = div.getBoundingClientRect();
    let width = rect.width,
        height = rect.height;
    const currentAspect = width / height;
    if (currentAspect > targetAspect) width = height * targetAspect;
    else height = width / targetAspect;
    return { x: margin, y: margin, width: width - margin * 2, height: height - margin * 2, margin };
}
