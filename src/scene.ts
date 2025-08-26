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

    add(items: Drawable[] | Drawable, layerName: string = "default"): this {
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


    draw(app: CanvasRenderer, vp: ViewportManager): void {

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

                if ((d as any).ignoreViewport) {
                    d.draw(app, undefined);
                } else {
                    d.draw(app, vp);
                }
            }
        }
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

    private sortLayers() {
        this.layers.sort((a, b) => {
            if (a.name === "debug") return 1;
            if (b.name === "debug") return -1;
            return a.name.localeCompare(b.name);
        });
    }
}
