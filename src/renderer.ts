// ─────────────────────────────────────────────────────────────────────────────
// File: src/renderer.ts
// CanvasRenderer + DynamicCanvasRenderer: DOM canvas ←→ PixelBuffer bridge
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
  private resizeCallbacks: Array<() => void> = [];
  public renderables: Array<{ draw: (app: CanvasRenderer) => void }> = [];

  constructor(public canvas: HTMLCanvasElement = document.querySelector("canvas")!) {
    this.ctx = canvas.getContext("2d")!;
    this.size = new V2(canvas.width, canvas.height);
    this.buffer = new PixelBuffer(this.size.x, this.size.y);

    this.textCanvas = document.createElement("canvas");
    this.textCtx = this.textCanvas.getContext("2d")!;
    this.textCache = new TextCache(512);

    window.addEventListener("resize", () => this.onResize());
  }

  private resizeCanvas(): void { this.canvas.width = this.size.x; this.canvas.height = this.size.y; }

  private onResize(): void {
    this.size = new V2(window.innerWidth | 0, window.innerHeight | 0);
    this.resizeCanvas();
    this.buffer.resize(this.size.x, this.size.y);
    this.renderAll();
    this.resizeCallbacks.forEach(cb => cb());
  }

  onResizeCallback(cb: () => void): void { this.resizeCallbacks.push(cb); }
  addRenderable(obj: { draw: (app: CanvasRenderer) => void }): void { this.renderables.push(obj); }

  clear(color: string = "#131313"): void { this.buffer.clear(color); }

  putPixel(p: V2, color: Readonly<[number, number, number, number]>): void { this.buffer.putPixel(p.x | 0, p.y | 0, color); }
  putPixelBlend(p: V2, color: Readonly<[number, number, number, number]>): void { this.buffer.putPixelBlend(p.x | 0, p.y | 0, color); }
  blitImageData(img: ImageData, dx: number, dy: number): void { this.buffer.blit(img, dx, dy); }

  render(): void { this.ctx.putImageData(this.buffer.imageData, 0, 0); }

  renderAll(): void { this.clear(); this.renderables.forEach(obj => obj.draw(this)); this.render(); }

  /** Draw text via cached raster. Options support align/baseline like Canvas2D. */
  drawText(text: string, pos: V2, color: string = "#fff", font: string = "12px sans-serif", align: CanvasTextAlign = "left", baseline: CanvasTextBaseline = "alphabetic"): void {
    const key = `${text}|${font}|${color}`;
    let entry = this.textCache.get(key);
    if (!entry) {
      const ctx = this.textCtx;
      ctx.font = font;
      const metrics = ctx.measureText(text);
      const w = Math.ceil(metrics.width + 4);
      const h = Math.ceil((metrics.actualBoundingBoxAscent || 10) + (metrics.actualBoundingBoxDescent || 4) + 4);
      if (this.textCanvas.width < w || this.textCanvas.height < h) {
        this.textCanvas.width = w; this.textCanvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = "top"; ctx.textAlign = "left";
      ctx.fillText(text, 2, 2);
      entry = ctx.getImageData(0, 0, w, h);
      this.textCache.set(key, entry);
    }

    const { width: tw, height: th } = entry;
    let ox = 0, oy = 0;
    switch (align) { case "center": ox = -tw / 2; break; case "right": case "end": ox = -tw; break; }
    switch (baseline) { case "middle": oy = -th / 2; break; case "bottom": case "ideographic": case "alphabetic": oy = -th; break; }

    this.blitImageData(entry, (pos.x + ox + 0.5) | 0, (pos.y + oy + 0.5) | 0);
  }
}

export class DynamicCanvasRenderer {
  public app: CanvasRenderer;
  constructor(public containerDiv: HTMLElement, options: { background?: string } = {}) {
    const canvas = document.createElement("canvas");
    containerDiv.appendChild(canvas);
    Object.assign(canvas.style, { width: "100%", height: "100%", display: "block", background: options.background || "black" });
    this.app = new CanvasRenderer(canvas);
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  resize(): void {
    const rect = this.containerDiv.getBoundingClientRect();
    const w = Math.max(1, rect.width | 0), h = Math.max(1, rect.height | 0);
    const canvas = this.app.canvas;
    canvas.width = w; canvas.height = h;
    this.app.size = new V2(w, h);
    this.app.buffer.resize(w, h);
  }

  clear(): void { this.app.clear(); }
  render(): void { this.app.render(); }
}

