// viewport.ts
import { V2 } from "./v2";
import { ViewportRect } from "./types";

// -------------------- VIEWPORT MANAGER --------------------
export class ViewportManager {
    app: any;
    private _viewport: ViewportRect | ((app: any) => ViewportRect);
    preserveAspect: string | boolean;
    worldBounds: { xMin: number; xMax: number; yMin: number; yMax: number };
    xTicks: number[];
    yTicks: number[];

    constructor(
        app: any,
        worldBounds: { xMin: number; xMax: number; yMin: number; yMax: number } | null = null,
        _viewport: ViewportRect | ((app: any) => ViewportRect) | null = null,
        preserveAspect: string | boolean = "none"
    ) {
        this.app = app;
        this._viewport = _viewport || { x: 0, y: 0, width: app.size.x, height: app.size.y };
        this.preserveAspect = preserveAspect;
        this.worldBounds = worldBounds || { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
        this.xTicks = [];
        this.yTicks = [];
        this.updateWorld(this.worldBounds);
    }

    get viewport(): ViewportRect {
        if (typeof this._viewport === "function") return this._viewport(this.app);
        return this._viewport;
    }

    get scale(): V2 {
        const { xMin, xMax, yMin, yMax } = this.worldBounds;
        const s = xMax - xMin;
        const o = yMax - yMin;
        const a = this.viewport;

        if (!this.preserveAspect || this.preserveAspect === "none") return new V2(a.width / s, a.height / o);

        const u = a.width / a.height;
        const h = s / o;
        const l = u > h ? a.height / o : a.width / s;
        return new V2(l, l);
    }

    worldToCanvas(x: number, y: number): V2 {
        const { xMin, xMax, yMin, yMax } = this.worldBounds;
        const vp = this.viewport;
        const u = xMax - xMin;
        const v = yMax - yMin;

        if (this.preserveAspect && this.preserveAspect !== "none") {
            const scale = this.scale.x;
            const w = scale * u;
            const h = scale * v;
            const offsetX = vp.x + (vp.width - w) / 2;
            const offsetY = vp.y + (vp.height - h) / 2;
            return new V2(offsetX + (x - xMin) * scale, offsetY + (v - (y - yMin)) * scale);
        } else {
            const scale = this.scale;
            return new V2(vp.x + (x - xMin) * scale.x, vp.y + (yMax - y) * scale.y);
        }
    }

    canvasToWorld(x: number, y: number): V2 {
        const { xMin, xMax, yMin, yMax } = this.worldBounds;
        const vp = this.viewport;
        const u = xMax - xMin;
        const v = yMax - yMin;

        if (this.preserveAspect && this.preserveAspect !== "none") {
            const scale = this.scale.x;
            const w = scale * u;
            const h = scale * v;
            const offsetX = vp.x + (vp.width - w) / 2;
            const offsetY = vp.y + (vp.height - h) / 2;
            return new V2(xMin + (x - offsetX) / scale, yMax - (y - offsetY) / scale);
        } else {
            const scale = this.scale;
            return new V2(xMin + (x - vp.x) / scale.x, yMax - (y - vp.y) / scale.y);
        }
    }

    unitsToPixels(t: number): number {
        return t * this.scale.x;
    }

    updateWorld(bounds: { xMin: number; xMax: number; yMin: number; yMax: number } | null = null, numTicks: number = 10) {
        if (bounds) this.worldBounds = bounds;
        const { xMin, xMax, yMin, yMax } = this.worldBounds;
        this.xTicks = this.computeTicks(xMin, xMax, numTicks);
        this.yTicks = this.computeTicks(yMin, yMax, numTicks);
    }

    computeTicks(min: number, max: number, numTicks: number): number[] {
        const step = this.nicify((max - min) / numTicks);
        const start = Math.ceil(min / step) * step;
        const ticks: number[] = [];
        for (let v = start; v <= max; v += step) ticks.push(+v.toFixed(10));
        return ticks;
    }

    nicify(step: number): number {
        const e = Math.floor(Math.log10(step));
        const f = step / Math.pow(10, e);
        let nice: number;
        if (f < 1.5) nice = 1;
        else if (f < 3) nice = 2;
        else if (f < 7) nice = 5;
        else nice = 10;
        return nice * Math.pow(10, e);
    }

    fitToBounds(boundsArray: { xMin: number; xMax: number; yMin: number; yMax: number }[], padding: number = 0.05) {
        if (!boundsArray || boundsArray.length === 0) return;

        let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;

        for (const b of boundsArray) {
            xMin = Math.min(xMin, b.xMin);
            xMax = Math.max(xMax, b.xMax);
            yMin = Math.min(yMin, b.yMin);
            yMax = Math.max(yMax, b.yMax);
        }

        const width = xMax - xMin || 1;
        const height = yMax - yMin || 1;

        const padX = padding < 1 ? width * padding : padding;
        const padY = padding < 1 ? height * padding : padding;

        this.worldBounds = { xMin: xMin - padX, xMax: xMax + padX, yMin: yMin - padY, yMax: yMax + padY };
        this.updateWorld(this.worldBounds);
    }
}

// -------------------- DIV VIEWPORT HELPER --------------------
export function getDivViewport(el: HTMLElement, margin: number = 30): ViewportRect {
    const rect = el.getBoundingClientRect();
    return { x: margin, y: margin, width: rect.width - 2 * margin, height: rect.height - 2 * margin };
}

// -------------------- DRAWABLE BOUNDS --------------------
export function getDrawableBounds(d: any) {
    if (d.data?.length) {
        const xs = d.data.map((p: any) => p.x);
        const ys = d.data.map((p: any) => p.y);
        return { xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: Math.min(...ys), yMax: Math.max(...ys) };
    } else if (d.points?.length) {
        const xs = d.points.map((p: any) => p.x);
        const ys = d.points.map((p: any) => p.y);
        return { xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: Math.min(...ys), yMax: Math.max(...ys) };
    } else if (d.pos) {
        let xMin = d.pos.x, xMax = d.pos.x, yMin = d.pos.y, yMax = d.pos.y;
        if (typeof d.radius === "number") {
            
            xMin = d.pos.x - d.radius;
            xMax = d.pos.x + d.radius;
            yMin = d.pos.y - d.radius;
            yMax = d.pos.y + d.radius;
        }
        return { xMin, xMax, yMin, yMax };
    } else if (d.p1 && d.p2) {
        const xs = [d.p1.x, d.p2.x];
        const ys = [d.p1.y, d.p2.y];
        return { xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: Math.min(...ys), yMax: Math.max(...ys) };
    } else if (d.grid) {
        return { xMin: 0, xMax: d.grid[0].length, yMin: 0, yMax: d.grid.length };
    }
    return null;
}

// -------------------- AUTO-SCALE VIEWPORT --------------------
export function autoScaleViewport(vp: ViewportManager, drawables: any[], padding: number = 0.05) {
    const boundsArr = drawables.map(getDrawableBounds).filter(b => b != null);
    if (!boundsArr.length) return;


    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    boundsArr.forEach(b => {
        xMin = Math.min(xMin, b.xMin);
        xMax = Math.max(xMax, b.xMax);
        yMin = Math.min(yMin, b.yMin);
        yMax = Math.max(yMax, b.yMax);
    });

    
    drawables.forEach(d => {
        if (d.pos && d.radius === 1) {
            xMin = Math.min(xMin, d.pos.x - d.radius);
            xMax = Math.max(xMax, d.pos.x + d.radius);
            yMin = Math.min(yMin, d.pos.y - d.radius);
            yMax = Math.max(yMax, d.pos.y + d.radius);
        }
    });

    const dx = xMax - xMin;
    const dy = yMax - yMin;
    const maxSpan = Math.max(dx, dy);
    const cx = (xMax + xMin) / 2;
    const cy = (yMax + yMin) / 2;

    xMin = cx - maxSpan / 2;
    xMax = cx + maxSpan / 2;
    yMin = cy - maxSpan / 2;
    yMax = cy + maxSpan / 2;


    const padX = (xMax - xMin) * padding;
    const padY = (yMax - yMin) * padding;

    vp.worldBounds = {
        xMin: xMin - padX,
        xMax: xMax + padX,
        yMin: yMin - padY,
        yMax: yMax + padY
    };
}
