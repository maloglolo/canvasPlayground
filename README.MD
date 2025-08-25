
# Demo
[https://maloglolo.github.io/canvasPlayground/](https://maloglolo.github.io/canvasPlayground/)

# Installation
```bash
git clone https://github.com/maloglolo/canvasPlayground
cd canvasPlayground
```

# Usage

**Create Drawable objects**  
All extend `DrawableFunction`, `DrawableCircle`, `DrawableTriangle`, `DrawableLine`, `DrawableText`.

```ts
const myTriangle = new DrawableTriangle(
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0.5, y: 1 },
  { color: "lime", fill: true, fillColor: "rgba(0,255,0,0.3)" }
);
```

**Graph + ViewportManager**  
Handles world-to-canvas mapping and optional grid/axes.

```ts
const vp = new ViewportManager(app.app, { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }, () => [0,0,400,400], true);
const graph = new Graph(vp, { numTicksX: 2, numTicksY: 2, color: "#aaa" });
```

**Draw**  
Pass the graph or assign it to the drawable.

```ts
app.clear();
graph.draw(app.app);          // optional grid/axes
myTriangle.draw(app.app, graph);
app.render();
```

**Animate**  
Update drawable properties each frame:

```ts
myTriangle.points = myTriangle.points.map(p => ({ x: p.x, y: p.y + 0.01 }));
```

# Notes
- `graph.draw(app)` is optional; grid/axes are separate.
- Pass `graph` to `.draw()` or set as `myDrawable.graph`.
- Works for all drawables in `canvasLib.js`.

# Resources
- [Alpha compositing](https://en.wikipedia.org/wiki/Alpha_compositing)
- [Bresenham's line algorithm](https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm)
- [ImageData API](https://developer.mozilla.org/en-US/docs/Web/API/ImageData)
- [Typed arrays](https://2ality.com/2015/09/typed-arrays.html)
- [LRU Cache](https://www.enjoyalgorithms.com/blog/implement-least-recently-used-cache)
- [2D transforms](https://dododas.github.io/linear-algebra-with-python/posts/16-12-29-2d-transformations.html)

# TODO
- Add UI
- Fix scaling
```
