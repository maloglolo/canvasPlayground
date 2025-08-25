
// ─────────────────────────────────────────────────────────────────────────────
// File: src/pixelbuffer.ts
// A CPU-side pixel buffer backed by ImageData, with blending puts and blits
// ─────────────────────────────────────────────────────────────────────────────

import { NAMED, parseColor, packABGR, blendRGBA } from "./color";

export class PixelBuffer {
  public width = 0;
  public height = 0;
  public imageData: ImageData;
  public pixels: Uint8ClampedArray; // RGBA view
  public px32: Uint32Array;         // ABGR packed view

  constructor(width: number, height: number) {
    this.imageData = new ImageData(Math.max(1, width | 0), Math.max(1, height | 0));
    this.pixels = this.imageData.data;
    this.px32 = new Uint32Array(this.pixels.buffer);
    this.width = this.imageData.width;
    this.height = this.imageData.height;
  }

  resize(width: number, height: number): void {
    this.imageData = new ImageData(Math.max(1, width | 0), Math.max(1, height | 0));
    this.pixels = this.imageData.data;
    this.px32 = new Uint32Array(this.pixels.buffer);
    this.width = this.imageData.width;
    this.height = this.imageData.height;
  }

  clear(color: string = "#131313"): void {
    const c = parseColor(color) || NAMED.black;
    const packed = packABGR(c[0], c[1], c[2], c[3]);
    this.px32.fill(packed);
  }

  private index(x: number, y: number): number { return ((y * this.width + x) | 0) * 4; }

  putPixel(x: number, y: number, color: Readonly<[number, number, number, number]>): void {
    if (x >>> 0 >= this.width >>> 0 || y >>> 0 >= this.height >>> 0) return;
    const i = this.index(x | 0, y | 0);
    const c = color;
    this.pixels[i] = c[0]; this.pixels[i + 1] = c[1]; this.pixels[i + 2] = c[2]; this.pixels[i + 3] = c[3];
  }

  putPixelBlend(x: number, y: number, color: Readonly<[number, number, number, number]>): void {
    if (x >>> 0 >= this.width >>> 0 || y >>> 0 >= this.height >>> 0) return;
    const i = this.index(x | 0, y | 0);
    const dr = this.pixels[i], dg = this.pixels[i + 1], db = this.pixels[i + 2], da = this.pixels[i + 3];
    const [r, g, b, a] = blendRGBA(dr, dg, db, da, color[0], color[1], color[2], color[3]);
    this.pixels[i] = (r + 0.5) | 0; this.pixels[i + 1] = (g + 0.5) | 0; this.pixels[i + 2] = (b + 0.5) | 0; this.pixels[i + 3] = (a + 0.5) | 0;
  }

  /** Alpha-blit ImageData into this buffer at (dx,dy). */
  blit(srcImageData: ImageData, dx: number, dy: number): void {
    const sw = srcImageData.width | 0, sh = srcImageData.height | 0;
    const src = srcImageData.data;
    const w = this.width, h = this.height;
    dx |= 0; dy |= 0;

    const startX = Math.max(0, dx);
    const startY = Math.max(0, dy);
    const endX = Math.min(w, dx + sw);
    const endY = Math.min(h, dy + sh);

    for (let sy = startY - dy; sy < endY - dy; sy++) {
      const ty = dy + sy;
      const rowOff = ty * w;
      for (let sx = startX - dx; sx < endX - dx; sx++) {
        const tx = dx + sx;
        const sIdx = (sy * sw + sx) * 4;
        const dIdx = (rowOff + tx) * 4;

        const dr = this.pixels[dIdx], dg = this.pixels[dIdx + 1], db = this.pixels[dIdx + 2], da = this.pixels[dIdx + 3];
        const sr = src[sIdx], sg = src[sIdx + 1], sb = src[sIdx + 2], sa = src[sIdx + 3];
        const alpha = sa / 255;
        const invAlpha = 1 - alpha;

        this.pixels[dIdx]     = (sr * alpha + dr * invAlpha + 0.5) | 0;
        this.pixels[dIdx + 1] = (sg * alpha + dg * invAlpha + 0.5) | 0;
        this.pixels[dIdx + 2] = (sb * alpha + db * invAlpha + 0.5) | 0;
        this.pixels[dIdx + 3] = (sa * alpha + da * invAlpha + 0.5) | 0;
      }
    }
  }
}

