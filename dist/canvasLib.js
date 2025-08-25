// src/v2.ts
var V2 = class _V2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  clone() {
    return new _V2(this.x, this.y);
  }
  add(v) {
    return new _V2(this.x + v.x, this.y + v.y);
  }
  sub(v) {
    return new _V2(this.x - v.x, this.y - v.y);
  }
  scale(sx, sy = sx) {
    return new _V2(this.x * sx, this.y * sy);
  }
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }
  perp() {
    return new _V2(-this.y, this.x);
  }
  len() {
    return Math.hypot(this.x, this.y);
  }
  norm() {
    const l = this.len() || 1;
    return new _V2(this.x / l, this.y / l);
  }
  /** Rotate around optional pivot. Angle in radians, positive = CCW */
  rotate(angle, around = null) {
    const c = Math.cos(angle), s = Math.sin(angle);
    let x = this.x, y = this.y;
    if (around) {
      x -= around.x;
      y -= around.y;
    }
    const xr = x * c - y * s;
    const yr = x * s + y * c;
    return around ? new _V2(xr + around.x, yr + around.y) : new _V2(xr, yr);
  }
  toArray() {
    return [this.x, this.y];
  }
  static fromArray(a) {
    return new _V2(a[0], a[1]);
  }
  static lerp(a, b, t) {
    return new _V2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  }
};

// src/color.ts
var NAMED = Object.freeze({
  black: [0, 0, 0, 255],
  white: [255, 255, 255, 255],
  red: [255, 0, 0, 255],
  green: [0, 255, 0, 255],
  blue: [0, 0, 255, 255],
  yellow: [255, 255, 0, 255],
  cyan: [0, 255, 255, 255],
  magenta: [255, 0, 255, 255],
  gray: [128, 128, 128, 255],
  grey: [128, 128, 128, 255],
  orange: [255, 165, 0, 255],
  transparent: [0, 0, 0, 0]
});
function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function parseColor(c) {
  if (Array.isArray(c)) {
    const [r, g, b, a = 255] = c;
    return [r | 0, g | 0, b | 0, a | 0];
  }
  if (typeof c !== "string") return null;
  const s = c.trim().toLowerCase();
  if (s in NAMED) return NAMED[s];
  if (s[0] === "#") {
    const hex = s.slice(1);
    const len = hex.length;
    const hx = (i) => parseInt(hex[i] + (len < 6 ? hex[i] : hex[i + 1] || hex[i]), 16);
    switch (len) {
      case 3:
        return [hx(0), hx(1), hx(2), 255];
      case 4:
        return [hx(0), hx(1), hx(2), hx(3)];
      case 6:
        return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 255];
      case 8:
        return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), parseInt(hex.slice(6, 8), 16)];
      default:
        return null;
    }
  }
  if (s.startsWith("rgb")) {
    const nums = s.match(/\d+\.?\d*/g);
    if (!nums || nums.length !== 3 && nums.length !== 4) return null;
    const r = clamp255(+nums[0]);
    const g = clamp255(+nums[1]);
    const b = clamp255(+nums[2]);
    const a = nums[3] == null ? 255 : clamp01(+nums[3]) * 255 + 0.5 | 0;
    return [r, g, b, a];
  }
  return null;
}
function packABGR(r, g, b, a) {
  return a << 24 | b << 16 | g << 8 | r;
}
function unpackABGR(px) {
  return [px & 255, px >>> 8 & 255, px >>> 16 & 255, px >>> 24 & 255];
}
function blendRGBA(dr, dg, db, da, sr, sg, sb, sa) {
  const dna = da / 255, sna = sa / 255;
  const outA = sna + dna * (1 - sna);
  if (outA <= 0) return [0, 0, 0, 0];
  const inv = 1 - sna;
  const r = (sr * sna + dr * dna * inv) / outA;
  const g = (sg * sna + dg * dna * inv) / outA;
  const b = (sb * sna + db * dna * inv) / outA;
  return [r, g, b, outA * 255];
}
function toColor(col) {
  if (Array.isArray(col)) {
    const arr = col;
    const rgba = [
      arr[0] | 0,
      arr[1] | 0,
      arr[2] | 0,
      (arr[3] ?? 255) | 0
    ];
    return rgba;
  } else {
    return parseColor(col) || NAMED.white;
  }
}

// src/raster.ts
function rawLine(app, p0, p1, color) {
  const col = color;
  let x0 = Math.round(p0.x), y0 = Math.round(p0.y);
  const x1 = Math.round(p1.x), y1 = Math.round(p1.y);
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  const buf = app.buffer;
  while (true) {
    buf.putPixelBlend(x0, y0, col);
    if (x0 === x1 && y0 === y1) break;
    const e2 = err << 1;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}
function rawPoint(app, pos, color, { type = "circle", size = 3 } = {}) {
  if (type === "circle") {
    fillCircle(app, pos, size, color);
  } else if (type === "cross") {
    rawLine(app, new V2(pos.x - size, pos.y), new V2(pos.x + size, pos.y), color);
    rawLine(app, new V2(pos.x, pos.y - size), new V2(pos.x, pos.y + size), color);
  } else if (type === "square") {
    const half = size | 0;
    const p = [new V2(pos.x - half, pos.y - half), new V2(pos.x + half, pos.y - half), new V2(pos.x + half, pos.y + half), new V2(pos.x - half, pos.y + half)];
    strokeShape(app, p, color, 1);
  }
}
function strokeShape(app, points, color, width = 1) {
  for (let i = 0; i < points.length; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    if (width <= 1) {
      rawLine(app, p0, p1, color);
      continue;
    }
    const d = p1.sub(p0);
    const len = d.len() || 1;
    const u = d.scale(1 / len);
    const n = new V2(-u.y, u.x);
    const half = width / 2 | 0;
    for (let o = -half; o <= half; o++) {
      const off = n.scale(o);
      rawLine(app, p0.add(off), p1.add(off), color);
    }
  }
}
function fillCircle(app, c, r, color) {
  const r2 = r * r;
  const xMin = Math.max(0, Math.floor(c.x) | 0);
  const xMax = Math.min(app.buffer.width - 1, Math.ceil(c.x) | 0);
  const yMin = Math.max(0, Math.floor(c.y) | 0);
  const yMax = Math.min(app.buffer.height - 1, Math.ceil(c.y) | 0);
  const pix = app.buffer.pixels;
  const w = app.buffer.width;
  for (let y = yMin; y <= yMax; y++) {
    const dy = y - c.y;
    const dy2 = dy * dy;
    let idx = (y * w + xMin | 0) * 4;
    for (let x = xMin; x <= xMax; x++, idx += 4) {
      const dx = x - c.x;
      if (dx * dx + dy2 <= r2) {
        const dr = pix[idx], dg = pix[idx + 1], db = pix[idx + 2], da = pix[idx + 3];
        const [r0, g0, b0, a0] = blendRGBA(dr, dg, db, da, color[0], color[1], color[2], color[3]);
        pix[idx] = r0 + 0.5 | 0;
        pix[idx + 1] = g0 + 0.5 | 0;
        pix[idx + 2] = b0 + 0.5 | 0;
        pix[idx + 3] = a0 + 0.5 | 0;
      }
    }
  }
}
function fillPolygon(app, points, color) {
  const n = points?.length | 0;
  if (n < 3) return;
  const h = app.buffer.height | 0, w = app.buffer.width | 0;
  let minY = Infinity, maxY = -Infinity;
  const edges = [];
  for (let i = 0; i < n; i++) {
    const p1 = points[i], p2 = points[(i + 1) % n];
    const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
    if (y1 === y2) continue;
    const ymin = Math.min(y1, y2), ymax = Math.max(y1, y2);
    const xAtYmin = y1 < y2 ? x1 : x2;
    const invSlope = (x2 - x1) / (y2 - y1);
    edges.push({ ymin, ymax, x: xAtYmin, invSlope });
    if (ymin < minY) minY = ymin;
    if (ymax > maxY) maxY = ymax;
  }
  minY = Math.max(0, Math.floor(minY) | 0);
  maxY = Math.min(h - 1, Math.ceil(maxY) | 0);
  const pix = app.buffer.pixels;
  for (let y = minY; y <= maxY; y++) {
    const crossings = [];
    for (const e of edges) if (y >= e.ymin && y < e.ymax) crossings.push(e.x + (y - e.ymin) * e.invSlope);
    if (!crossings.length) continue;
    crossings.sort((a, b) => a - b);
    for (let k = 0; k < crossings.length; k += 2) {
      const xStart = Math.max(0, Math.floor(crossings[k]) | 0);
      const xEnd = Math.min(w - 1, Math.ceil(crossings[k + 1]) | 0);
      let idx = (y * w + xStart | 0) * 4;
      for (let x = xStart; x <= xEnd; x++, idx += 4) {
        const dr = pix[idx], dg = pix[idx + 1], db = pix[idx + 2], da = pix[idx + 3];
        const [r0, g0, b0, a0] = blendRGBA(dr, dg, db, da, color[0], color[1], color[2], color[3]);
        pix[idx] = r0 + 0.5 | 0;
        pix[idx + 1] = g0 + 0.5 | 0;
        pix[idx + 2] = b0 + 0.5 | 0;
        pix[idx + 3] = a0 + 0.5 | 0;
      }
    }
  }
}
var drawLine = (app, p0, p1, color, width = 1) => strokeShape(app, [p0, p1], color, width);
function drawCircleOutline(app, c, r, color, width = 1, segments = 32) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const t = i / segments * Math.PI * 2;
    pts.push(new V2(c.x + r * Math.cos(t), c.y + r * Math.sin(t)));
  }
  strokeShape(app, pts, color, width);
}

// src/graph.ts
function decimalsForStep(step) {
  if (!isFinite(step) || step <= 0) return 0;
  const s = Math.abs(step);
  if (s >= 1) return 0;
  return Math.min(6, Math.ceil(-Math.log10(s)));
}
function fmtTick(x, decimals) {
  const n = +x.toFixed(decimals);
  const z = Math.abs(n) < 1e-12 ? 0 : n;
  return z.toFixed(decimals);
}
var Graph = class {
  constructor(vp, options = {}) {
    this.vp = vp;
    this.showGrid = options.showGrid !== false;
    this.showAxes = options.showAxes !== false;
    this.showTicks = options.showTicks !== false;
    this.drawBorder = options.drawBorder || false;
    this.axisAtZero = options.axisAtZero !== false;
    this.gridColor = parseColor(options.gridColor || "#2a2a2a");
    this.axisColor = parseColor(options.axisColor || "#888");
    this.borderColor = parseColor(options.borderColor || "#555");
    this.tickSizePx = options.tickSizePx ?? 6;
    this.numTicksX = options.numTicksX;
    this.numTicksY = options.numTicksY;
    this.font = options.font || "12px sans-serif";
    this.textColor = options.textColor || "#fff";
    this.margin = options.margin || (vp.viewport?.margin ?? 30);
    this.autoScale = options.autoScale !== false;
  }
  draw(app, dataSeries = []) {
    const vp = this.vp.viewport;
    let xMin = 0, xMax = 1, yMin = 0, yMax = 1;
    if (this.vp.worldBounds) ({ xMin, xMax, yMin, yMax } = this.vp.worldBounds);
    if (this.autoScale && dataSeries.length > 0) {
      const allX = dataSeries.flatMap((series) => series.map((p) => p.x));
      const allY = dataSeries.flatMap((series) => series.map((p) => p.y));
      xMin = Math.min(...allX);
      xMax = Math.max(...allX);
      yMin = Math.min(...allY);
      yMax = Math.max(...allY);
      if (!(isFinite(xMin) && isFinite(xMax) && isFinite(yMin) && isFinite(yMax))) {
        xMin = 0;
        xMax = 1;
        yMin = 0;
        yMax = 1;
      }
      if (xMin === xMax) {
        xMin -= 0.5;
        xMax += 0.5;
      }
      if (yMin === yMax) {
        yMin -= 0.5;
        yMax += 0.5;
      }
    }
    const xTicks = this.numTicksX ? Array.from({ length: this.numTicksX + 1 }, (_, i) => xMin + i * ((xMax - xMin) / this.numTicksX)) : computeTicks(xMin, xMax);
    const yTicks = this.numTicksY ? Array.from({ length: this.numTicksY + 1 }, (_, i) => yMin + i * ((yMax - yMin) / this.numTicksY)) : computeTicks(yMin, yMax);
    const safeXTicks = xTicks.length >= 2 ? xTicks : [xMin, xMax];
    const safeYTicks = yTicks.length >= 2 ? yTicks : [yMin, yMax];
    this.vp.worldBounds = {
      xMin: Math.min(safeXTicks[0], xMin),
      xMax: Math.max(safeXTicks[safeXTicks.length - 1], xMax),
      yMin: Math.min(safeYTicks[0], yMin),
      yMax: Math.max(safeYTicks[safeYTicks.length - 1], yMax)
    };
    const dx = safeXTicks[1] - safeXTicks[0] || xMax - xMin || 1;
    const dy = safeYTicks[1] - safeYTicks[0] || yMax - yMin || 1;
    const decimalsX = decimalsForStep(Math.abs(dx));
    const decimalsY = decimalsForStep(Math.abs(dy));
    const plotLeft = vp.x, plotRight = vp.x + vp.width;
    const plotTop = vp.y, plotBottom = vp.y + vp.height;
    if (this.showGrid) {
      for (const x of safeXTicks) {
        const p0 = this.vp.worldToCanvas(x, this.vp.worldBounds.yMin);
        const p1 = this.vp.worldToCanvas(x, this.vp.worldBounds.yMax);
        drawLine(app, p0, p1, this.gridColor);
      }
      for (const y of safeYTicks) {
        const p0 = this.vp.worldToCanvas(this.vp.worldBounds.xMin, y);
        const p1 = this.vp.worldToCanvas(this.vp.worldBounds.xMax, y);
        drawLine(app, p0, p1, this.gridColor);
      }
    }
    if (this.showAxes) {
      if (!this.axisAtZero) {
        drawLine(app, new V2(plotLeft, plotTop), new V2(plotLeft, plotBottom), this.axisColor, 2);
        drawLine(app, new V2(plotLeft, plotBottom), new V2(plotRight, plotBottom), this.axisColor, 2);
      } else {
        if (this.vp.worldBounds.xMin <= 0 && this.vp.worldBounds.xMax >= 0) {
          const p0 = this.vp.worldToCanvas(0, this.vp.worldBounds.yMin);
          const p1 = this.vp.worldToCanvas(0, this.vp.worldBounds.yMax);
          drawLine(app, p0, p1, this.axisColor, 2);
        }
        if (this.vp.worldBounds.yMin <= 0 && this.vp.worldBounds.yMax >= 0) {
          const p0 = this.vp.worldToCanvas(this.vp.worldBounds.xMin, 0);
          const p1 = this.vp.worldToCanvas(this.vp.worldBounds.xMax, 0);
          drawLine(app, p0, p1, this.axisColor, 2);
        }
      }
    }
    if (this.showTicks && this.tickSizePx > 0) {
      const t = this.tickSizePx | 0;
      for (const x of safeXTicks) {
        const px = this.vp.worldToCanvas(x, this.vp.worldBounds.yMin).x;
        const p0 = new V2(px, plotBottom);
        const p1 = new V2(px, plotBottom - t);
        drawLine(app, p0, p1, this.axisColor);
      }
      for (const y of safeYTicks) {
        const py = this.vp.worldToCanvas(this.vp.worldBounds.xMin, y).y;
        const p0 = new V2(plotLeft, py);
        const p1 = new V2(plotLeft + t, py);
        drawLine(app, p0, p1, this.axisColor);
      }
    }
    for (const x of safeXTicks) {
      const p = this.vp.worldToCanvas(x, this.vp.worldBounds.yMin);
      const lx = Math.max(plotLeft, Math.min(p.x, plotRight));
      const ly = vp.y + vp.height + this.margin / 2;
      app.drawText(fmtTick(x, decimalsX), new V2(lx, ly), this.textColor, this.font, "center", "top");
    }
    for (const y of safeYTicks) {
      const p = this.vp.worldToCanvas(this.vp.worldBounds.xMin, y);
      const lx = vp.x - this.margin / 2;
      const ly = Math.max(plotTop, Math.min(p.y, plotBottom));
      app.drawText(fmtTick(y, decimalsY), new V2(lx, ly), this.textColor, this.font, "right", "middle");
    }
    if (this.drawBorder) {
      const tl = new V2(plotLeft, plotTop);
      const tr = new V2(plotRight, plotTop);
      const br = new V2(plotRight, plotBottom);
      const bl = new V2(plotLeft, plotBottom);
      drawLine(app, tl, tr, this.borderColor, 1);
      drawLine(app, tr, br, this.borderColor, 1);
      drawLine(app, br, bl, this.borderColor, 1);
      drawLine(app, bl, tl, this.borderColor, 1);
    }
  }
};
function computeTicks(min, max, maxTicks = 10) {
  const range = max - min;
  if (!isFinite(range) || range === 0) return [min, max];
  const roughStep = range / maxTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(roughStep))));
  const niceSteps = [1, 2, 5, 10];
  const step = (niceSteps.find((s) => s * mag >= roughStep) ?? 10) * mag;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const numSteps = Math.round((niceMax - niceMin) / step);
  const ticks = [];
  for (let i = 0; i <= numSteps; i++) ticks.push(parseFloat((niceMin + i * step).toFixed(10)));
  return ticks;
}

// src/transform2d.ts
var Transform2D = class _Transform2D {
  constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
  }
  static identity() {
    return new _Transform2D();
  }
  static translation(tx, ty) {
    return new _Transform2D(1, 0, 0, 1, tx, ty);
  }
  static scale(sx, sy = sx) {
    return new _Transform2D(sx, 0, 0, sy, 0, 0);
  }
  static rotation(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return new _Transform2D(c, s, -s, c, 0, 0);
  }
  static fromCanvasTransform(a, b, c, d, e, f) {
    return new _Transform2D(a, b, c, d, e, f);
  }
  /** this ∘ m (apply m first, then this) */
  multiply(m) {
    return new _Transform2D(
      this.a * m.a + this.c * m.b,
      this.b * m.a + this.d * m.b,
      this.a * m.c + this.c * m.d,
      this.b * m.c + this.d * m.d,
      this.a * m.e + this.c * m.f + this.e,
      this.b * m.e + this.d * m.f + this.f
    );
  }
  transformV2(v) {
    return new V2(
      this.a * v.x + this.c * v.y + this.e,
      this.b * v.x + this.d * v.y + this.f
    );
  }
  /** Build a transform applied around a pivot: T(p) * mat * T(-p) */
  static around(pivot, mat) {
    return _Transform2D.translation(pivot.x, pivot.y).multiply(mat).multiply(_Transform2D.translation(-pivot.x, -pivot.y));
  }
};

// src/drawables.ts
var Drawable = class {
  constructor(color = "white", fill = false, fillColor = null, transform = Transform2D.identity()) {
    this.color = color;
    this.fill = fill;
    this.fillColor = fillColor;
    this.transform = transform;
    if (!this.fillColor) this.fillColor = color;
  }
  parseColorSafe(input) {
    return [...parseColor(input) ?? [255, 255, 255, 255]];
  }
};
var DrawableFunction = class extends Drawable {
  constructor(data, opts = {}) {
    super(opts.color ?? "red", opts.fill ?? false, opts.fillColor ?? "rgba(255,0,0,0.3)");
    this.data = data;
    this.baselineY = opts.baselineY ?? 0;
  }
  draw(app, graph) {
    if (!graph || !this.data?.length) return;
    let pPrev = graph.vp.worldToCanvas(this.data[0].x, this.data[0].y);
    const col = this.parseColorSafe(this.color);
    for (let i = 1; i < this.data.length; i++) {
      const pNext = graph.vp.worldToCanvas(this.data[i].x, this.data[i].y);
      drawLine(app, pPrev, pNext, col);
      pPrev = pNext;
    }
    if (!this.fill) return;
    const pts = this.data.map((p) => graph.vp.worldToCanvas(p.x, p.y));
    const last = this.data[this.data.length - 1];
    const first = this.data[0];
    pts.push(graph.vp.worldToCanvas(last.x, this.baselineY));
    pts.push(graph.vp.worldToCanvas(first.x, this.baselineY));
    fillPolygon(app, pts, this.parseColorSafe(this.fillColor));
  }
};
var DrawableCircle = class extends Drawable {
  constructor(center = new V2(0, 0), radius = 1, opts = {}) {
    super(opts.color ?? "white", opts.fill ?? false, opts.fillColor ?? null, opts.transform ?? Transform2D.identity());
    this.center = center;
    this.radius = radius;
  }
  draw(app, graph) {
    const cWorld = this.transform.transformV2(this.center);
    const c = graph.vp.worldToCanvas(cWorld.x, cWorld.y);
    const sc = graph.vp.scale;
    const r = this.radius * (graph.vp.preserveAspect ? sc.x : (sc.x + sc.y) * 0.5);
    if (this.fill) fillCircle(app, c, r, this.parseColorSafe(this.fillColor));
    drawCircleOutline(app, c, r, this.parseColorSafe(this.color));
  }
};
var DrawableLine = class extends Drawable {
  constructor(p1, p2, opts = {}) {
    super(opts.color ?? "yellow", false, null, opts.transform ?? Transform2D.identity());
    this.p1 = p1;
    this.p2 = p2;
    this.width = Math.max(1, (opts.width ?? 2) | 0);
  }
  draw(app, graph) {
    const a = this.transform.transformV2(this.p1);
    const b = this.transform.transformV2(this.p2);
    const p0 = graph.vp.worldToCanvas(a.x, a.y);
    const p1 = graph.vp.worldToCanvas(b.x, b.y);
    strokeShape(app, [p0, p1], this.parseColorSafe(this.color), this.width);
  }
};
var DrawablePoint = class extends Drawable {
  constructor(pos, opts = {}) {
    super(opts.color ?? "white", false, null, opts.transform ?? Transform2D.identity());
    this.pos = pos;
    this.type = opts.type ?? "circle";
    this.size = opts.size ?? 3;
  }
  draw(app, graph) {
    const pWorld = this.transform.transformV2(this.pos);
    const c = graph.vp.worldToCanvas(pWorld.x, pWorld.y);
    rawPoint(app, c, this.parseColorSafe(this.color), { type: this.type, size: this.size });
  }
};
var DrawableTriangle = class extends Drawable {
  constructor(p1, p2, p3, opts = {}) {
    super(opts.color ?? "yellow", opts.fill ?? true, opts.fillColor ?? "rgba(255,255,0,0.5)", opts.transform ?? Transform2D.identity());
    this.points = [p1, p2, p3];
  }
  draw(app, graph) {
    const tp = this.points.map((p) => this.transform.transformV2(p));
    const pts = tp.map((p) => graph.vp.worldToCanvas(p.x, p.y));
    if (this.fill) fillPolygon(app, pts, this.parseColorSafe(this.fillColor));
    for (let i = 0; i < 3; i++) {
      drawLine(app, pts[i], pts[(i + 1) % 3], this.parseColorSafe(this.color));
    }
  }
};
var DrawableText = class extends Drawable {
  constructor(text, pos, opts = {}) {
    super(opts.color ?? "white", false, null, opts.transform ?? Transform2D.identity());
    this.text = text;
    this.pos = pos;
    this.font = opts.font ?? "14px sans-serif";
    this.align = opts.align ?? "left";
    this.baseline = opts.baseline ?? "alphabetic";
  }
  draw(app, graph) {
    const pWorld = this.transform.transformV2(this.pos);
    const p = graph.vp.worldToCanvas(pWorld.x, pWorld.y);
    app.drawText(this.text, p, this.color, this.font, this.align, this.baseline);
  }
};
var DrawableLabel = class extends Drawable {
  constructor(text, pos, opts = {}) {
    super(opts.color ?? "white", false, null, opts.transform ?? Transform2D.identity());
    this.text = text;
    this.pos = pos;
    this.mode = opts.mode ?? "world";
    this.font = opts.font ?? "14px sans-serif";
    this.align = opts.align ?? "left";
    this.baseline = opts.baseline ?? "alphabetic";
  }
  draw(app, graph) {
    const p = this.mode === "canvas" ? this.pos : graph.vp.worldToCanvas(this.transform.transformV2(this.pos).x, this.transform.transformV2(this.pos).y);
    app.drawText(this.text, p, this.color, this.font, this.align, this.baseline);
  }
};

// src/viewport.ts
var ViewportManager = class {
  /**
   * @param app CanvasRenderer-like object exposing `size: V2`
   * @param worldBounds initial world bounds
   * @param viewport static `Rect` or a function (app) => Rect for responsive layouts
   * @param preserveAspect false | true | "fit" | "cover" (true behaves like "fit")
   */
  constructor(app, worldBounds, _viewport = { x: 0, y: 0, width: app.size.x, height: app.size.y }, preserveAspect = false) {
    this.app = app;
    this.worldBounds = worldBounds;
    this._viewport = _viewport;
    this.preserveAspect = preserveAspect;
  }
  get viewport() {
    return typeof this._viewport === "function" ? this._viewport(this.app) : this._viewport;
  }
  get scale() {
    const { xMin, xMax, yMin, yMax } = this.worldBounds;
    const xRange = xMax - xMin, yRange = yMax - yMin;
    const vp = this.viewport;
    if (!this.preserveAspect || this.preserveAspect === "none") {
      return new V2(vp.width / xRange, vp.height / yRange);
    }
    const viewRatio = vp.width / vp.height;
    const dataRatio = xRange / yRange;
    const s = viewRatio > dataRatio ? vp.height / yRange : vp.width / xRange;
    return new V2(s, s);
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
      return new V2(offsetX + (x - xMin) * s, offsetY + (yRange - (y - yMin)) * s);
    } else {
      const sc = this.scale;
      return new V2(vp.x + (x - xMin) * sc.x, vp.y + (yMax - y) * sc.y);
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
      return new V2(xMin + (px - offsetX) / s, yMax - (py - offsetY) / s);
    } else {
      const sc = this.scale;
      return new V2(xMin + (px - vp.x) / sc.x, yMax - (py - vp.y) / sc.y);
    }
  }
  /** Convert world units to canvas pixels in X (assumes uniform when preserveAspect). */
  unitsToPixels(units) {
    return units * this.scale.x;
  }
};
function getDivViewport(div, targetAspect = 1, margin = 30) {
  const rect = div.getBoundingClientRect();
  let width = rect.width, height = rect.height;
  const currentAspect = width / height;
  if (currentAspect > targetAspect) width = height * targetAspect;
  else height = width / targetAspect;
  return { x: margin, y: margin, width: width - margin * 2, height: height - margin * 2, margin };
}

// src/pixelbuffer.ts
var PixelBuffer = class {
  // ABGR packed view
  constructor(width, height) {
    this.width = 0;
    this.height = 0;
    this.imageData = new ImageData(Math.max(1, width | 0), Math.max(1, height | 0));
    this.pixels = this.imageData.data;
    this.px32 = new Uint32Array(this.pixels.buffer);
    this.width = this.imageData.width;
    this.height = this.imageData.height;
  }
  resize(width, height) {
    this.imageData = new ImageData(Math.max(1, width | 0), Math.max(1, height | 0));
    this.pixels = this.imageData.data;
    this.px32 = new Uint32Array(this.pixels.buffer);
    this.width = this.imageData.width;
    this.height = this.imageData.height;
  }
  clear(color = "#131313") {
    const c = parseColor(color) || NAMED.black;
    const packed = packABGR(c[0], c[1], c[2], c[3]);
    this.px32.fill(packed);
  }
  index(x, y) {
    return (y * this.width + x | 0) * 4;
  }
  putPixel(x, y, color) {
    if (x >>> 0 >= this.width >>> 0 || y >>> 0 >= this.height >>> 0) return;
    const i = this.index(x | 0, y | 0);
    const c = color;
    this.pixels[i] = c[0];
    this.pixels[i + 1] = c[1];
    this.pixels[i + 2] = c[2];
    this.pixels[i + 3] = c[3];
  }
  putPixelBlend(x, y, color) {
    if (x >>> 0 >= this.width >>> 0 || y >>> 0 >= this.height >>> 0) return;
    const i = this.index(x | 0, y | 0);
    const dr = this.pixels[i], dg = this.pixels[i + 1], db = this.pixels[i + 2], da = this.pixels[i + 3];
    const [r, g, b, a] = blendRGBA(dr, dg, db, da, color[0], color[1], color[2], color[3]);
    this.pixels[i] = r + 0.5 | 0;
    this.pixels[i + 1] = g + 0.5 | 0;
    this.pixels[i + 2] = b + 0.5 | 0;
    this.pixels[i + 3] = a + 0.5 | 0;
  }
  /** Alpha-blit ImageData into this buffer at (dx,dy). */
  blit(srcImageData, dx, dy) {
    const sw = srcImageData.width | 0, sh = srcImageData.height | 0;
    const src = srcImageData.data;
    const w = this.width, h = this.height;
    dx |= 0;
    dy |= 0;
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
        this.pixels[dIdx] = sr * alpha + dr * invAlpha + 0.5 | 0;
        this.pixels[dIdx + 1] = sg * alpha + dg * invAlpha + 0.5 | 0;
        this.pixels[dIdx + 2] = sb * alpha + db * invAlpha + 0.5 | 0;
        this.pixels[dIdx + 3] = sa * alpha + da * invAlpha + 0.5 | 0;
      }
    }
  }
};

// src/textCache.ts
var TextCache = class {
  constructor(capacity = 256) {
    this.capacity = capacity;
    this.map = /* @__PURE__ */ new Map();
    this.capacity |= 0;
  }
  get(key) {
    const v = this.map.get(key);
    if (v) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v ?? null;
  }
  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.capacity) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== void 0) {
        this.map.delete(firstKey);
      }
    }
  }
  clear() {
    this.map.clear();
  }
};

// src/renderer.ts
var CanvasRenderer = class {
  constructor(canvas = document.querySelector("canvas")) {
    this.canvas = canvas;
    this.resizeCallbacks = [];
    this.renderables = [];
    this.ctx = canvas.getContext("2d");
    this.size = new V2(canvas.width, canvas.height);
    this.buffer = new PixelBuffer(this.size.x, this.size.y);
    this.textCanvas = document.createElement("canvas");
    this.textCtx = this.textCanvas.getContext("2d");
    this.textCache = new TextCache(512);
    window.addEventListener("resize", () => this.onResize());
  }
  resizeCanvas() {
    this.canvas.width = this.size.x;
    this.canvas.height = this.size.y;
  }
  onResize() {
    this.size = new V2(window.innerWidth | 0, window.innerHeight | 0);
    this.resizeCanvas();
    this.buffer.resize(this.size.x, this.size.y);
    this.renderAll();
    this.resizeCallbacks.forEach((cb) => cb());
  }
  onResizeCallback(cb) {
    this.resizeCallbacks.push(cb);
  }
  addRenderable(obj) {
    this.renderables.push(obj);
  }
  clear(color = "#131313") {
    this.buffer.clear(color);
  }
  putPixel(p, color) {
    this.buffer.putPixel(p.x | 0, p.y | 0, color);
  }
  putPixelBlend(p, color) {
    this.buffer.putPixelBlend(p.x | 0, p.y | 0, color);
  }
  blitImageData(img, dx, dy) {
    this.buffer.blit(img, dx, dy);
  }
  render() {
    this.ctx.putImageData(this.buffer.imageData, 0, 0);
  }
  renderAll() {
    this.clear();
    this.renderables.forEach((obj) => obj.draw(this));
    this.render();
  }
  /** Draw text via cached raster. Options support align/baseline like Canvas2D. */
  drawText(text, pos, color = "#fff", font = "12px sans-serif", align = "left", baseline = "alphabetic") {
    const key = `${text}|${font}|${color}`;
    let entry = this.textCache.get(key);
    if (!entry) {
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
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillText(text, 2, 2);
      entry = ctx.getImageData(0, 0, w, h);
      this.textCache.set(key, entry);
    }
    const { width: tw, height: th } = entry;
    let ox = 0, oy = 0;
    switch (align) {
      case "center":
        ox = -tw / 2;
        break;
      case "right":
      case "end":
        ox = -tw;
        break;
    }
    switch (baseline) {
      case "middle":
        oy = -th / 2;
        break;
      case "bottom":
      case "ideographic":
      case "alphabetic":
        oy = -th;
        break;
    }
    this.blitImageData(entry, pos.x + ox + 0.5 | 0, pos.y + oy + 0.5 | 0);
  }
};
var DynamicCanvasRenderer = class {
  constructor(containerDiv, options = {}) {
    this.containerDiv = containerDiv;
    const canvas = document.createElement("canvas");
    containerDiv.appendChild(canvas);
    Object.assign(canvas.style, { width: "100%", height: "100%", display: "block", background: options.background || "black" });
    this.app = new CanvasRenderer(canvas);
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }
  resize() {
    const rect = this.containerDiv.getBoundingClientRect();
    const w = Math.max(1, rect.width | 0), h = Math.max(1, rect.height | 0);
    const canvas = this.app.canvas;
    canvas.width = w;
    canvas.height = h;
    this.app.size = new V2(w, h);
    this.app.buffer.resize(w, h);
  }
  clear() {
    this.app.clear();
  }
  render() {
    this.app.render();
  }
};

// src/tools.ts
function rotatePoint(p, center, angle) {
  return p.rotate(angle, center);
}
function rotateTriangleAroundCenter(tri, center, angle) {
  tri.points = tri.points.map((p) => rotatePoint(p, center, angle));
}
function rotateTriangleVertical(tri, center, angle) {
  const m = Transform2D.around(center, Transform2D.scale(Math.cos(angle), 1));
  tri.points = tri.points.map((p) => m.transformV2(p));
}
function projectYRotation(point, center, angle) {
  const m = Transform2D.around(center, Transform2D.scale(Math.cos(angle), 1));
  return m.transformV2(point);
}
var Intercepts = class _Intercepts {
  static findX(series) {
    const out = [];
    for (let i = 1; i < series.length; i++) {
      const y1 = series[i - 1].y, y2 = series[i].y;
      if (y1 === 0) out.push(series[i - 1].x);
      else if (y1 * y2 < 0) {
        const x1 = series[i - 1].x, x2 = series[i].x;
        out.push(x1 + -y1 / (y2 - y1) * (x2 - x1));
      }
    }
    return out;
  }
  static drawX(app, graph, series, color = "yellow") {
    const col = parseColor(color) || NAMED.yellow;
    const xs = _Intercepts.findX(series);
    for (const x of xs) {
      const p = graph.vp.worldToCanvas(x, 0);
      fillCircle(app, new V2(p.x + 0.5 | 0, p.y + 0.5 | 0), 5, col);
    }
  }
};
export {
  CanvasRenderer,
  Drawable,
  DrawableCircle,
  DrawableFunction,
  DrawableLabel,
  DrawableLine,
  DrawablePoint,
  DrawableText,
  DrawableTriangle,
  DynamicCanvasRenderer,
  Graph,
  Intercepts,
  NAMED,
  PixelBuffer,
  TextCache,
  Transform2D,
  V2,
  ViewportManager,
  blendRGBA,
  clamp01,
  clamp255,
  computeTicks,
  drawCircleOutline,
  drawLine,
  fillCircle,
  fillPolygon,
  getDivViewport,
  packABGR,
  parseColor,
  projectYRotation,
  rawLine,
  rawPoint,
  rotatePoint,
  rotateTriangleAroundCenter,
  rotateTriangleVertical,
  strokeShape,
  toColor,
  unpackABGR
};
