// ─────────────────────────────────────────────────────────────────────────────
// File: src/renderer.ts
// DOM canvas ←→ PixelBuffer bridge
// ─────────────────────────────────────────────────────────────────────────────

import { V2 } from "./v2";
import { PixelBuffer } from "./pixelbuffer";
import { TextCache } from "./textCache";

export class CanvasRenderer {
  public ctx: CanvasRenderingContext2D;
  public size: V2;
  public buffer: PixelBuffer;
  private textCanvas: HTMLCanvasElement;
  private textCtx: CanvasRenderingContext2D;
  private textCache: TextCache;
  public renderables: Array<{ draw: (app: CanvasRenderer) => void }> = [];

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.size = new V2(canvas.width, canvas.height);
    this.buffer = new PixelBuffer(this.size.x, this.size.y);

    this.textCanvas = document.createElement("canvas");
    this.textCtx = this.textCanvas.getContext("2d")!;
    this.textCache = new TextCache(512);
  }

  addRenderable(obj: { draw: (app: CanvasRenderer) => void }): void {
    this.renderables.push(obj);
  }

  clear(color: string = "#131313"): void {
    this.buffer.clear(color);
  }

  putPixel(p: V2, color: Readonly<[number, number, number, number]>): void {
    this.buffer.putPixel(p.x | 0, p.y | 0, color);
  }

  putPixelBlend(p: V2, color: Readonly<[number, number, number, number]>): void {
    this.buffer.putPixelBlend(p.x | 0, p.y | 0, color);
  }

  blitImageData(img: ImageData, dx: number, dy: number): void {
    this.buffer.blit(img, dx, dy);
  }

  render(): void {
    this.ctx.putImageData(this.buffer.imageData, 0, 0);
  }

  renderAll(): void {
    this.clear();
    this.renderables.forEach(obj => obj.draw(this));
    this.render();
  }

  drawText(
    text: string,
    pos: V2,
    color: string = "#fff",
    font: string = "12px sans-serif",
    align: CanvasTextAlign = "left",
    baseline: CanvasTextBaseline = "alphabetic"
  ): void {
    const key = `${text}|${font}|${color}`;
    let entry = this.textCache.get(key);

    if (!entry) {
      const ctx = this.textCtx;
      ctx.font = font;
      const metrics = ctx.measureText(text);
      const w = Math.ceil(metrics.width + 4);
      const h = Math.ceil(
        (metrics.actualBoundingBoxAscent || 10) +
        (metrics.actualBoundingBoxDescent || 4) + 4
      );
      if (this.textCanvas.width < w || this.textCanvas.height < h) {
        this.textCanvas.width = w;
        this.textCanvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillText(text, 2, 2);
      entry = ctx.getImageData(0, 0, w, h);
      this.textCache.set(key, entry);
    }

    const { width: tw, height: th } = entry;
    let ox = 0, oy = 0;
    if (align === "center") ox = -tw / 2;
    else if (align === "right" || align === "end") ox = -tw;
    if (baseline === "middle") oy = -th / 2;
    else if (baseline === "bottom" || baseline === "ideographic" || baseline === "alphabetic") oy = -th;

    this.blitImageData(entry, (pos.x + ox + 0.5) | 0, (pos.y + oy + 0.5) | 0);
  }
}

export class DynamicCanvasRenderer {
  public app: CanvasRenderer;
  private canvas: HTMLCanvasElement;

  constructor(
    public containerDiv: HTMLElement,
    options: { background?: string } = {}
  ) {
    this.canvas = document.createElement("canvas");
    containerDiv.appendChild(this.canvas);
    Object.assign(this.canvas.style, {
      width: "100%",
      height: "100%",
      display: "block",
      background: options.background || "black"
    });

    this.app = new CanvasRenderer(this.canvas);
    this.resize(); // initialize
    window.addEventListener("resize", () => this.resize());
  }

  resize(): void {
    const rect = this.containerDiv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, rect.width | 0);
    const h = Math.max(1, rect.height | 0);

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;

    this.app.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.app.ctx.scale(dpr, dpr);

    this.app.size = new V2(w, h);
    this.app.buffer.resize(w, h);
  }

  clear(): void { this.app.clear(); }
  render(): void { this.app.render(); }
}
