// src/legend.ts
import { V2 } from "./v2";
import { ViewportManager } from "./viewport";
import { fillCircle, drawLine, fillPolygon } from "./raster";
import { parseColor } from "./color";
import { Drawable } from "./drawables";

export type LegendSymbol = "line" | "marker" | "area";
export interface LegendItem {
  label: string;
  color: string;
  symbol?: LegendSymbol;
}

export interface LegendOptions {
  anchor?: "ne" | "nw" | "se" | "sw";
  padding?: number;
  gap?: number;
  swatchSize?: number;
  font?: string;
  textColor?: string;
  background?: string | null;
  boxOffset?: V2;
  maxWidthPx?: number;
}

export class DrawableLegend extends Drawable {
  constructor(
    public items: LegendItem[],
    public options: LegendOptions = {}
  ) {
    super("white", false, null);
  }

  private estimateTextWidth(label: string, font: string): number {
    const m = /(\d+)\s*px/.exec(font);
    const px = m ? parseInt(m[1], 10) : 12;
    return Math.max(8, Math.round(label.length * px * 0.6));
  }

  draw(app: any, vp: ViewportManager): void {
    const opts: Required<LegendOptions> = {
      anchor: this.options.anchor ?? "ne",
      padding: this.options.padding ?? 8,
      gap: this.options.gap ?? 6,
      swatchSize: this.options.swatchSize ?? 14,
      font: this.options.font ?? "12px sans-serif",
      textColor: this.options.textColor ?? "#fff",
      background: (this.options.background === undefined ? "rgba(0,0,0,0.35)" : this.options.background) as any,
      boxOffset: this.options.boxOffset ?? new V2(0, 0),
      maxWidthPx: this.options.maxWidthPx ?? 0
    };

    if (!this.items?.length) return;

    const vpRect = vp.viewport;
    const pad = opts.padding;
    const sw = opts.swatchSize;
    const rowH = Math.max(sw, 12) + opts.gap;

    let textW = 0;
    for (const it of this.items) {
      textW = Math.max(textW, this.estimateTextWidth(it.label, opts.font));
    }
    const contentW = sw + 6 + textW;
    const boxW = (opts.maxWidthPx && opts.maxWidthPx > contentW ? opts.maxWidthPx : contentW) + pad * 2;
    const boxH = this.items.length * rowH - opts.gap + pad * 2;

    let x = 0, y = 0;
    switch (opts.anchor) {
      case "ne":
        x = vpRect.x + vpRect.width - boxW - 4; y = vpRect.y + 4; break;
      case "nw":
        x = vpRect.x + 4; y = vpRect.y + 4; break;
      case "se":
        x = vpRect.x + vpRect.width - boxW - 4; y = vpRect.y + vpRect.height - boxH - 4; break;
      case "sw":
        x = vpRect.x + 4; y = vpRect.y + vpRect.height - boxH - 4; break;
    }
    x += opts.boxOffset.x; y += opts.boxOffset.y;

    if (opts.background) {
      const bg = parseColor(opts.background) || [0,0,0,128];
      const r: [V2,V2,V2,V2] = [
        new V2(x, y),
        new V2(x + boxW, y),
        new V2(x + boxW, y + boxH),
        new V2(x, y + boxH),
      ];
      fillPolygon(app, r, bg as any);
    }

    let cx = x + pad;
    let cy = y + pad + rowH / 2;

    for (const it of this.items) {
      const col = parseColor(it.color) || [255,255,255,255];
      const sym = it.symbol ?? "line";

      if (sym === "marker") {
        fillCircle(app, new V2(Math.round(cx + sw/2), Math.round(cy)), Math.max(3, Math.floor(sw/3)), col as any);
      } else if (sym === "area") {
        const r: [V2,V2,V2,V2] = [
          new V2(cx, cy - sw/2 + 3),
          new V2(cx + sw, cy - sw/2 + 3),
          new V2(cx + sw, cy + sw/2 - 3),
          new V2(cx, cy + sw/2 - 3),
        ];
        fillPolygon(app, r, col as any);
        drawLine(app, new V2(cx, cy - sw/2), new V2(cx + sw, cy - sw/2), col as any, 1);
      } else {
        drawLine(app, new V2(cx, cy), new V2(cx + sw, cy), col as any, 2);
      }

      app.drawText(it.label, new V2(cx + sw + 6, cy), opts.textColor, opts.font, "left", "middle");
      cy += rowH;
    }
  }
}
