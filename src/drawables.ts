// ─────────────────────────────────────────────────────────────────────────────
// File: src/drawables.ts
// ─────────────────────────────────────────────────────────────────────────────

import { V2 } from "./v2";
import { Transform2D } from "./transform2d";
import {
  drawLine,
  fillCircle,
  drawCircleOutline,
  fillPolygon,
  strokeShape,
  rawPoint,
} from "./raster";
import { parseColor } from "./color";

export abstract class Drawable {
  constructor(
    public color: string | readonly [number, number, number, number] = "white",
    public fill: boolean = false,
    public fillColor: string | readonly [number, number, number, number] | null = null,
    public transform: Transform2D = Transform2D.identity()
  ) {
    if (!this.fillColor) this.fillColor = color;
  }

  abstract draw(app: any, graph: any): void;

  protected parseColorSafe(input: string | readonly [number, number, number, number]): [number, number, number, number] {
    return [...(parseColor(input) ?? [255, 255, 255, 255])] as [number, number, number, number];
  }

}

export class DrawableFunction extends Drawable {
  public baselineY: number;

  constructor(
    public data: V2[],
    opts: { color?: string; fill?: boolean; fillColor?: string; baselineY?: number } = {}
  ) {
    super(opts.color ?? "red", opts.fill ?? false, opts.fillColor ?? "rgba(255,0,0,0.3)");
    this.baselineY = opts.baselineY ?? 0;
  }

  draw(app: any, graph: { vp: { worldToCanvas: (x: number, y: number) => V2 } }): void {
    if (!graph || !this.data?.length) return;

    let pPrev = graph.vp.worldToCanvas(this.data[0].x, this.data[0].y);
    const col = this.parseColorSafe(this.color!);

    for (let i = 1; i < this.data.length; i++) {
      const pNext = graph.vp.worldToCanvas(this.data[i].x, this.data[i].y);
      drawLine(app, pPrev, pNext, col);
      pPrev = pNext;
    }

    if (!this.fill) return;

    const pts = this.data.map(p => graph.vp.worldToCanvas(p.x, p.y));
    const last = this.data[this.data.length - 1];
    const first = this.data[0];
    pts.push(graph.vp.worldToCanvas(last.x, this.baselineY));
    pts.push(graph.vp.worldToCanvas(first.x, this.baselineY));
    fillPolygon(app, pts, this.parseColorSafe(this.fillColor!));
  }
}

export class DrawableCircle extends Drawable {
  constructor(
    public center: V2 = new V2(0, 0),
    public radius: number = 1,
    opts: { color?: string; fill?: boolean; fillColor?: string; transform?: Transform2D } = {}
  ) {
    super(opts.color ?? "white", opts.fill ?? false, opts.fillColor ?? null, opts.transform ?? Transform2D.identity());
  }

  draw(app: any, graph: { vp: { worldToCanvas: (x: number, y: number) => V2; scale: V2; preserveAspect: any } }): void {
    const cWorld = this.transform.transformV2(this.center);
    const c = graph.vp.worldToCanvas(cWorld.x, cWorld.y);
    const sc = graph.vp.scale;
    const r = this.radius * (graph.vp.preserveAspect ? sc.x : (sc.x + sc.y) * 0.5);

    if (this.fill) fillCircle(app, c, r, this.parseColorSafe(this.fillColor!));
    drawCircleOutline(app, c, r, this.parseColorSafe(this.color!));
  }
}

export class DrawableLine extends Drawable {
  public width: number;

  constructor(
    public p1: V2,
    public p2: V2,
    opts: { color?: string; width?: number; transform?: Transform2D } = {}
  ) {
    super(opts.color ?? "yellow", false, null, opts.transform ?? Transform2D.identity());
    this.width = Math.max(1, (opts.width ?? 2) | 0);
  }

  draw(app: any, graph: { vp: { worldToCanvas: (x: number, y: number) => V2 } }): void {
    const a = this.transform.transformV2(this.p1);
    const b = this.transform.transformV2(this.p2);
    const p0 = graph.vp.worldToCanvas(a.x, a.y);
    const p1 = graph.vp.worldToCanvas(b.x, b.y);
    strokeShape(app, [p0, p1], this.parseColorSafe(this.color!), this.width);
  }
}

export class DrawablePoint extends Drawable {
  public type: "circle" | "cross" | "square";
  public size: number;

  constructor(
    public pos: V2,
    opts: { color?: string; type?: "circle" | "cross" | "square"; size?: number; transform?: Transform2D } = {}
  ) {
    super(opts.color ?? "white", false, null, opts.transform ?? Transform2D.identity());
    this.type = opts.type ?? "circle";
    this.size = opts.size ?? 3;
  }

  draw(app: any, graph: { vp: { worldToCanvas: (x: number, y: number) => V2 } }): void {
    const pWorld = this.transform.transformV2(this.pos);
    const c = graph.vp.worldToCanvas(pWorld.x, pWorld.y);
    rawPoint(app, c, this.parseColorSafe(this.color!), { type: this.type, size: this.size });
  }
}

export class DrawableTriangle extends Drawable {
  public points: [V2, V2, V2];

  constructor(
    p1: V2,
    p2: V2,
    p3: V2,
    opts: { color?: string; fill?: boolean; fillColor?: string; transform?: Transform2D } = {}
  ) {
    super(opts.color ?? "yellow", opts.fill ?? true, opts.fillColor ?? "rgba(255,255,0,0.5)", opts.transform ?? Transform2D.identity());
    this.points = [p1, p2, p3];
  }

  draw(app: any, graph: { vp: { worldToCanvas: (x: number, y: number) => V2 } }): void {
    const tp = this.points.map(p => this.transform.transformV2(p));
    const pts = tp.map(p => graph.vp.worldToCanvas(p.x, p.y));

    if (this.fill) fillPolygon(app, pts, this.parseColorSafe(this.fillColor!));
    for (let i = 0; i < 3; i++) {
      drawLine(app, pts[i], pts[(i + 1) % 3], this.parseColorSafe(this.color!));
    }
  }
}

export class DrawableText extends Drawable {
  public font: string;
  public align: CanvasTextAlign;
  public baseline: CanvasTextBaseline;

  constructor(
    public text: string,
    public pos: V2,
    opts: { color?: string; font?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; transform?: Transform2D } = {}
  ) {
    super(opts.color ?? "white", false, null, opts.transform ?? Transform2D.identity());
    this.font = opts.font ?? "14px sans-serif";
    this.align = opts.align ?? "left";
    this.baseline = opts.baseline ?? "alphabetic";
  }

  draw(app: any, graph: { vp: { worldToCanvas: (x: number, y: number) => V2 } }): void {
    const pWorld = this.transform.transformV2(this.pos);
    const p = graph.vp.worldToCanvas(pWorld.x, pWorld.y);
    (app as any).drawText(this.text, p, this.color as string, this.font, this.align, this.baseline);
  }
}

export class DrawableLabel extends Drawable {
  public mode: "world" | "canvas";
  public font: string;
  public align: CanvasTextAlign;
  public baseline: CanvasTextBaseline;

  constructor(
    public text: string,
    public pos: V2,
    opts: { mode?: "world" | "canvas"; color?: string; font?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; transform?: Transform2D } = {}
  ) {
    super(opts.color ?? "white", false, null, opts.transform ?? Transform2D.identity());
    this.mode = opts.mode ?? "world";
    this.font = opts.font ?? "14px sans-serif";
    this.align = opts.align ?? "left";
    this.baseline = opts.baseline ?? "alphabetic";
  }

  draw(app: any, graph: { vp: { worldToCanvas: (x: number, y: number) => V2 } }): void {
    const p =
      this.mode === "canvas"
        ? this.pos
        : graph.vp.worldToCanvas(this.transform.transformV2(this.pos).x, this.transform.transformV2(this.pos).y);
    (app as any).drawText(this.text, p, this.color as string, this.font, this.align, this.baseline);
  }
}
