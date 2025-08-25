// ─────────────────────────────────────────────────────────────────────────────
// File: src/v2.ts
// Immutable-API style 2D vector with common ops
// ─────────────────────────────────────────────────────────────────────────────

export class V2 {
  constructor(public readonly x: number = 0, public readonly y: number = 0) {}

  clone(): V2 { return new V2(this.x, this.y); }

  add(v: V2): V2 { return new V2(this.x + v.x, this.y + v.y); }
  sub(v: V2): V2 { return new V2(this.x - v.x, this.y - v.y); }
  scale(sx: number, sy: number = sx): V2 { return new V2(this.x * sx, this.y * sy); }
  dot(v: V2): number { return this.x * v.x + this.y * v.y; }
  perp(): V2 { return new V2(-this.y, this.x); }
  len(): number { return Math.hypot(this.x, this.y); }
  norm(): V2 { const l = this.len() || 1; return new V2(this.x / l, this.y / l); }

  /** Rotate around optional pivot. Angle in radians, positive = CCW */
  rotate(angle: number, around: V2 | null = null): V2 {
    const c = Math.cos(angle), s = Math.sin(angle);
    let x = this.x, y = this.y;
    if (around) { x -= around.x; y -= around.y; }
    const xr = x * c - y * s;
    const yr = x * s + y * c;
    return around ? new V2(xr + around.x, yr + around.y) : new V2(xr, yr);
  }

  toArray(): [number, number] { return [this.x, this.y]; }
  static fromArray(a: readonly [number, number]): V2 { return new V2(a[0], a[1]); }
  static lerp(a: V2, b: V2, t: number): V2 { return new V2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); }
}
