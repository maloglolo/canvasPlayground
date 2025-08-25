
// ─────────────────────────────────────────────────────────────────────────────
// File: src/viewport.ts
// World→canvas mapping with optional aspect preservation and view margins
// ─────────────────────────────────────────────────────────────────────────────

import { V2 } from "./v2";
import type { Rect, WorldBounds } from "./types";

export class ViewportManager {
    /**
     * @param app CanvasRenderer-like object exposing `size: V2`
     * @param worldBounds initial world bounds
     * @param viewport static `Rect` or a function (app) => Rect for responsive layouts
     * @param preserveAspect false | true | "fit" | "cover" (true behaves like "fit")
     */
    constructor(
        public app: { size: V2 },
        public worldBounds: WorldBounds,
        private _viewport: Rect | ((app: { size: V2 }) => Rect) = { x: 0, y: 0, width: app.size.x, height: app.size.y },
        public preserveAspect: boolean | "fit" | "cover" | "none" = false
    ) { }

    get viewport(): Rect { return typeof this._viewport === "function" ? this._viewport(this.app) : this._viewport; }

    get scale(): V2 {
        const { xMin, xMax, yMin, yMax } = this.worldBounds;
        const xRange = xMax - xMin,
            yRange = yMax - yMin;
        const vp = this.viewport;

        // If preserveAspect is not a string mode, just scale freely
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
        const xRange = xMax - xMin, yRange = yMax - yMin;
        if (this.preserveAspect) {
            const s = this.scale.x;
            const scaledWidth = s * xRange, scaledHeight = s * yRange;
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
        const xRange = xMax - xMin, yRange = yMax - yMin;
        if (this.preserveAspect) {
            const s = this.scale.x;
            const scaledWidth = s * xRange, scaledHeight = s * yRange;
            const offsetX = vp.x + (vp.width - scaledWidth) / 2;
            const offsetY = vp.y + (vp.height - scaledHeight) / 2;
            return new V2(xMin + (px - offsetX) / s, yMax - (py - offsetY) / s);
        } else {
            const sc = this.scale;
            return new V2(xMin + (px - vp.x) / sc.x, yMax - (py - vp.y) / sc.y);
        }
    }

    /** Convert world units to canvas pixels in X (assumes uniform when preserveAspect). */
    unitsToPixels(units: number): number { return units * this.scale.x; }
}

/** Compute a centered viewport rect inside a div */
export function getDivViewport(div: HTMLElement, targetAspect: number = 1, margin: number = 30): Rect & { margin: number } {
    const rect = div.getBoundingClientRect();
    let width = rect.width, height = rect.height;
    const currentAspect = width / height;
    if (currentAspect > targetAspect) width = height * targetAspect;
    else height = width / targetAspect;
    return { x: margin, y: margin, width: width - margin * 2, height: height - margin * 2, margin };
}
