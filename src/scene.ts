// src/scene.ts
import { Drawable } from "./drawables";
import { ViewportManager } from "./viewport";
import { CanvasRenderer } from "./renderer";
import { LegendItem } from "./legend";

interface Layer {
    name: string;
    drawables: Drawable[];
}

export class Scene {
    private layers: Layer[] = [];

    add(items: Drawable | Drawable[], layerName: string = "default"): this {
        const drawables = Array.isArray(items) ? items : [items];
        let layer = this.layers.find(l => l.name === layerName);

        if (!layer) {
            layer = { name: layerName, drawables: [] };
            this.layers.push(layer);
            this.sortLayers();
        }

        layer.drawables.push(...drawables);
        return this;
    }

    remove(item: Drawable): this {
        for (const layer of this.layers) {
            layer.drawables = layer.drawables.filter(d => d !== item);
        }
        return this;
    }

    clear(layerName?: string): this {
        if (layerName) {
            const layer = this.layers.find(l => l.name === layerName);
            if (layer) layer.drawables.length = 0;
        } else {
            this.layers.length = 0;
        }
        return this;
    }

    draw(app: CanvasRenderer, vp?: ViewportManager): void {
        for (const layer of this.layers) {
            if (layer.name === "debug") continue;
            for (const d of layer.drawables) {
                if ((d as any).visible === false) continue;
                d.draw(app, vp);
            }
        }

        const debugLayer = this.layers.find(l => l.name === "debug");
        if (debugLayer) {
            for (const d of debugLayer.drawables) {
                if ((d as any).visible === false) continue;
                if ((d as any).ignoreViewport) d.draw(app, undefined);
                else d.draw(app, vp);
            }
        }
    }

    collectDrawables(): Drawable[] {
        const drawables: Drawable[] = [];
        for (const layer of this.layers) { 
            drawables.push(...layer.drawables);
        }
        return drawables;
    }

    collectLegend(): LegendItem[] {
        const items: LegendItem[] = [];
        for (const layer of this.layers) {
            for (const d of layer.drawables) {
                const meta = (d as any).legend;
                if (meta) {
                    items.push({
                        label: meta.label,
                        color: meta.color ?? (d as any).color ?? "#fff",
                        symbol: meta.symbol ?? "line",
                    });
                }
            }
        }
        return items;
    }

    private sortLayers(): void {
        this.layers.sort((a, b) => {
            if (a.name === "debug") return 1;
            if (b.name === "debug") return -1;
            return a.name.localeCompare(b.name);
        });
    }
}

export interface CanvasHost {
    app: CanvasRenderer;
    resize?: () => void;
    clear?: () => void;
    render?: () => void;
    containerDiv?: HTMLElement;
}

export interface SceneEntry {
    host: CanvasHost;
    scene: Scene;
    vp?: ViewportManager;
    id?: string;
}

export class SceneManager {
    private entries: SceneEntry[] = [];
    private _rafId: number | null = null;

    add(host: CanvasHost, scene: Scene, vp?: ViewportManager, id?: string): this {
        this.entries.push({ host, scene, vp, id });
        return this;
    }

    init(): void {
        this.entries.forEach(({ host, vp }) => {
            host.resize?.();
            if (vp?.updateWorld) {
                try {
                    vp.updateWorld(vp.worldBounds);
                } catch (e) {
                    console.warn("Could not update viewport:", e);
                }
            }
        });
    }

    resizeAll(): void {
        this.entries.forEach(({ host, vp }) => {
            host.resize?.();
            if (vp?.updateWorld) {
                try {
                    vp.updateWorld(vp.worldBounds);
                } catch {}
            }
        });
    }

    renderAll(): void {
        this.entries.forEach(({ host, scene, vp }) => {
            host.clear?.();
            scene.draw(host.app, vp);
            host.render?.();
        });
    }

    startLoop(onFrame?: (t: number) => void): void {
        if (this._rafId != null) return;
        const loop = (t: number) => {
            onFrame?.(t);
            this.renderAll();
            this._rafId = requestAnimationFrame(loop);
        };
        this._rafId = requestAnimationFrame(loop);
    }

    stopLoop(): void {
        if (this._rafId != null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    get(id: string): SceneEntry | undefined {
        return this.entries.find(entry => entry.id === id);
    }

    attachWindowResize(debounceMs: number = 120): void {
        let timer: number | null = null;
        window.addEventListener("resize", () => {
            if (timer != null) window.clearTimeout(timer);
            timer = window.setTimeout(() => {
                this.resizeAll();
                timer = null;
            }, debounceMs);
        });
    }
}
