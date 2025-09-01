import {
  Graph,
  DrawableFunction,
  DrawableCircle,
  DrawableTriangle,
  DrawableLine,
  DrawableText,
  DrawablePoint,
  ViewportManager,
  getDivViewport,
  DynamicCanvasRenderer,
  projectYRotation,
  V2,
  Scene,
  DrawableLegend,
  DebugUI,
  SceneManager,
  autoScaleViewport,
} from './dist/canvasLib.js';

// -------------------- CANVAS APPS --------------------
const apps = {
  signal: new DynamicCanvasRenderer(document.getElementById("signalWrapper")),
  unit: new DynamicCanvasRenderer(document.getElementById("unitWrapper")),
  triforce: new DynamicCanvasRenderer(document.getElementById("triforceWrapper")),
  scatter: new DynamicCanvasRenderer(document.getElementById("scatterWrapper")),
  gol: new DynamicCanvasRenderer(document.getElementById("golWrapper")),
};

// -------------------- VIEWPORTS --------------------
const viewports = {};
for (let key of Object.keys(apps)) {
  const div = document.getElementById(`${key}Wrapper`);
  viewports[key] = new ViewportManager(apps[key], null, () => getDivViewport(div), "fit");
}

viewports.signal.preserveAspect = "none";

// -------------------- DATA --------------------
const baseTimeSeries = Array.from({ length: 500 }, (_, i) => {
  const t = i * 0.01;
  return { x: i, y: Math.sin(2 * Math.PI * 0.06 * t) * Math.exp(-t * 0.01) + 0.2 * Math.sin(2 * Math.PI * 0.18 * t) * Math.exp(-t * 0.015) };
});

const numVariations = 100;
const cachedSignals = Array.from({ length: numVariations }, (_, v) =>
  baseTimeSeries.map((pt, i) => {
    const t = i * 0.01;
    return { x: pt.x, y: pt.y + 0.05 * Math.sin(2 * Math.PI * 0.06 * t + v * 0.1) + 0.05 * (Math.random() - 0.5) };
  })
);

const GOL_ROWS = 50, GOL_COLS = 50;
let golGrid = Array.from({ length: GOL_ROWS }, () =>
  Array.from({ length: GOL_COLS }, () => Math.random() < 0.2 ? 1 : 0)
);

// -------------------- DRAWABLES --------------------
const signalWave = new DrawableFunction(cachedSignals[0].map(pt => new V2(pt.x, pt.y)), { color: "lime" });
signalWave.legend = { label: "Signal", color: "lime", symbol: "line" };

const circle = new DrawableCircle(new V2(0, 0), 1, { color: "cyan" });
circle.legend = { label: "Unit Circle", color: "cyan", symbol: "line" };

let ptA = new V2(0, 0), ptB = new V2(Math.cos(Math.PI / 6), 0), ptC = new V2(Math.cos(Math.PI / 6), Math.sin(Math.PI / 6));
const triangle = new DrawableTriangle(ptA, ptB, ptC, { color: "yellow", fill: true, fillColor: "rgba(255,255,0,0.3)" });
triangle.legend = { label: "Triangle", color: "yellow", symbol: "area" };

const lineSine = new DrawableLine(ptC, new V2(ptC.x, 0), { color: "cyan", width: 2 });
const lineTangent = new DrawableLine(ptB, ptC, { color: "magenta", width: 2 });

const labelA = new DrawableText("A", ptA, { color: "white" });
const labelB = new DrawableText("B", ptB, { color: "white" });
const labelC = new DrawableText("C", ptC, { color: "white" });

const triforceSize = 0.5;
const makeTriangle = (x, y) => [new V2(x - triforceSize / 2, y), new V2(x + triforceSize / 2, y), new V2(x, y + triforceSize)];
const triforceTriangles = [
  { original: makeTriangle(0.5, 1), drawable: null },
  { original: makeTriangle(0.25, 0.5), drawable: null },
  { original: makeTriangle(0.75, 0.5), drawable: null }
];
triforceTriangles.forEach(t => t.drawable = new DrawableTriangle(...t.original, { color: "yellow", fill: true, fillColor: "rgba(255,255,0,0.5)" }));

const NUM_POINTS = 50;
const scatterPoints = Array.from({ length: NUM_POINTS }, () =>
  new DrawablePoint(new V2((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3), {
    color: Math.random() < 0.5 ? "magenta" : "cyan",
    size: 3,
    type: Math.random() < 0.5 ? "cross" : "circle"
  })
);

class DrawableGOL {
  constructor(grid) { this.grid = grid; }
  draw(app, vp) {
    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[y].length; x++) {
        if (this.grid[y][x]) {
          const canvasPos = vp.worldToCanvas(x + 0.5, y + 0.5);
          app.putPixelBlend(canvasPos, [0, 255, 0, 255]);
        }
      }
    }
  }
}
const golDrawable = new DrawableGOL(golGrid);

// -------------------- SCENES --------------------
function addToScene(scene, layerName, ...items) { scene.add(items, layerName); }
const scenes = {}, debugs = {};
for (let key of Object.keys(apps)) {
  scenes[key] = new Scene();
  debugs[key] = new DebugUI(new V2(10, 10));
}

// -------------------- SCENE SETUP --------------------

const signalGraph = new Graph(viewports.signal, { numTicksX: 10, numTicksY: 5 });
addToScene(scenes.signal, "data", signalGraph, signalWave);
addToScene(scenes.signal, "ui", new DrawableLegend(scenes.signal.collectLegend(), { anchor: "ne" }));
addToScene(scenes.signal, "debug", debugs.signal);


const signalBounds = {
  xMin: Math.min(...baseTimeSeries.map(p => p.x)),
  xMax: Math.max(...baseTimeSeries.map(p => p.x)),
  yMin: Math.min(...cachedSignals.flat().map(p => p.y)),
  yMax: Math.max(...cachedSignals.flat().map(p => p.y))
};
viewports.signal.updateWorld(signalBounds);


const unitGraph = new Graph(viewports.unit, { numTicksX: 4, numTicksY: 4 });
addToScene(scenes.unit, "data", unitGraph, circle, lineSine, lineTangent, triangle, labelA, labelB, labelC);
addToScene(scenes.unit, "ui", new DrawableLegend(scenes.unit.collectLegend(), { anchor: "ne" }));
addToScene(scenes.unit, "debug", debugs.unit);

viewports.unit.updateWorld({ xMin: -1, xMax: 1, yMin: -1, yMax: 1 });

triforceTriangles.forEach(t => addToScene(scenes.triforce, "data", t.drawable));
addToScene(scenes.triforce, "debug", debugs.triforce);
autoScaleViewport(viewports.triforce, triforceTriangles.map(t => t.drawable));

const scatterGraph = new Graph(viewports.scatter, { numTicksX: 5, numTicksY: 5 });
addToScene(scenes.scatter, "data", scatterGraph, ...scatterPoints);
addToScene(scenes.scatter, "debug", debugs.scatter);
autoScaleViewport(viewports.scatter, scatterPoints);

addToScene(scenes.gol, "data", golDrawable);
addToScene(scenes.gol, "debug", debugs.gol);
autoScaleViewport(viewports.gol, [golDrawable]);

// -------------------- SCENE MANAGER --------------------
const sceneManager = new SceneManager();
for (let key of Object.keys(apps)) sceneManager.add(apps[key], scenes[key], viewports[key], key);
sceneManager.init();
sceneManager.attachWindowResize();

// -------------------- ANIMATION HELPERS --------------------
function interpolateFrames(drawable, frames, frameA, frameB, t) {
  if (!frames[frameA] || !frames[frameB]) {
    console.warn("Invalid frame indices:", frameA, frameB, frames.length);
    return;
  }
  drawable.data = frames[frameA].map((pt, i) => {
    const y1 = frames[frameA][i].y, y2 = frames[frameB][i].y;
    return new V2(pt.x, y1 * (1 - t) + y2 * t);
  });
}


function rotateTriangles(triangles, angle) {
  triangles.forEach(({ original, drawable }) => {
    const center = new V2(
      (original[0].x + original[1].x + original[2].x) / 3,
      (original[0].y + original[1].y + original[2].y) / 3
    );
    drawable.points = original.map(p => projectYRotation(p, center, angle));
  });
}

function updateUnitTriangle(angle) {
  ptB = new V2(Math.cos(angle), 0);
  ptC = new V2(Math.cos(angle), Math.sin(angle));
  triangle.points = [ptA, ptB, ptC];
  lineSine.p1 = ptC; lineSine.p2 = new V2(ptC.x, 0);
  lineTangent.p1 = ptB; lineTangent.p2 = ptC;
  labelB.pos = ptB; labelC.pos = ptC;
}

function jitterPoints(points, magnitude = 0.02) {
  points.forEach(p => {
    p.pos.x += (Math.random() - 0.5) * magnitude;
    p.pos.y += (Math.random() - 0.5) * magnitude;
  });
}

function updateGOL(grid) {
  const next = grid.map(row => [...row]);
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      let count = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (!(dx === 0 && dy === 0)) {
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length && grid[ny][nx]) count++;
          }
      next[y][x] = grid[y][x] ? (count === 2 || count === 3 ? 1 : 0) : (count === 3 ? 1 : 0);
    }
  }
  return next;
}

// -------------------- MAIN LOOP --------------------
const startTime = performance.now(), loopDuration = 8000;
let lastGOLUpdate = performance.now();

function mainLoop(now) {
  const elapsed = now - startTime;
  const loopProgress = (elapsed % loopDuration) / loopDuration;
  const exactFrame = loopProgress * numVariations;
  const frameA = Math.floor(exactFrame) % numVariations;
  const frameB = (frameA + 1) % numVariations;
  const t = exactFrame - frameA;

  interpolateFrames(signalWave, cachedSignals, frameA, frameB, t);

  rotateTriangles(triforceTriangles, (now * 0.001) % (2 * Math.PI));
  updateUnitTriangle((now * 0.001) % (2 * Math.PI));
  jitterPoints(scatterPoints);

  if (now - lastGOLUpdate > 200) {
    golGrid = updateGOL(golGrid);
    golDrawable.grid = golGrid;
    lastGOLUpdate = now;
  }

  DebugUI.updateAll();
}

sceneManager.startLoop(mainLoop);
