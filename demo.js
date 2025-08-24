import {
    Graph,
    DrawableFunction,
    DrawableCircle,
    DrawableTriangle,
    DrawableLine,
    DrawableText,
    ViewportManager,
    getDivViewport,
    DynamicCanvasRenderer,
    projectYRotation,
    V2,
    Transform2D,
    Intercepts,
    DrawablePoint
} from "./canvasLib.js";

// -------------------- CANVAS APPS --------------------
const sineApp = new DynamicCanvasRenderer(document.getElementById("signalWrapper"));
const unitApp = new DynamicCanvasRenderer(document.getElementById("unitWrapper"));
const triforceApp = new DynamicCanvasRenderer(document.getElementById("triforceWrapper"));

// -------------------- VIEWPORTS --------------------
const targetAspect = 1;

const signalVP = new ViewportManager(
    sineApp.app,
    null,
    () => getDivViewport(document.getElementById("signalWrapper"), targetAspect)
);
const signalGraph = new Graph(signalVP, { color: "#aaa",margin: 10});

const unitVP = new ViewportManager(
    unitApp.app,
    { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
    () => getDivViewport(document.getElementById("unitWrapper"), 1),
    true
);
const unitGraph = new Graph(unitVP, { numTicksX: 2, numTicksY: 2, color: "#aaa" });


const triforceVP = new ViewportManager(
    triforceApp.app,
    { xMin: -1, xMax: 2, yMin: -0.5, yMax: 2 },
    () => getDivViewport(document.getElementById("triforceWrapper"), targetAspect),
    true
);
const triforceGraph = new Graph(triforceVP, { });

// -------------------- WAVE DATA --------------------

const baseTimeSeries = Array.from({ length: 500 }, (_, i) => {
    const t = i * 0.01;
    return {
        x: i,
        y: Math.sin(2 * Math.PI * 0.06 * t) * Math.exp(-t * 0.01)   
          + 0.2 * Math.sin(2 * Math.PI * 0.18 * t) * Math.exp(-t * 0.015) 
    };
});

const numVariations = 100;
const cachedSignals = Array.from({ length: numVariations }, (_, v) =>
    baseTimeSeries.map((pt, i) => {
        const t = i * 0.01;
        return {
            x: pt.x,
            y: pt.y
              + 0.05 * Math.sin(2 * Math.PI * 0.06 * t + v * 0.1) 
              + 0.05 * (Math.random() - 0.5) 
        };
    })
);

const signalWave = new DrawableFunction(
    cachedSignals[0].map(pt => new V2(pt.x, pt.y)),
    { color: "lime", fill: false }
);
signalWave.graph = signalGraph;

// -------------------- UNIT CIRCLE --------------------
const circle = new DrawableCircle(new V2(0, 0), 1, { color: "cyan" });

const ptA = new V2(0, 0);
let ptB = new V2(Math.cos(Math.PI / 6), 0);
let ptC = new V2(Math.cos(Math.PI / 6), Math.sin(Math.PI / 6));

const triangle = new DrawableTriangle(ptA, ptB, ptC, {
    color: "yellow", fill: true, fillColor: "rgba(255,255,0,0.3)"
});
const lineSine = new DrawableLine(ptC, new V2(ptC.x, 0), { color: "cyan", width: 2 });
const lineTangent = new DrawableLine(ptB, ptC, { color: "magenta", width: 2 });

const labelA = new DrawableText("A", ptA, { color: "white" });
const labelB = new DrawableText("B", ptB, { color: "white" });
const labelC = new DrawableText("C", ptC, { color: "white" });

// -------------------- TRIFORCE --------------------
const triforceSize = 0.5;
const makeTriangle = (x, y) => [
    new V2(x - triforceSize / 2, y),
    new V2(x + triforceSize / 2, y),
    new V2(x, y + triforceSize)
];

const triTopOriginal = makeTriangle(0.5, 1);
const triLeftOriginal = makeTriangle(0.25, 0.5);
const triRightOriginal = makeTriangle(0.75, 0.5);

const triTop = new DrawableTriangle(...triTopOriginal, { color: "yellow", fill: true, fillColor: "rgba(255,255,0,0.5)" });
const triLeft = new DrawableTriangle(...triLeftOriginal, { color: "yellow", fill: true, fillColor: "rgba(255,255,0,0.5)" });
const triRight = new DrawableTriangle(...triRightOriginal, { color: "yellow", fill: true, fillColor: "rgba(255,255,0,0.5)" });


// -------------------- SCATTER PLOT --------------------
const scatterApp = new DynamicCanvasRenderer(document.getElementById("scatterWrapper"));
const scatterVP = new ViewportManager(
  scatterApp.app,
  { xMin: -2, xMax: 2, yMin: -2, yMax: 2 },
  () => getDivViewport(document.getElementById("scatterWrapper"), 1),
  true
);
const scatterGraph = new Graph(scatterVP, { numTicksX: 4, numTicksY: 4, color: "#888" });

const NUM_POINTS = 50;
const scatterPoints = Array.from({ length: NUM_POINTS }, () => {
  return new DrawablePoint(
    new V2((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3),
    { color: Math.random() < 0.5 ? "magenta" : "cyan", size: 3, cross: Math.random() < 0.5 }
  );
});

// -------------------- MAIN ANIMATE LOOP --------------------
const loopDuration = 4000;
let startTime = performance.now();
function animate() {


  const now = performance.now();
  const elapsed = now - startTime;
  const loopProgress = (elapsed % loopDuration) / loopDuration;
  const exactFrame = loopProgress * numVariations;
  const frameA = Math.floor(exactFrame) % numVariations;
  const frameB = (frameA + 1) % numVariations;
  const t = exactFrame - frameA;

  // Interpolate signal
  signalWave.data = cachedSignals[frameA].map((pt, i) => {
    const y1 = cachedSignals[frameA][i].y;
    const y2 = cachedSignals[frameB][i].y;
    return new V2(pt.x, y1 * (1 - t) + y2 * t);
  });

  const triforceAngle = (now * 0.001) % (2 * Math.PI);
  const applyYRotation = (original, tri) => {
    const center = new V2(
      (original[0].x + original[1].x + original[2].x) / 3,
      (original[0].y + original[1].y + original[2].y) / 3
    );
    tri.points = original.map(p => projectYRotation(p, center, triforceAngle));
  };
  applyYRotation(triTopOriginal, triTop);
  applyYRotation(triLeftOriginal, triLeft);
  applyYRotation(triRightOriginal, triRight);

  const angle = (now * 0.001) % (2 * Math.PI);
  ptB = new V2(Math.cos(angle), 0);
  ptC = new V2(Math.cos(angle), Math.sin(angle));
  triangle.points = [ptA, ptB, ptC];
  lineSine.p1 = ptC;
  lineSine.p2 = new V2(ptC.x, 0);
  lineTangent.p1 = ptB;
  lineTangent.p2 = ptC;
  labelB.pos = ptB;
  labelC.pos = ptC;

  scatterPoints.forEach(p => {
    p.pos.x += (Math.random() - 0.5) * 0.02;
    p.pos.y += (Math.random() - 0.5) * 0.02;
  });

  // -------------------- RENDER --------------------
  sineApp.clear();
  signalGraph.draw(sineApp.app, [cachedSignals[0].map(pt => new V2(pt.x, pt.y))]);
  signalWave.draw(sineApp.app, signalGraph);
  Intercepts.drawX(sineApp.app, signalGraph, signalWave.data, "yellow");
  sineApp.render();

  unitApp.clear();
  unitGraph.draw(unitApp.app);
  circle.draw(unitApp.app, unitGraph);
  lineSine.draw(unitApp.app, unitGraph);
  lineTangent.draw(unitApp.app, unitGraph);
  labelA.draw(unitApp.app, unitGraph);
  labelB.draw(unitApp.app, unitGraph);
  labelC.draw(unitApp.app, unitGraph);
  triangle.draw(unitApp.app, unitGraph);
  unitApp.render();

  triforceApp.clear();
  triTop.draw(triforceApp.app, triforceGraph);
  triLeft.draw(triforceApp.app, triforceGraph);
  triRight.draw(triforceApp.app, triforceGraph);
  triforceApp.render();

  scatterApp.clear();
  scatterGraph.draw(scatterApp.app);
  scatterPoints.forEach(p => p.draw(scatterApp.app, scatterGraph));
  scatterApp.render();

  requestAnimationFrame(animate);
}
animate();