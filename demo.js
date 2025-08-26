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
  DebugUI
} from './dist/canvasLib.js';

// -------------------- CANVAS APPS --------------------
const signalApp = new DynamicCanvasRenderer(document.getElementById("signalWrapper"));
const unitApp = new DynamicCanvasRenderer(document.getElementById("unitWrapper"));
const triforceApp = new DynamicCanvasRenderer(document.getElementById("triforceWrapper"));
const scatterApp = new DynamicCanvasRenderer(document.getElementById("scatterWrapper"));
const timeseriesApp = new DynamicCanvasRenderer(document.getElementById("timeseriesWrapper"));

// -------------------- VIEWPORTS --------------------
const targetAspect = 1;

const signalVP = new ViewportManager(signalApp.app, { xMin: 0, xMax: 500, yMin: -1, yMax: 1 }, getDivViewport(document.getElementById("signalWrapper"), targetAspect), false);
const unitVP = new ViewportManager(unitApp.app, { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }, getDivViewport(document.getElementById("unitWrapper"), 1), "fit");
const triforceVP = new ViewportManager(triforceApp.app, { xMin: -1, xMax: 2, yMin: -0.5, yMax: 2 }, getDivViewport(document.getElementById("triforceWrapper"), targetAspect), "fit");
const scatterVP = new ViewportManager(scatterApp.app, { xMin: -2, xMax: 2, yMin: -2, yMax: 2 }, getDivViewport(document.getElementById("scatterWrapper"), 1), "fit");
const timeseriesVP = new ViewportManager(timeseriesApp.app, { xMin: 0, xMax: 500, yMin: -2, yMax: 2 }, getDivViewport(document.getElementById("timeseriesWrapper"), 2), false);

// -------------------- GRAPHS --------------------
const signalGraph = new Graph(signalVP, { numTicksX: 10, numTicksY: 5, showLabels: true });
const unitGraph = new Graph(unitVP, { numTicksX: 4, numTicksY: 4, showLabels: true });
const scatterGraph = new Graph(scatterVP, { numTicksX: 5, numTicksY: 5, showLabels: true });
const timeseriesGraph = new Graph(timeseriesVP, {
  showGrid: true, showAxes: true, showTicks: true,
  tickSizePx: 8, tickThickness: 2, axisThickness: 2,
  font: "14px sans-serif", textColor: "#fff", labelOffset: 15,
  numTicksX: 10, numTicksY: 8
});

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

// -------------------- DRAWABLES --------------------
const signalWave = new DrawableFunction(cachedSignals[0].map(pt => new V2(pt.x, pt.y)), { color: "lime" });
signalWave.legend = { label: "Signal", color: "lime", symbol: "line" };

const circle = new DrawableCircle(new V2(0, 0), 1, { color: "cyan" });
circle.legend = { label: "Unit Circle", color: "cyan", symbol: "line" };

const ptA = new V2(0, 0);
let ptB = new V2(Math.cos(Math.PI / 6), 0);
let ptC = new V2(Math.cos(Math.PI / 6), Math.sin(Math.PI / 6));
const triangle = new DrawableTriangle(ptA, ptB, ptC, { color: "yellow", fill: true, fillColor: "rgba(255,255,0,0.3)" });
triangle.legend = { label: "Triangle", color: "yellow", symbol: "area" };

const lineSine = new DrawableLine(ptC, new V2(ptC.x, 0), { color: "cyan", width: 2 });
const lineTangent = new DrawableLine(ptB, ptC, { color: "magenta", width: 2 });

const labelA = new DrawableText("A", ptA, { color: "white" });
const labelB = new DrawableText("B", ptB, { color: "white" });
const labelC = new DrawableText("C", ptC, { color: "white" });

const triforceSize = 0.5;
const makeTriangle = (x, y) => [new V2(x - triforceSize/2, y), new V2(x + triforceSize/2, y), new V2(x, y + triforceSize)];
const triTopOriginal = makeTriangle(0.5,1);
const triLeftOriginal = makeTriangle(0.25,0.5);
const triRightOriginal = makeTriangle(0.75,0.5);
const triTop = new DrawableTriangle(...triTopOriginal, { color:"yellow", fill:true, fillColor:"rgba(255,255,0,0.5)" });
const triLeft = new DrawableTriangle(...triLeftOriginal, { color:"yellow", fill:true, fillColor:"rgba(255,255,0,0.5)" });
const triRight = new DrawableTriangle(...triRightOriginal, { color:"yellow", fill:true, fillColor:"rgba(255,255,0,0.5)" });

const NUM_POINTS = 50;
const scatterPoints = Array.from({ length: NUM_POINTS }, () =>
  new DrawablePoint(new V2((Math.random()-0.5)*3,(Math.random()-0.5)*3), { color: Math.random()<0.5?"magenta":"cyan", size:3, type: Math.random()<0.5?"cross":"circle" })
);

const timeseriesData = Array.from({ length: 500 }, (_, i) => {
  const t = i*0.01;
  return { x:i, y:Math.sin(2*Math.PI*0.03*t)+0.3*Math.sin(2*Math.PI*0.1*t) };
});
const timeseriesWave = new DrawableFunction(timeseriesData.map(pt=>new V2(pt.x,pt.y)), { color:"lime" });
timeseriesWave.legend = { label:"Time Series", color:"lime", symbol:"line" };

// -------------------- SCENES --------------------
function addToScene(scene, layerName, ...items) {
  scene.add(items, layerName);
}

const signalDebug = new DebugUI(new V2(10, 5)); 
const unitDebug = new DebugUI(new V2(10, 10));
const triforceDebug = new DebugUI(new V2(10, 10));
const scatterDebug = new DebugUI(new V2(10, 10));
const timeseriesDebug = new DebugUI(new V2(10, 10));

const signalScene = new Scene();
addToScene(signalScene, "data", signalGraph, signalWave);
const signalLegend = new DrawableLegend(signalScene.collectLegend(), { anchor: "ne" });
addToScene(signalScene, "ui", signalLegend);
addToScene(signalScene, "debug", signalDebug);

const unitScene = new Scene();
addToScene(unitScene, "data", unitGraph, circle, lineSine, lineTangent, triangle, labelA, labelB, labelC);
const unitLegend = new DrawableLegend(unitScene.collectLegend(), { anchor: "ne" });
addToScene(unitScene, "ui", unitLegend);
addToScene(unitScene, "debug", unitDebug);

const triforceScene = new Scene();
addToScene(triforceScene, "data", triTop, triLeft, triRight);
addToScene(triforceScene, "debug", triforceDebug);

const scatterScene = new Scene();
addToScene(scatterScene, "data", scatterGraph, ...scatterPoints);
addToScene(scatterScene, "debug", scatterDebug);

const timeseriesScene = new Scene();
addToScene(timeseriesScene, "data", timeseriesGraph, timeseriesWave);
const timeseriesLegend = new DrawableLegend(timeseriesScene.collectLegend(), { anchor: "ne" });
addToScene(timeseriesScene, "ui", timeseriesLegend);
addToScene(timeseriesScene, "debug", timeseriesDebug);

// -------------------- ANIMATION LOOP --------------------
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

  signalWave.data = cachedSignals[frameA].map((pt,i)=>{
    const y1 = cachedSignals[frameA][i].y;
    const y2 = cachedSignals[frameB][i].y;
    return new V2(pt.x, y1*(1-t) + y2*t);
  });

  const triforceAngle = (now*0.001) % (2*Math.PI);
  function rotateTri(original, tri){
    const center = new V2(
      (original[0].x+original[1].x+original[2].x)/3,
      (original[0].y+original[1].y+original[2].y)/3
    );
    tri.points = original.map(p=>projectYRotation(p, center, triforceAngle));
  }
  rotateTri(triTopOriginal, triTop);
  rotateTri(triLeftOriginal, triLeft);
  rotateTri(triRightOriginal, triRight);

  const angle = (now*0.001) % (2*Math.PI);
  ptB = new V2(Math.cos(angle),0); ptC = new V2(Math.cos(angle),Math.sin(angle));
  triangle.points = [ptA, ptB, ptC];
  lineSine.p1 = ptC; lineSine.p2 = new V2(ptC.x,0);
  lineTangent.p1 = ptB; lineTangent.p2 = ptC;
  labelB.pos = ptB; labelC.pos = ptC;

  scatterPoints.forEach(p => {
    p.pos.x += (Math.random()-0.5)*0.02;
    p.pos.y += (Math.random()-0.5)*0.02;
  });


  DebugUI.updateAll();

  // Render all scenes
  [
    [signalApp, signalScene, signalVP],
    [unitApp, unitScene, unitVP],
    [triforceApp, triforceScene, triforceVP],
    [scatterApp, scatterScene, scatterVP],
    [timeseriesApp, timeseriesScene, timeseriesVP]
  ].forEach(([app, scene, vp])=>{
    app.clear();
    scene.draw(app.app, vp);
    app.render();
  });

  requestAnimationFrame(animate);
}

animate();
