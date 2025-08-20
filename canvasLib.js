/* ==============================
 * color / blending
 * ============================== */

/**
 * Named colors (sRGB) → RGBA (0..255)
 */
export const NAMED = Object.freeze({
  black: [0, 0, 0, 255], white: [255, 255, 255, 255], red: [255, 0, 0, 255], green: [0, 255, 0, 255],
  blue: [0, 0, 255, 255], yellow: [255, 255, 0, 255], cyan: [0, 255, 255, 255], magenta: [255, 0, 255, 255],
  gray: [128, 128, 128, 255], grey: [128, 128, 128, 255], orange: [255, 165, 0, 255],
  transparent: [0, 0, 0, 0]
});

/**
 * Parse CSS-like colors into [r,g,b,a] (0..255)
 * Supports: arrays, named, #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(), rgba()
 * Returns null on invalid input (caller can fallback)
 */
export function parseColor(c) {
  if (Array.isArray(c)) {
    if (c.length === 3) return [c[0] | 0, c[1] | 0, c[2] | 0, 255];
    if (c.length === 4) return [c[0] | 0, c[1] | 0, c[2] | 0, c[3] | 0];
    return null;
  }
  if (typeof c !== "string") return null;
  const s = c.trim().toLowerCase();
  if (s in NAMED) return NAMED[s].slice(0, 4);

  if (s.startsWith("#")) {
    const hex = s.slice(1);
    const isHex = /^[0-9a-f]+$/i.test(hex);
    if (!isHex) return null;
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return [r, g, b, 255];
    }
    if (hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = parseInt(hex[3] + hex[3], 16);
      return [r, g, b, a];
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return [r, g, b, 255];
    }
    if (hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = parseInt(hex.slice(6, 8), 16);
      return [r, g, b, a];
    }
    return null;
  }

  // rgb()/rgba()
  {
    const m = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([01](?:\.\d+)?))?\s*\)$/i);
    if (m) {
      const r = clamp255(+m[1]);
      const g = clamp255(+m[2]);
      const b = clamp255(+m[3]);
      const a = m[4] == null ? 1 : clamp01(+m[4]);
      return [r, g, b, (a * 255 + 0.5) | 0];
    }
  }

  return null;
}

const clamp255 = v => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Pack [r,g,b,a] → ABGR uint32 for TypedArray blits (Canvas ImageData is little-endian). */
export function packABGR(r, g, b, a) {
  return (a << 24) | (b << 16) | (g << 8) | r;
}

/** Unpack ABGR uint32 → [r,g,b,a] */
export function unpackABGR(px) {
  return [px & 255, (px >>> 8) & 255, (px >>> 16) & 255, (px >>> 24) & 255];
}

/**
 * Canonical porter-duff source-over blend (non-premultiplied inputs).
 * Returns [r,g,b,a] floats (0..255) — callers typically round/assign.
 */
export function blendRGBA(dr, dg, db, da, sr, sg, sb, sa) {
  const dna = da / 255, sna = sa / 255;
  const outA = sna + dna * (1 - sna);
  if (outA <= 0) return [0, 0, 0, 0];
  const inv = 1 - sna;
  const r = (sr * sna + dr * dna * inv) / outA;
  const g = (sg * sna + dg * dna * inv) / outA;
  const b = (sb * sna + db * dna * inv) / outA;
  return [r, g, b, outA * 255];
}

/* ==============================
 * PixelBuffer
 * ============================== */
export class PixelBuffer {
  constructor(width, height) {
    this.resize(width, height);
  }

  resize(width, height) {
    this.width = width | 0; this.height = height | 0;
    this.imageData = new ImageData(this.width, this.height);
    this.pixels = this.imageData.data; // Uint8ClampedArray RGBA
    this.px32 = new Uint32Array(this.pixels.buffer); // ABGR packed view
  }

  clear(color = "#131313") {
    const c = parseColor(color) || NAMED.black;
    const packed = packABGR(c[0], c[1], c[2], c[3]);
    this.px32.fill(packed);
  }

  index(x, y) { return ((y * this.width + x) | 0) * 4; }

  putPixel(x, y, color) {
    if (x >>> 0 >= this.width >>> 0 || y >>> 0 >= this.height >>> 0) return;
    const c = Array.isArray(color) ? color : parseColor(color) || NAMED.white;
    const i = this.index(x | 0, y | 0);
    this.pixels[i] = c[0]; this.pixels[i + 1] = c[1]; this.pixels[i + 2] = c[2]; this.pixels[i + 3] = c[3];
  }

  putPixelBlend(x, y, color) {
    if (x >>> 0 >= this.width >>> 0 || y >>> 0 >= this.height >>> 0) return;
    const c = Array.isArray(color) ? color : parseColor(color) || NAMED.white;
    const i = this.index(x | 0, y | 0);
    const dr = this.pixels[i], dg = this.pixels[i + 1], db = this.pixels[i + 2], da = this.pixels[i + 3];
    const [r, g, b, a] = blendRGBA(dr, dg, db, da, c[0], c[1], c[2], c[3]);
    this.pixels[i] = (r + 0.5) | 0; this.pixels[i + 1] = (g + 0.5) | 0; this.pixels[i + 2] = (b + 0.5) | 0; this.pixels[i + 3] = (a + 0.5) | 0;
  }

  /** Alpha blit ImageData into this buffer at (dx,dy) */
  blit(srcImageData, dx, dy) {
    const sw = srcImageData.width | 0, sh = srcImageData.height | 0;
    const src = srcImageData.data;
    const w = this.width, h = this.height;
    dx |= 0; dy |= 0;
    let sy = 0;
    for (; sy < sh; sy++) {
      const ty = dy + sy; if (ty < 0 || ty >= h) continue;
      const rowOff = (ty * w) | 0;
      let sx = 0;
      for (; sx < sw; sx++) {
        const tx = dx + sx; if (tx < 0 || tx >= w) continue;
        const sIdx = ((sy * sw + sx) | 0) * 4;
        const dIdx = (((rowOff + tx) | 0) * 4) | 0;
        const dr = this.pixels[dIdx], dg = this.pixels[dIdx + 1], db = this.pixels[dIdx + 2], da = this.pixels[dIdx + 3];
        const sr = src[sIdx], sg = src[sIdx + 1], sb = src[sIdx + 2], sa = src[sIdx + 3];
        const [r, g, b, a] = blendRGBA(dr, dg, db, da, sr, sg, sb, sa);
        this.pixels[dIdx] = (r + 0.5) | 0; this.pixels[dIdx + 1] = (g + 0.5) | 0; this.pixels[dIdx + 2] = (b + 0.5) | 0; this.pixels[dIdx + 3] = (a + 0.5) | 0;
      }
    }
  }
}

/* ==============================
 * Renderer (DOM canvas ↔ PixelBuffer)
 * ============================== */
export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas || document.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.size = { x: this.canvas.width, y: this.canvas.height };

    this.buffer = new PixelBuffer(this.size.x, this.size.y);

    // Offscreen text canvas & cache
    this.textCanvas = document.createElement("canvas");
    this.textCtx = this.textCanvas.getContext("2d");
    this.textCache = new TextCache(512); // LRU capacity

    this.resizeCallbacks = [];
    window.addEventListener("resize", () => this.onResize());
  }

  resizeCanvas() {
    this.canvas.width = this.size.x; this.canvas.height = this.size.y;
  }

  onResize() {
    this.size = { x: window.innerWidth | 0, y: window.innerHeight | 0 };
    this.resizeCanvas();
    this.buffer.resize(this.size.x, this.size.y);
    this.renderAll();
    this.resizeCallbacks.forEach(cb => cb());
  }

  onResizeCallback(cb) { this.resizeCallbacks.push(cb); }
  addRenderable(obj) { (this.renderables ||= []).push(obj); }

  clear(color = "#131313") { this.buffer.clear(color); }

  putPixel(x, y, color) { this.buffer.putPixel(x, y, color); }
  putPixelBlend(x, y, color) { this.buffer.putPixelBlend(x, y, color); }
  blitImageData(img, dx, dy) { this.buffer.blit(img, dx, dy); }

  render() { this.ctx.putImageData(this.buffer.imageData, 0, 0); }

  renderAll() {
    this.clear();
    (this.renderables || []).forEach(obj => obj.draw(this));
    this.render();
  }

  /**
   * Draw text via cached raster.
   * Options support align/baseline like Canvas2D.
   */
  drawText(text, x, y, color = "#fff", font = "12px sans-serif", align = "left", baseline = "alphabetic") {
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
    // align/baseline offset
    const { width: tw, height: th } = entry;
    let ox = 0, oy = 0;
    switch (align) {
      case "center": ox = -tw / 2; break;
      case "right": case "end": ox = -tw; break;
      // left/start default 0
    }
    switch (baseline) {
      case "middle": oy = -th / 2; break;
      case "bottom": case "ideographic": case "alphabetic": oy = -th; break;
      // top/hanging default 0 (we baked ascent approximatively)
    }
    this.blitImageData(entry, (x + ox + 0.5) | 0, (y + oy + 0.5) | 0);
  }
}

/* ==============================
 * Text Cache (simple LRU)
 * ============================== */
class TextCache {
  constructor(capacity = 256) {
    this.capacity = capacity | 0;
    this.map = new Map();
  }
  get(key) {
    const v = this.map.get(key);
    if (v) { this.map.delete(key); this.map.set(key, v); }
    return v || null;
  }
  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.capacity) {
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }
  }
  clear() { this.map.clear(); }
}

/* ==============================
 * Viewport / Transform
 * ============================== */
export class ViewportManager {
  /**
   * worldBounds: {xMin,xMax,yMin,yMax}
   * viewport: {x,y,width,height} or (app)=>{...}
   * preserveAspect: false | true | "fit" | "cover"
   */
  constructor(app, worldBounds, viewport, preserveAspect = false) {
    this.app = app;
    this.worldBounds = worldBounds;
    this._viewport = viewport || { x: 0, y: 0, width: app.size.x, height: app.size.y };
    this.preserveAspect = preserveAspect;
  }

  get viewport() { return typeof this._viewport === "function" ? this._viewport(this.app) : this._viewport; }

  get scale() {
    const { xMin, xMax, yMin, yMax } = this.worldBounds;
    const xRange = xMax - xMin, yRange = yMax - yMin;
    const vp = this.viewport;
    if (!this.preserveAspect || this.preserveAspect === false) return { x: vp.width / xRange, y: vp.height / yRange };
    const viewRatio = vp.width / vp.height;
    const dataRatio = xRange / yRange;
    const s = viewRatio > dataRatio ? vp.height / yRange : vp.width / xRange;
    return { x: s, y: s };
  }

  worldToCanvas(x, y) {
    const vp = this.viewport;
    const { xMin, xMax, yMin, yMax } = this.worldBounds;
    const xRange = xMax - xMin, yRange = yMax - yMin;
    if (this.preserveAspect) {
      const s = this.scale.x;
      const scaledWidth = s * xRange, scaledHeight = s * yRange;
      const offsetX = vp.x + (vp.width - scaledWidth) / 2;
      const offsetY = vp.y + (vp.height - scaledHeight) / 2;
      return [offsetX + (x - xMin) * s, offsetY + (yRange - (y - yMin)) * s];
    } else {
      const sc = this.scale; // separate for readability
      return [vp.x + (x - xMin) * sc.x, vp.y + (yMax - y) * sc.y];
    }
  }

  canvasToWorld(px, py) {
    const vp = this.viewport;
    const { xMin, xMax, yMin, yMax } = this.worldBounds;
    const xRange = xMax - xMin, yRange = yMax - yMin;
    if (this.preserveAspect) {
      const s = this.scale.x;
      const scaledWidth = s * xRange, scaledHeight = s * yRange;
      const offsetX = vp.x + (vp.width - scaledWidth) / 2;
      const offsetY = vp.y + (vp.height - scaledHeight) / 2;
      return [xMin + (px - offsetX) / s, yMax - (py - offsetY) / s];
    } else {
      const sc = this.scale;
      return [xMin + (px - vp.x) / sc.x, yMax - (py - vp.y) / sc.y];
    }
  }

  unitsToPixels(units) { return units * this.scale.x; }
}

/* ==============================
 * DynamicCanvasRenderer (responsive)
 * ============================== */
export class DynamicCanvasRenderer {
  constructor(containerDiv, options = {}) {
    this.canvas = document.createElement("canvas");
    containerDiv.appendChild(this.canvas);
    Object.assign(this.canvas.style, { width: "100%", height: "100%", display: "block", background: options.background || "black" });
    this.app = new CanvasRenderer(this.canvas);
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = Math.max(1, rect.width | 0), h = Math.max(1, rect.height | 0);
    this.canvas.width = w; this.canvas.height = h;
    this.app.size = { x: w, y: h };
    this.app.buffer.resize(w, h);
  }

  clear() { this.app.clear(); }
  render() { this.app.render(); }
}

export function getDivViewport(div, targetAspect = 1) {
  const rect = div.getBoundingClientRect();
  let width = rect.width, height = rect.height;
  const currentAspect = width / height;
  if (currentAspect > targetAspect) width = height * targetAspect; else height = width / targetAspect;
  return { x: 0, y: 0, width, height };
}

/* ==============================
 * Rasterizers
 * ============================== */

// Low-level line using Bresenham with blending
export function rawLine(app, x0, y0, x1, y1, color) {
  const col = Array.isArray(color) ? color : parseColor(color) || NAMED.white;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);

  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  const buf = app.buffer;

  while (true) {
    buf.putPixelBlend(x0, y0, col);
    if (x0 === x1 && y0 === y1) break;
    const e2 = err << 1;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

export function strokeShape(app, points, color, width = 1) {
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    if (width <= 1) { rawLine(app, x0, y0, x1, y1, color); continue; }
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const half = (width / 2) | 0;
    for (let o = -half; o <= half; o++) {
      const ox = -uy * o, oy = ux * o;
      rawLine(app, x0 + ox, y0 + oy, x1 + ox, y1 + oy, color);
    }
  }
}

export function fillCircle(app, cx, cy, r, color) {
  const col = Array.isArray(color) ? color : parseColor(color) || NAMED.white;
  const r2 = r * r;
  const xMin = Math.max(0, Math.floor(cx - r) | 0);
  const xMax = Math.min(app.buffer.width - 1, Math.ceil(cx + r) | 0);
  const yMin = Math.max(0, Math.floor(cy - r) | 0);
  const yMax = Math.min(app.buffer.height - 1, Math.ceil(cy + r) | 0);
  const pix = app.buffer.pixels;
  const w = app.buffer.width;
  for (let y = yMin; y <= yMax; y++) {
    const dy = y - cy; const dy2 = dy * dy;
    let idx = ((y * w + xMin) | 0) * 4;
    for (let x = xMin; x <= xMax; x++, idx += 4) {
      const dx = x - cx;
      if (dx * dx + dy2 <= r2) {
        const dr = pix[idx], dg = pix[idx + 1], db = pix[idx + 2], da = pix[idx + 3];
        const [r0, g0, b0, a0] = blendRGBA(dr, dg, db, da, col[0], col[1], col[2], col[3]);
        pix[idx] = (r0 + 0.5) | 0; pix[idx + 1] = (g0 + 0.5) | 0; pix[idx + 2] = (b0 + 0.5) | 0; pix[idx + 3] = (a0 + 0.5) | 0;
      }
    }
  }
}

// Efficient scanline polygon fill with Active Edge Table (AET)
export function fillPolygon(app, points, color) {
  const col = Array.isArray(color) ? color : parseColor(color) || NAMED.white;
  if (!points || points.length < 3) return;
  const h = app.buffer.height | 0, w = app.buffer.width | 0;
  // Build Edge Table (bucket per scanline)
  let minY = Infinity, maxY = -Infinity;
  const edges = [];
  for (let i = 0, n = points.length; i < n; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % n];
    if (y1 === y2) continue; // skip horizontal
    const ymin = Math.min(y1, y2), ymax = Math.max(y1, y2);
    const xAtYmin = y1 < y2 ? x1 : x2;
    const invSlope = (x2 - x1) / (y2 - y1);
    edges.push({ ymin, ymax, x: xAtYmin, invSlope });
    if (ymin < minY) minY = ymin; if (ymax > maxY) maxY = ymax;
  }
  minY = Math.max(0, Math.floor(minY) | 0);
  maxY = Math.min(h - 1, Math.ceil(maxY) | 0);

  const pix = app.buffer.pixels;
  for (let y = minY; y <= maxY; y++) {
    const crossings = [];
    for (const e of edges) {
      if (y >= e.ymin && y < e.ymax) crossings.push(e.x + (y - e.ymin) * e.invSlope);
    }
    if (!crossings.length) continue;
    crossings.sort((a, b) => a - b);
    for (let k = 0; k < crossings.length; k += 2) {
      const xStart = Math.max(0, Math.floor(crossings[k]) | 0);
      const xEnd = Math.min(w - 1, Math.ceil(crossings[k + 1]) | 0);
      let idx = ((y * w + xStart) | 0) * 4;
      for (let x = xStart; x <= xEnd; x++, idx += 4) {
        const dr = pix[idx], dg = pix[idx + 1], db = pix[idx + 2], da = pix[idx + 3];
        const [r0, g0, b0, a0] = blendRGBA(dr, dg, db, da, col[0], col[1], col[2], col[3]);
        pix[idx] = (r0 + 0.5) | 0; pix[idx + 1] = (g0 + 0.5) | 0; pix[idx + 2] = (b0 + 0.5) | 0; pix[idx + 3] = (a0 + 0.5) | 0;
      }
    }
  }
}

/* ==============================
 * Graphing layer
 * ============================== */
export class Graph {
  constructor(viewportManager, options = {}) {
    this.vp = viewportManager;
    this.tickSize = options.tickSize || 10;
    this.numTicksX = options.numTicksX || 10;
    this.numTicksY = options.numTicksY || 10;
    this.font = options.font || "12px sans-serif";
    this.color = parseColor(options.color || "#F9FBFF") || NAMED.white;
    this.textColor = options.color || "#F9FBFF";
  }

  draw(app) {
    const { xMin, xMax, yMin, yMax } = this.vp.worldBounds;
    const dx = (xMax - xMin) / this.numTicksX;
    const dy = (yMax - yMin) / this.numTicksY;

    // grid
    for (let i = 0; i <= this.numTicksX; i++) {
      const x = xMin + i * dx;
      const [x0, y0] = this.vp.worldToCanvas(x, yMin);
      const [x1, y1] = this.vp.worldToCanvas(x, yMax);
      drawLine(app, x0, y0, x1, y1, this.color);
    }
    for (let j = 0; j <= this.numTicksY; j++) {
      const y = yMin + j * dy;
      const [x0, y0] = this.vp.worldToCanvas(xMin, y);
      const [x1, y1] = this.vp.worldToCanvas(xMax, y);
      drawLine(app, x0, y0, x1, y1, this.color);
    }

    // labels
    const yAxisCanvas = (yMin <= 0 && yMax >= 0) ? this.vp.worldToCanvas(0, 0)[1] : this.vp.worldToCanvas(0, yMin)[1];
    for (let i = 0; i <= this.numTicksX; i++) {
      const x = xMin + i * dx;
      const [cx] = this.vp.worldToCanvas(x, yMin);
      app.drawText(x.toFixed(0), (cx + 0.5) | 0, (yAxisCanvas + 4 + 0.5) | 0, this.textColor, this.font, "center", "top");
    }
    const xAxisCanvas = (xMin <= 0 && xMax >= 0) ? this.vp.worldToCanvas(0, 0)[0] : this.vp.worldToCanvas(xMin, 0)[0];
    for (let j = 0; j <= this.numTicksY; j++) {
      const y = yMin + j * dy;
      const [, cy] = this.vp.worldToCanvas(xMin, y);
      app.drawText(y.toFixed(0), (xAxisCanvas + 15 + 0.5) | 0, (cy + 0.5) | 0, this.textColor, this.font, "right", "middle");
    }
  }
}

/* ==============================
 * Drawables
 * ============================== */
export class Drawable {
  constructor({ color = "white", fill = false, fillColor = null } = {}) {
    this.color = color; this.fill = fill; this.fillColor = fillColor || color;
  }
  // override in subclasses
  draw(app, graph) { throw new Error("draw() not implemented"); }
}

export class DrawableFunction extends Drawable {
  constructor(data, { color = "red", fill = false, fillColor = "rgba(255,0,0,0.3)", baselineY = 0 } = {}) {
    super({ color, fill, fillColor });
    this.data = data; this.baselineY = baselineY;
  }
  draw(app, graph) {
    if (!graph || !this.data || !this.data.length) return;
    let [px, py] = graph.vp.worldToCanvas(this.data[0].x, this.data[0].y);
    for (let i = 1; i < this.data.length; i++) {
      const [nx, ny] = graph.vp.worldToCanvas(this.data[i].x, this.data[i].y);
      drawLine(app, px, py, nx, ny, this.color);
      px = nx; py = ny;
    }
    if (!this.fill) return;
    const pts = this.data.map(p => graph.vp.worldToCanvas(p.x, p.y));
    const last = this.data[this.data.length - 1];
    const first = this.data[0];
    pts.push(graph.vp.worldToCanvas(last.x, this.baselineY));
    pts.push(graph.vp.worldToCanvas(first.x, this.baselineY));
    fillPolygon(app, pts, this.fillColor);
  }
}

export class DrawableCircle extends Drawable {
  constructor(center = { x: 0, y: 0 }, radius = 1, { color = "white", fill = false, fillColor = null } = {}) {
    super({ color, fill, fillColor }); this.center = center; this.radius = radius;
  }
  draw(app, graph) {
    const [cx, cy] = graph.vp.worldToCanvas(this.center.x, this.center.y);
    const sc = graph.vp.scale; // assume uniform if preserveAspect
    const r = this.radius * (graph.vp.preserveAspect ? sc.x : (sc.x + sc.y) * 0.5);
    if (this.fill) fillCircle(app, cx, cy, r, this.fillColor);
    drawCircleOutline(app, cx, cy, r, this.color);
  }
}

export class DrawableLine extends Drawable {
  constructor(p1, p2, { color = "yellow", width = 2 } = {}) { super({ color }); this.p1 = p1; this.p2 = p2; this.width = Math.max(1, width | 0); }
  draw(app, graph) {
    const [x0, y0] = graph.vp.worldToCanvas(this.p1.x, this.p1.y);
    const [x1, y1] = graph.vp.worldToCanvas(this.p2.x, this.p2.y);
    drawLine(app, x0, y0, x1, y1, this.color, this.width);
  }
}

export class DrawableTriangle extends Drawable {
  constructor(p1, p2, p3, { color = "yellow", fill = true, fillColor = "rgba(255,255,0,0.5)" } = {}) {
    super({ color, fill, fillColor }); this.points = [p1, p2, p3];
  }
  draw(app, graph) {
    const vp = graph.vp || graph;
    const pts = this.points.map(p => vp.worldToCanvas(p.x, p.y));
    if (this.fill) fillPolygon(app, pts, this.fillColor);
    for (let i = 0; i < 3; i++) { const a = pts[i], b = pts[(i + 1) % 3]; drawLine(app, a[0], a[1], b[0], b[1], this.color); }
  }
}

export class DrawableText extends Drawable {
  constructor(text, pos, { color = "white", font = "14px sans-serif", align = "left", baseline = "alphabetic" } = {}) {
    super({ color }); this.text = text; this.pos = pos; this.font = font; this.align = align; this.baseline = baseline;
  }
  draw(app, graph) {
    const [x, y] = graph.vp.worldToCanvas(this.pos.x, this.pos.y);
    app.drawText(this.text, x, y, this.color, this.font, this.align, this.baseline);
  }
}

/* ==============================
 * Tools / Geometry helpers
 * ============================== */
export function rotatePoint(p, center, angle) {
  const dx = p.x - center.x, dy = p.y - center.y; const c = Math.cos(angle), s = Math.sin(angle);
  return { x: center.x + dx * c - dy * s, y: center.y + dx * s + dy * c };
}

export function rotateTriangleAroundCenter(tri, center, angle) {
  tri.points = tri.points.map(p => rotatePoint(p, center, angle));
}

export function rotateTriangleVertical(tri, center, angle) {
  tri.points = tri.points.map(p => ({ x: center.x + (p.x - center.x) * Math.cos(angle), y: p.y }));
}

export function projectYRotation(point, center, angle) {
  const dx = point.x - center.x; return { x: center.x + dx * Math.cos(angle), y: point.y };
}

export const drawLine = (app, x0, y0, x1, y1, color, width = 1) => strokeShape(app, [[x0, y0], [x1, y1]], color, width);

export function drawCircleOutline(app, cx, cy, r, color, width = 1, segments = 128) {
  const pts = [];
  for (let i = 0; i < segments; i++) { const t = (i / segments) * Math.PI * 2; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
  strokeShape(app, pts, color, width);
}

/* ==============================
 * Intercepts utility
 * ============================== */
export class Intercepts {
  static findX(series) {
    const out = [];
    for (let i = 1; i < series.length; i++) {
      const y1 = series[i - 1].y, y2 = series[i].y;
      if (y1 === 0) out.push(series[i - 1].x);
      else if (y1 * y2 < 0) { const x1 = series[i - 1].x, x2 = series[i].x; out.push(x1 + (-y1 / (y2 - y1)) * (x2 - x1)); }
    }
    return out;
  }
  static drawX(app, graph, series, color = "yellow") {
    const col = parseColor(color) || NAMED.yellow; const xs = Intercepts.findX(series);
    for (const x of xs) { const [cx, cy] = graph.vp.worldToCanvas(x, 0); fillCircle(app, (cx + 0.5) | 0, (cy + 0.5) | 0, 5, col); }
  }
}
