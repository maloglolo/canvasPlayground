/* ==============================
 * color / blending
 * ============================== */
const NAMED = {
  black: [0, 0, 0, 255], white: [255, 255, 255, 255], red: [255, 0, 0, 255], green: [0, 255, 0, 255],
  blue: [0, 0, 255, 255], yellow: [255, 255, 0, 255], cyan: [0, 255, 255, 255], magenta: [255, 0, 255, 255],
  gray: [128, 128, 128, 255], grey: [128, 128, 128, 255], orange: [255, 165, 0, 255]
};

function parseColor(c) {
  if (Array.isArray(c)) {
    if (c.length === 3) return [c[0], c[1], c[2], 255];
    if (c.length === 4) return c.slice(0, 4);
    return [255, 255, 255, 255];
  }
  if (typeof c !== "string") return [255, 255, 255, 255];
  const s = c.trim().toLowerCase();

  if (s in NAMED) return NAMED[s].slice();

  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return [r, g, b, 255];
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return [r, g, b, 255];
    }
  }

  // rgba(r,g,b,a)
  const m = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([01](?:\.\d+)?))?\s*\)$/i);
  if (m) {
    const r = Math.max(0, Math.min(255, Math.round(parseFloat(m[1]))));
    const g = Math.max(0, Math.min(255, Math.round(parseFloat(m[2]))));
    const b = Math.max(0, Math.min(255, Math.round(parseFloat(m[3]))));
    const a = m[4] == null ? 1 : Math.max(0, Math.min(1, parseFloat(m[4])));
    return [r, g, b, Math.round(a * 255)];
  }

  return [255, 255, 255, 255];
}

function blend(dst, sr, sg, sb, sa) {
  // dst: [dr,dg,db,da] (0-255 each), source as components
  const da = dst[3] / 255;
  const saN = sa / 255;
  const outA = saN + da * (1 - saN);
  if (outA === 0) return [0, 0, 0, 0];
  const r = (sr * saN + dst[0] * da * (1 - saN)) / outA;
  const g = (sg * saN + dst[1] * da * (1 - saN)) / outA;
  const b = (sb * saN + dst[2] * da * (1 - saN)) / outA;
  return [Math.round(r), Math.round(g), Math.round(b), Math.round(outA * 255)];
}

/* ==============================
 * ImageData buffer
 * ============================== */
class CanvasApp {
  constructor() {
    this.canvas = document.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.size = { x: window.innerWidth, y: window.innerHeight };
    this.resizeCanvas();

    this.buffer = this.ctx.createImageData(this.size.x, this.size.y);
    this.pixels = this.buffer.data; // Uint8ClampedArray

    // offcreen canvas text
    this.textCanvas = document.createElement("canvas");
    this.textCtx = this.textCanvas.getContext("2d");

    this.resizeCallbacks = [];
    this.renderables = [];

    window.addEventListener("resize", () => this.onResize());
  }

  resizeCanvas() {
    this.canvas.width = this.size.x;
    this.canvas.height = this.size.y;
  }

  onResize() {
    this.size = { x: window.innerWidth, y: window.innerHeight };
    this.resizeCanvas();
    this.buffer = this.ctx.createImageData(this.size.x, this.size.y);
    this.pixels = this.buffer.data;
    this.renderAll();
    this.resizeCallbacks.forEach(cb => cb());
  }

  onResizeCallback(cb) { this.resizeCallbacks.push(cb); }
  addRenderable(obj) { this.renderables.push(obj); }

  clear(color = "#131313") {
    const [r, g, b, a] = parseColor(color);
    for (let i = 0; i < this.pixels.length; i += 4) {
      this.pixels[i] = r;
      this.pixels[i + 1] = g;
      this.pixels[i + 2] = b;
      this.pixels[i + 3] = a;
    }
  }

  putPixel(x, y, color = [255, 255, 255, 255]) {
    if (x < 0 || y < 0 || x >= this.size.x || y >= this.size.y) return;
    const idx = (y * this.size.x + x) * 4;
    this.pixels[idx] = color[0];
    this.pixels[idx + 1] = color[1];
    this.pixels[idx + 2] = color[2];
    this.pixels[idx + 3] = color[3];
  }

  putPixelBlend(x, y, color) {
    if (x < 0 || y < 0 || x >= this.size.x || y >= this.size.y) return;
    const idx = (y * this.size.x + x) * 4;
    const sa = color[3] / 255;
    const da = this.pixels[idx + 3] / 255;
    const outA = sa + da * (1 - sa);
    if (outA === 0) {
      this.pixels[idx] = 0;
      this.pixels[idx + 1] = 0;
      this.pixels[idx + 2] = 0;
      this.pixels[idx + 3] = 0;
      return;
    }
    const invA = 1 - sa;
    this.pixels[idx] = Math.round((color[0] * sa + this.pixels[idx] * da * invA) / outA);
    this.pixels[idx + 1] = Math.round((color[1] * sa + this.pixels[idx + 1] * da * invA) / outA);
    this.pixels[idx + 2] = Math.round((color[2] * sa + this.pixels[idx + 2] * da * invA) / outA);
    this.pixels[idx + 3] = Math.round(outA * 255);
  }

  render() {
    this.ctx.putImageData(this.buffer, 0, 0);
  }

  renderAll() {
    this.clear();
    this.renderables.forEach(obj => obj.draw(this));
    this.render();
  }

  blitImageData(srcImageData, dx, dy) {
    const sw = srcImageData.width;
    const sh = srcImageData.height;
    const src = srcImageData.data;
    for (let y = 0; y < sh; y++) {
      const ty = dy + y;
      if (ty < 0 || ty >= this.size.y) continue;
      for (let x = 0; x < sw; x++) {
        const tx = dx + x;
        if (tx < 0 || tx >= this.size.x) continue;
        const sIdx = (y * sw + x) * 4;
        const color = [src[sIdx], src[sIdx + 1], src[sIdx + 2], src[sIdx + 3]];
        this.putPixelBlend(tx, ty, color);
      }
    }
  }

  // draw text on offscreen canvas
  drawText(text, x, y, color = "#fff", font = "12px sans-serif") {
    const key = `${text}|${font}|${color}`;
    if (!this.textCache) this.textCache = new Map();
    if (!this.textCache.has(key)) {
      const ctx = this.textCtx;
      ctx.font = font;
      const metrics = ctx.measureText(text);
      const w = Math.ceil(metrics.width + 4);
      const h = Math.ceil((metrics.actualBoundingBoxAscent || 10) + (metrics.actualBoundingBoxDescent || 4) + 4);
      if (this.textCanvas.width < w || this.textCanvas.height < h) {
        this.textCanvas.width = w;
        this.textCanvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.fillText(text, 2, 2 + (metrics.actualBoundingBoxAscent || 10));
      this.textCache.set(key, ctx.getImageData(0, 0, w, h));
    }
    const img = this.textCache.get(key);
    this.blitImageData(img, x, y);
  }
}

class ViewportManager {
  constructor(app, worldBounds, viewport, preserveAspect = false) {
    this.app = app;
    this.worldBounds = worldBounds;
    this._viewport = viewport || { x: 0, y: 0, width: app.size.x, height: app.size.y };
    this.preserveAspect = preserveAspect;
  }

  get viewport() {
    return typeof this._viewport === "function" ? this._viewport(this.app) : this._viewport;
  }

  get scale() {
    const { xMin, xMax, yMin, yMax } = this.worldBounds;
    const xRange = xMax - xMin;
    const yRange = yMax - yMin;
    const vp = this.viewport;

    if (!this.preserveAspect) return { x: vp.width / xRange, y: vp.height / yRange };

    const viewRatio = vp.width / vp.height;
    const dataRatio = xRange / yRange;
    const s = viewRatio > dataRatio ? vp.height / yRange : vp.width / xRange;
    return { x: s, y: s };
  }

  worldToCanvas(x, y) {
    const vp = this.viewport;
    const { xMin, xMax, yMin, yMax } = this.worldBounds;
    const xRange = xMax - xMin;
    const yRange = yMax - yMin;

    if (this.preserveAspect) {
      const s = this.scale.x;
      const scaledWidth = s * xRange;
      const scaledHeight = s * yRange;
      const offsetX = vp.x + (vp.width - scaledWidth) / 2;
      const offsetY = vp.y + (vp.height - scaledHeight) / 2;
      return [
        offsetX + (x - xMin) * s,
        offsetY + (yRange - (y - yMin)) * s
      ];
    } else {
      const { x: scaleX, y: scaleY } = this.scale;
      return [
        vp.x + (x - xMin) * scaleX,
        vp.y + (yMax - y) * scaleY
      ];
    }
  }
}

/* ==============================
 * rasterizers
 * ============================== */
function drawLine(app, x0, y0, x1, y1, color) {
  const col = parseColor(color);
  x0 = Math.round(x0); y0 = Math.round(y0);
  x1 = Math.round(x1); y1 = Math.round(y1);

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;

  let err = dx - dy;
  const pixels = app.pixels;

  const indices = [];
  while (true) {
    indices.push(y0 * app.size.x + x0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  // blend pixels
  for (const idx of indices) {
    const i = idx * 4;
    const da = pixels[i + 3] / 255;
    const sa = col[3] / 255;
    const outA = sa + da * (1 - sa);
    const invA = 1 - sa;
    pixels[i] = Math.round((col[0] * sa + pixels[i] * da * invA) / outA);
    pixels[i + 1] = Math.round((col[1] * sa + pixels[i + 1] * da * invA) / outA);
    pixels[i + 2] = Math.round((col[2] * sa + pixels[i + 2] * da * invA) / outA);
    pixels[i + 3] = Math.round(outA * 255);
  }
}

function drawThickLine(app, ax, ay, bx, by, width, color) {
  const col = parseColor(color);
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const px = -uy * width / 2, py = ux * width / 2;

  const poly = [
    [ax + px, ay + py],
    [bx + px, by + py],
    [bx - px, by - py],
    [ax - px, ay - py]
  ];
  fillPolygon(app, poly, col);

  fillCircle(app, ax, ay, width / 2, col);
  fillCircle(app, bx, by, width / 2, col);
}

function drawCircleOutline(app, cx, cy, r, color, segments = 64) {
  const col = parseColor(color);
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * 2 * Math.PI;
    pts.push([cx + r * Math.cos(theta), cy + r * Math.sin(theta)]);
  }
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    drawThickLine(app, x0, y0, x1, y1, 1, col);
  }
}

function fillCircle(app, cx, cy, r, color) {
  const col = parseColor(color);
  const r2 = r * r;
  const xMin = Math.max(0, Math.floor(cx - r));
  const xMax = Math.min(app.size.x - 1, Math.ceil(cx + r));
  const yMin = Math.max(0, Math.floor(cy - r));
  const yMax = Math.min(app.size.y - 1, Math.ceil(cy + r));

  const pixels = app.pixels;
  for (let y = yMin; y <= yMax; y++) {
    const dy = y - cy;
    const dy2 = dy * dy;
    let idx = (y * app.size.x + xMin) * 4;
    for (let x = xMin; x <= xMax; x++, idx += 4) {
      const dx = x - cx;
      if (dx * dx + dy2 <= r2) {
        const da = pixels[idx + 3] / 255;
        const sa = col[3] / 255;
        const outA = sa + da * (1 - sa);
        const invA = 1 - sa;
        pixels[idx] = Math.round((col[0] * sa + pixels[idx] * da * invA) / outA);
        pixels[idx + 1] = Math.round((col[1] * sa + pixels[idx + 1] * da * invA) / outA);
        pixels[idx + 2] = Math.round((col[2] * sa + pixels[idx + 2] * da * invA) / outA);
        pixels[idx + 3] = Math.round(outA * 255);
      }
    }
  }
}
// scanline method
// https://uea-teaching.github.io/graphics1-2022/lectures/polygon-filling.html#/active-linked-list-7  
// https://stackoverflow.com/questions/65573101/draw-a-filled-polygon-using-scanline-loop  
// TODO: this is still slow

function fillPolygon(app, points, color) {
  if (points.length < 3) return;
  const col = parseColor(color);
  const n = points.length;
  const rounded = points.map(p => [Math.round(p[0]), Math.round(p[1])]);

  let minY = Infinity, maxY = -Infinity;
  for (const [_, y] of rounded) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  minY = Math.max(0, minY);
  maxY = Math.min(app.size.y - 1, maxY);

  const pixels = app.pixels;

  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < n; i++) {
      const [xi, yi] = rounded[i];
      const [xj, yj] = rounded[(i + 1) % n];
      if ((yi > y) !== (yj > y)) xs.push(Math.round(xi + (y - yi) * (xj - xi) / (yj - yi)));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k < xs.length; k += 2) {
      const xStart = Math.max(0, xs[k]);
      const xEnd = Math.min(app.size.x - 1, xs[k + 1]);
      let idx = (y * app.size.x + xStart) * 4;
      for (let x = xStart; x <= xEnd; x++, idx += 4) {
        const da = pixels[idx + 3] / 255;
        const sa = col[3] / 255;
        const outA = sa + da * (1 - sa);
        const invA = 1 - sa;
        pixels[idx] = Math.round((col[0] * sa + pixels[idx] * da * invA) / outA);
        pixels[idx + 1] = Math.round((col[1] * sa + pixels[idx + 1] * da * invA) / outA);
        pixels[idx + 2] = Math.round((col[2] * sa + pixels[idx + 2] * da * invA) / outA);
        pixels[idx + 3] = Math.round(outA * 255);
      }
    }
  }
}

/* ==============================
 * graph raster
 * ============================== */
class Graph {
  constructor(viewportManager, options = {}) {
    this.vp = viewportManager;
    this.tickSize = options.tickSize || 10;
    this.numTicksX = options.numTicksX || 10;
    this.numTicksY = options.numTicksY || 10;
    this.font = options.font || "12px sans-serif";
    this.color = parseColor(options.color || "#F9FBFF");
    this.textColor = options.color || "#F9FBFF";
  }

  draw(app) {
    const { xMin, xMax, yMin, yMax } = this.vp.worldBounds;
    const dx = (xMax - xMin) / this.numTicksX;
    const dy = (yMax - yMin) / this.numTicksY;

    // grid lines
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

    // labels via text blit
    const yAxisCanvas = (yMin <= 0 && yMax >= 0) ? this.vp.worldToCanvas(0, 0)[1] : this.vp.worldToCanvas(0, yMin)[1];
    for (let i = 0; i <= this.numTicksX; i++) {
      const x = xMin + i * dx;
      const [cx, _cy] = this.vp.worldToCanvas(x, yMin);
      app.drawText(x.toFixed(0), Math.round(cx), Math.round(yAxisCanvas + 4), this.textColor, this.font, "center", "top");
    }
    const xAxisCanvas = (xMin <= 0 && xMax >= 0) ? this.vp.worldToCanvas(0, 0)[0] : this.vp.worldToCanvas(xMin, 0)[0];
    for (let j = 0; j <= this.numTicksY; j++) {
      const y = yMin + j * dy;
      const [_cx, cy] = this.vp.worldToCanvas(xMin, y);
      app.drawText(y.toFixed(0), Math.round(xAxisCanvas + 15), Math.round(cy), this.textColor, this.font, "right", "middle");
    }
  }
}

/* ==============================
 * elements raster
 * ============================== */
class DrawableFunction {
  constructor(data, color = "red", fill = false, fillColor = "rgba(255,0,0,0.3)") {
    this.data = data;
    this.color = color;
    this.fill = fill;
    this.fillColor = fillColor;
  }

  draw(app, graph) {
    if (!graph) throw "Graph reference required";
    if (!this.data.length) return;

    // stroke
    let [px, py] = graph.vp.worldToCanvas(this.data[0].x, this.data[0].y);
    for (let i = 1; i < this.data.length; i++) {
      const [nx, ny] = graph.vp.worldToCanvas(this.data[i].x, this.data[i].y);
      drawLine(app, px, py, nx, ny, this.color);
      px = nx; py = ny;
    }
    if (this.fill) {
      const pts = [];
      for (let i = 0; i < this.data.length; i++) {
        pts.push(graph.vp.worldToCanvas(this.data[i].x, this.data[i].y));
      }

      const last = this.data[this.data.length - 1];
      const first = this.data[0];
      pts.push(graph.vp.worldToCanvas(last.x, 0));
      pts.push(graph.vp.worldToCanvas(first.x, 0));
      fillPolygon(app, pts, this.fillColor);
    }
  }
}

class DrawableCircle {
  constructor(center = { x: 0, y: 0 }, radius = 1, color = "white", segments = 64, fill = false, fillColor = null) {
    this.center = center;
    this.radius = radius;
    this.color = color;
    this.segments = segments; // unused 
    this.fill = fill;
    this.fillColor = fillColor || color;
  }

  draw(app, graph) {
    const [cx, cy] = graph.vp.worldToCanvas(this.center.x, this.center.y);
    const scale = graph.vp.scale.x; // assume uniform
    const r = Math.max(1, Math.round(this.radius * scale));

    if (this.fill) fillCircle(app, cx | 0, cy | 0, r, this.fillColor);
    drawCircleOutline(app, cx, cy, r, this.color);
  }
}

class DrawableLine {
  constructor(p1, p2, color = "yellow", width = 2) {
    this.p1 = p1;
    this.p2 = p2;
    this.color = color;
    this.width = Math.max(1, width | 0);
  }

  draw(app, graph) {
    const [x0, y0] = graph.vp.worldToCanvas(this.p1.x, this.p1.y);
    const [x1, y1] = graph.vp.worldToCanvas(this.p2.x, this.p2.y);
    if (this.width <= 1) drawLine(app, x0, y0, x1, y1, this.color);
    else drawThickLine(app, x0, y0, x1, y1, this.width, this.color);
  }
}

class DrawableText {
  constructor(text, pos, color = "white", font = "14px sans-serif", align = "right", baseline = "bottom") {
    this.text = text;
    this.pos = pos;
    this.color = color;
    this.font = font;
    this.align = align;
    this.baseline = baseline;
  }

  draw(app, graph) {
    const [x, y] = graph.vp.worldToCanvas(this.pos.x, this.pos.y);
    app.drawText(this.text, x, y, this.color, this.font, this.align, this.baseline);
  }
}

class DrawableTriangle {
  constructor(p1, p2, p3, color = "yellow", fill = true, fillColor = "rgba(255,255,0,0.5)") {
    this.points = [p1, p2, p3];
    this.color = color;
    this.fill = fill;
    this.fillColor = fillColor;
  }

  draw(app, obj) {
    const vp = obj.vp || obj;
    const pts = this.points.map(p => vp.worldToCanvas(p.x, p.y));

    if (this.fill) fillPolygon(app, pts, this.fillColor);

    // outline
    for (let i = 0; i < 3; i++) {
      const a = pts[i], b = pts[(i + 1) % 3];
      drawLine(app, a[0], a[1], b[0], b[1], this.color);
    }
  }
}

/* ==============================
 * tools
 * ============================== */
function rotatePoint(p, center, angle) {
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  };
}

function rotateTriangleAroundCenter(tri, center, angle) {
  tri.points = tri.points.map(p => rotatePoint(p, center, angle));
}

function rotateTriangleVertical(tri, center, angle) {
  tri.points = tri.points.map(p => {
    const dx = p.x - center.x;
    const dz = 0;
    const newX = dx * Math.cos(angle) + dz * Math.sin(angle);
    return { x: center.x + newX, y: p.y };
  });
}

function projectYRotation(point, center, angle) {
  const dx = point.x - center.x;
  const xRot = center.x + dx * Math.cos(angle);
  return { x: xRot, y: point.y };
}

class Intercepts {
  static findX(series) {
    const intercepts = [];
    for (let i = 1; i < series.length; i++) {
      const y1 = series[i - 1].y, y2 = series[i].y;
      if (y1 === 0) intercepts.push(series[i - 1].x);
      else if (y1 * y2 < 0) {
        const x1 = series[i - 1].x, x2 = series[i].x;
        intercepts.push(x1 + (-y1 / (y2 - y1)) * (x2 - x1));
      }
    }
    return intercepts;
  }

  static drawX(app, graph, series, color = "yellow") {
    const col = parseColor(color);
    Intercepts.findX(series).forEach(x => {
      const [cx, cy] = graph.vp.worldToCanvas(x, 0);
      fillCircle(app, Math.round(cx), Math.round(cy), 5, col);
    });
  }
}

export {
  CanvasApp,
  Graph,
  DrawableFunction,
  DrawableCircle,
  DrawableTriangle,
  DrawableLine,
  DrawableText,
  Intercepts,
  ViewportManager,
  rotatePoint,
  rotateTriangleAroundCenter,
  rotateTriangleVertical,
  projectYRotation
};