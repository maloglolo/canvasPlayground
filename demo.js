import {
    Graph,
    DrawableFunction,
    DrawableCircle,
    DrawableTriangle,
    DrawableLine,
    DrawableText,
    ViewportManager,
    projectYRotation,
    Intercepts,
    getDivViewport,
    DynamicCanvasRenderer
} from "./canvasLib.js";

// -------------------- CANVAS APPS --------------------
const sineApp = new DynamicCanvasRenderer(document.getElementById("sineWrapper"));
const unitApp = new DynamicCanvasRenderer(document.getElementById("unitWrapper"));
const triforceApp = new DynamicCanvasRenderer(document.getElementById("triforceWrapper"));

// -------------------- VIEWPORTS --------------------
const targetAspect = 1;

const sineVP = new ViewportManager(
    sineApp.app,
    { xMin: 0, xMax: 500, yMin: -2, yMax: 2 },
    () => getDivViewport(document.getElementById("sineWrapper"), targetAspect)
);
const sineGraph = new Graph(sineVP, { numTicksX: 10, numTicksY: 8, color: "#aaa" });

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
const triforceGraph = new Graph(triforceVP, { numTicksX: 6, numTicksY: 6, color: "#aaa" });

// -------------------- SINE WAVE DATA --------------------
const baseTimeSeries = Array.from({ length: 500 }, (_, i) => ({
    x: i,
    y: Math.sin(i * 0.01) * Math.exp(-i * 0.001) +
       Math.sin(i * 0.05) * Math.exp(-i * 0.005)
}));

const numVariations = 50;
const cachedSineWaves = Array.from({ length: numVariations }, (_, v) =>
    baseTimeSeries.map((pt, i) => ({
        x: pt.x,
        y: pt.y + 0.1 * Math.sin(i * 0.2 + v)
    }))
);

const sineWave = new DrawableFunction([...cachedSineWaves[0]], {
    color: "cyan",
    fill: true,
    fillColor: "rgba(0,255,255,0.2)"
});
sineWave.graph = sineGraph;

// -------------------- UNIT CIRCLE --------------------
const circle = new DrawableCircle({ x: 0, y: 0 }, 1, { color: "cyan" });

const ptA = { x: 0, y: 0 };
let ptB = { x: Math.cos(Math.PI / 6), y: 0 };
let ptC = { x: Math.cos(Math.PI / 6), y: Math.sin(Math.PI / 6) };

const triangle = new DrawableTriangle(ptA, ptB, ptC, {
    color: "yellow", fill: true, fillColor: "rgba(255,255,0,0.3)"
});
const lineSine = new DrawableLine(ptC, { x: ptC.x, y: 0 }, { color: "cyan", width: 2 });
const lineTangent = new DrawableLine(ptB, ptC, { color: "magenta", width: 2 });

const labelA = new DrawableText("A", ptA, { color: "white" });
const labelB = new DrawableText("B", ptB, { color: "white" });
const labelC = new DrawableText("C", ptC, { color: "white" });

// -------------------- TRIFORCE --------------------
const triforceSize = 0.5;
const makeTriangle = (x, y) => [
    { x: x - triforceSize / 2, y: y },
    { x: x + triforceSize / 2, y: y },
    { x: x, y: y + triforceSize }
];

const triTopOriginal = makeTriangle(0.5, 1);
const triLeftOriginal = makeTriangle(0.25, 0.5);
const triRightOriginal = makeTriangle(0.75, 0.5);

const triTop = new DrawableTriangle(...triTopOriginal, { color: "yellow", fill: true, fillColor: "rgba(255,255,0,0.5)" });
const triLeft = new DrawableTriangle(...triLeftOriginal, { color: "yellow", fill: true, fillColor: "rgba(255,255,0,0.5)" });
const triRight = new DrawableTriangle(...triRightOriginal, { color: "yellow", fill: true, fillColor: "rgba(255,255,0,0.5)" });

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

    // Interpolate sine wave
    sineWave.data = cachedSineWaves[frameA].map((pt, i) => {
        const y1 = cachedSineWaves[frameA][i].y;
        const y2 = cachedSineWaves[frameB][i].y;
        return { x: pt.x, y: y1 * (1 - t) + y2 * t };
    });

    // Rotate triforce
    const triforceAngle = (now * 0.001) % (2 * Math.PI);
    const rotateTri = (original, tri) => {
        const center = {
            x: (original[0].x + original[1].x + original[2].x) / 3,
            y: (original[0].y + original[1].y + original[2].y) / 3
        };
        tri.points = original.map(p => projectYRotation(p, center, triforceAngle));
    };
    rotateTri(triTopOriginal, triTop);
    rotateTri(triLeftOriginal, triLeft);
    rotateTri(triRightOriginal, triRight);

    // Update unit circle triangle
    const angle = (now * 0.001) % (2 * Math.PI);
    ptB = { x: Math.cos(angle), y: 0 };
    ptC = { x: Math.cos(angle), y: Math.sin(angle) };
    triangle.points = [ptA, ptB, ptC];
    lineSine.p1 = ptC;
    lineSine.p2 = { x: ptC.x, y: 0 };
    lineTangent.p1 = ptB;
    lineTangent.p2 = ptC;
    labelB.pos = ptB;
    labelC.pos = ptC;

    // -------------------- RENDER --------------------
    sineApp.clear();
    sineGraph.draw(sineApp.app);
    sineWave.draw(sineApp.app, sineGraph);
    Intercepts.drawX(sineApp.app, sineGraph, sineWave.data);
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

    requestAnimationFrame(animate);
}

animate();
