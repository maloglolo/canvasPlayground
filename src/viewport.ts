import { V2 } from "./v2";
import { ViewportRect } from "./types";

function safeSpan(min: number, max: number, eps = 1e-9): [number, number] {
    if (!isFinite(min) || !isFinite(max)) return [0, 1];
    if (max - min < eps) {
        const c = (min + max) / 2;
        return [c - eps, c + eps];
    }
    return [min, max];
}

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

        if (this.app.canvas && this.app.canvas.parentElement) {
            const ro = new ResizeObserver(() => {
                const canvas = this.app.canvas;
                const dpr = window.devicePixelRatio || 1;

                canvas.width = canvas.clientWidth * dpr;
                canvas.height = canvas.clientHeight * dpr;

                this.app.size.x = canvas.clientWidth;
                this.app.size.y = canvas.clientHeight;

                autoScaleViewport(this, this.app.drawables || []);
                if (this.app.render) this.app.render();
            });
            ro.observe(this.app.canvas.parentElement);
        }
    }

    get viewport(): ViewportRect {
        if (typeof this._viewport === "function") return this._viewport(this.app);

        const canvas = this.app.canvas;
        if (canvas && canvas.parentElement) {
            const rect = canvas.parentElement.getBoundingClientRect();
            const margin = 0; 
            return {
                x: margin,
                y: margin,
                width: rect.width - 2 * margin,
                height: rect.height - 2 * margin,
            };
        }

        return this._viewport;
    }

    // Normalize preserveAspect to 'none' | 'square' | 'fit'
    private aspectMode(): "none" | "square" | "fit" {
        if (this.preserveAspect === true) return "square";
        if (!this.preserveAspect || this.preserveAspect === "none") return "none";
        const s = String(this.preserveAspect).toLowerCase();
        if (s === "square") return "square";
        if (s === "fit") return "fit";
        return "none";
    }

    get scale(): V2 {
        const { xMin, xMax, yMin, yMax } = this.worldBounds;
        const s = xMax - xMin;
        const o = yMax - yMin;
        const a = this.viewport;

        const mode = this.aspectMode();
        if (mode === "none") return new V2(a.width / s, a.height / o);

        const lx = a.width / s;
        const ly = a.height / o;
        const l = Math.min(lx, ly);
        return new V2(l, l);
    }

    worldToCanvas(x: number, y: number): V2 {
        const { xMin, xMax, yMin, yMax } = this.worldBounds;
        const vp = this.viewport;
        const u = xMax - xMin;
        const v = yMax - yMin;

        const mode = this.aspectMode();
        if (mode !== "none") {
            const scale = this.scale.x;
            const w = scale * u;
            const h = scale * v;
            const offsetX = vp.x + (vp.width - w) / 2;
            const offsetY = vp.y + (vp.height - h) / 2;
            const px = offsetX + (x - xMin) * scale;
            const py = offsetY + (yMax - y) * scale;
            return new V2(px, py);
        } else {
            const scale = this.scale;
            const px = vp.x + (x - xMin) * scale.x;
            const py = vp.y + (yMax - y) * scale.y;
            return new V2(px, py);
        }
    }

    canvasToWorld(x: number, y: number): V2 {
        const { xMin, xMax, yMin, yMax } = this.worldBounds;
        const vp = this.viewport;
        const u = xMax - xMin;
        const v = yMax - yMin;

        const mode = this.aspectMode();
        if (mode !== "none") {
            const scale = this.scale.x;
            const w = scale * u;
            const h = scale * v;
            const offsetX = vp.x + (vp.width - w) / 2;
            const offsetY = vp.y + (vp.height - h) / 2;
            const wx = xMin + (x - offsetX) / scale;
            const wy = yMax - (y - offsetY) / scale;
            return new V2(wx, wy);
        } else {
            const scale = this.scale;
            const wx = xMin + (x - vp.x) / scale.x;
            const wy = yMax - (y - vp.y) / scale.y;
            return new V2(wx, wy);
        }
    }

    unitsToPixels(t: number): number {
        return t * this.scale.x;
    }

    updateWorld(bounds: { xMin: number; xMax: number; yMin: number; yMax: number } | null = null, numTicks: number = 10) {
        if (bounds) {
            const [sxMin, sxMax] = safeSpan(bounds.xMin, bounds.xMax);
            const [syMin, syMax] = safeSpan(bounds.yMin, bounds.yMax);
            this.worldBounds = { xMin: sxMin, xMax: sxMax, yMin: syMin, yMax: syMax };
        }
        const { xMin, xMax, yMin, yMax } = this.worldBounds;
        this.xTicks = this.computeTicks(xMin, xMax, numTicks);
        this.yTicks = this.computeTicks(yMin, yMax, numTicks);
    }

    computeTicks(min: number, max: number, numTicks: number): number[] {
        if (!isFinite(min) || !isFinite(max) || numTicks <= 0) return [];
        if (Math.abs(max - min) < 1e-12) return [min];

        const rawStep = (max - min) / numTicks;
        const step = this.nicify(rawStep);
        if (!isFinite(step) || step <= 0) return [min, max];

        const start = Math.ceil(min / step) * step;
        const ticks: number[] = [];
        const maxIndex = Math.ceil((max - start) / step);
        for (let i = 0; i <= maxIndex; i++) {
            ticks.push(+((start + i * step).toFixed(10)));
        }
        return ticks;
    }

    nicify(step: number): number {
        if (!isFinite(step) || step <= 0) return 1;
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
            if (!b) continue;
            xMin = Math.min(xMin, b.xMin);
            xMax = Math.max(xMax, b.xMax);
            yMin = Math.min(yMin, b.yMin);
            yMax = Math.max(yMax, b.yMax);
        }
        if (!isFinite(xMin) || !isFinite(xMax) || !isFinite(yMin) || !isFinite(yMax)) return;
        [xMin, xMax] = safeSpan(xMin, xMax);
        [yMin, yMax] = safeSpan(yMin, yMax);

        const width = xMax - xMin;
        const height = yMax - yMin;
        const padX = padding < 1 ? width * padding : padding;
        const padY = padding < 1 ? height * padding : padding;

        xMin -= padX; xMax += padX;
        yMin -= padY; yMax += padY;

        const mode = this.aspectMode();
        if (mode === "square") {
            const dx = xMax - xMin;
            const dy = yMax - yMin;
            const span = Math.max(dx, dy);
            const cx = (xMin + xMax) / 2;
            const cy = (yMin + yMax) / 2;
            xMin = cx - span / 2; xMax = cx + span / 2;
            yMin = cy - span / 2; yMax = cy + span / 2;
        } else if (mode === "fit") {
            try {
                const vp = this.viewport;
                const pixelAspect = vp.width / Math.max(1, vp.height);
                const worldAspect = (xMax - xMin) / Math.max(1e-12, (yMax - yMin));
                if (worldAspect > pixelAspect) {
                    const targetDy = (xMax - xMin) / pixelAspect;
                    const cy = (yMin + yMax) / 2;
                    yMin = cy - targetDy / 2; yMax = cy + targetDy / 2;
                } else {
                    const targetDx = (yMax - yMin) * pixelAspect;
                    const cx = (xMin + xMax) / 2;
                    xMin = cx - targetDx / 2; xMax = cx + targetDx / 2;
                }
            } catch (e) {}
        }

        this.worldBounds = { xMin, xMax, yMin, yMax };
        this.updateWorld(this.worldBounds);
    }
}

export function getDivViewport(el: HTMLElement, margin: number = 30): ViewportRect {
    const rect = el.getBoundingClientRect();
    return { x: margin, y: margin, width: rect.width - 2 * margin, height: rect.height - 2 * margin };
}

export function getDrawableBounds(d: any) {
    try {
        if (d == null) return null;
        if (Array.isArray(d.data) && d.data.length) {
            const xs = d.data.map((p: any) => p.x);
            const ys = d.data.map((p: any) => p.y);
            return { xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: Math.min(...ys), yMax: Math.max(...ys) };
        } else if (Array.isArray(d.points) && d.points.length) {
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
            return { xMin: 0, xMax: (d.grid[0] || []).length, yMin: 0, yMax: d.grid.length };
        } else if (d.bounds && isFinite(d.bounds.xMin) && isFinite(d.bounds.xMax) && isFinite(d.bounds.yMin) && isFinite(d.bounds.yMax)) {
            return d.bounds;
        }
    } catch (e) {}
    return null;
}

export function autoScaleViewport(vp: ViewportManager, drawables: any[], padding: number = 0.05) {
    const boundsArr = drawables.map(getDrawableBounds).filter(b => b != null);
    if (!boundsArr.length) return;
    vp.fitToBounds(boundsArr as any, padding);
}
