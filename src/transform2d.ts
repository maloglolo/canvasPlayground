// ─────────────────────────────────────────────────────────────────────────────
// File: src/transform2d.ts
// 2×3 affine transform compatible with Canvas2D (a b c d e f)
// ─────────────────────────────────────────────────────────────────────────────

import { V2 } from "./v2";

/**
 * 2x3 affine: [ a c e ]
 *             [ b d f ]
 * maps (x,y) -> (a*x + c*y + e, b*x + d*y + f)
 */
export class Transform2D {
  constructor(
    public a: number = 1, public b: number = 0,
    public c: number = 0, public d: number = 1,
    public e: number = 0, public f: number = 0
  ) {}

  static identity(): Transform2D { return new Transform2D(); }
  static translation(tx: number, ty: number): Transform2D { return new Transform2D(1, 0, 0, 1, tx, ty); }
  static scale(sx: number, sy: number = sx): Transform2D { return new Transform2D(sx, 0, 0, sy, 0, 0); }
  static rotation(angle: number): Transform2D {
    const c = Math.cos(angle), s = Math.sin(angle);
    return new Transform2D(c, s, -s, c, 0, 0);
  }
  static fromCanvasTransform(a: number, b: number, c: number, d: number, e: number, f: number): Transform2D {
    return new Transform2D(a, b, c, d, e, f);
  }

  /** this ∘ m (apply m first, then this) */
  multiply(m: Transform2D): Transform2D {
    return new Transform2D(
      this.a * m.a + this.c * m.b,
      this.b * m.a + this.d * m.b,
      this.a * m.c + this.c * m.d,
      this.b * m.c + this.d * m.d,
      this.a * m.e + this.c * m.f + this.e,
      this.b * m.e + this.d * m.f + this.f
    );
  }

  transformV2(v: V2): V2 {
    return new V2(
      this.a * v.x + this.c * v.y + this.e,
      this.b * v.x + this.d * v.y + this.f
    );
  }

  /** Build a transform applied around a pivot: T(p) * mat * T(-p) */
  static around(pivot: V2, mat: Transform2D): Transform2D {
    return Transform2D.translation(pivot.x, pivot.y).multiply(mat).multiply(Transform2D.translation(-pivot.x, -pivot.y));
  }
}

