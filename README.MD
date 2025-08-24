# Demo 

[https://maloglolo.github.io/canvasPlayground/](https://maloglolo.github.io/canvasPlayground/)

# Installation

```bash
git clone https://github.com/maloglolo/canvasPlayground
cd canvasPlayground
```

# Usage

**Create a Drawable object**  
All drawable objects extend base classes like `DrawableFunction`, `DrawableCircle`, `DrawableTriangle`, `DrawableLine`, or `DrawableText`.

```js
const myTriangle = new DrawableTriangle(
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0.5, y: 1 },
  { color: "lime", fill: true, fillColor: "rgba(0,255,0,0.3)" }
);
```

**Set up a Graph and ViewportManager**  
These handle world-to-canvas scaling and (optionally) grid/axes drawing.

```js
const vp = new ViewportManager(myApp.app,
                             { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
                             () => [0, 0, 400, 400], true);
const graph = new Graph(vp, { numTicksX: 2, numTicksY: 2, color: "#aaa" });
```

**Assign a graph to your drawable (optional)**  
Set `myTriangle.graph = graph`, or pass the graph as an argument to `.draw()`.

```js
myTriangle.graph = graph; // optional
```

**Draw in your render loop**  
Draw grid/axes as a separate layer

```js
myApp.clear(); // Clear previous frame
graph.draw(myApp.app); // Draw grid/axes (optional)
myTriangle.draw(myApp.app, graph); // Draw object
myApp.render(); // Commit to canvas
```

**Animate your object (optional)**  
Update positions, rotation, or other properties on each frame:

```js
myTriangle.points = myTriangle.points.map(p => ({ x: p.x, y: p.y + 0.01 }));
```

---

**Notes:**
- The grid/axes (`graph.draw(app)`) is always optional and is its own layer.
- Pass the `graph` to `.draw()` or set it as a property on the drawable.
- This pattern works for all drawable objects provided by `canvasLib.js`.

**Ressources:**
+ [https://en.wikipedia.org/wiki/Alpha_compositing](https://en.wikipedia.org/wiki/Alpha_compositing)
+ [https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm](https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm)
+ [https://developer.mozilla.org/en-US/docs/Web/API/ImageData](https://developer.mozilla.org/en-US/docs/Web/API/ImageData)
+ [https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#imagedata](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#imagedata)
+ [https://2ality.com/2015/09/typed-arrays.html](https://2ality.com/2015/09/typed-arrays.html)
+   [https://www.enjoyalgorithms.com/blog/implement-least-recently-used-cache](https://www.enjoyalgorithms.com/blog/implement-least-recently-used-cache)
+   [https://www.enjoyalgorithms.com/blog/implement-least-recently-used-cache](https://www.enjoyalgorithms.com/blog/implement-least-recently-used-cache)
+   [https://graphics.stanford.edu/courses/cs248-08/scan/scan1.html](https://graphics.stanford.edu/courses/cs248-08/scan/scan1.html)



# TODO
+ add some ui
+ use real math > [https://dododas.github.io/linear-algebra-with-python/posts/16-12-29-2d-transformations.html](https://dododas.github.io/linear-algebra-with-python/posts/16-12-29-2d-transformations.html)