import {
    CanvasApp,
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
    DivCanvasApp
} from "./canvasLib.js";

const sineApp = new DivCanvasApp(document.getElementById("sineWrapper"));
const unitApp = new DivCanvasApp(document.getElementById("unitWrapper"));
const triforceApp = new DivCanvasApp(document.getElementById("triforceWrapper"));

// -------------------- VIEWPORTS --------------------
const targetAspect = 1;

const sineVP = new ViewportManager(
    sineApp.app,
    { xMin: 0, xMax: 500, yMin: -2, yMax: 2 },
    () => getDivViewport(document.getElementById("sineWrapper"), targetAspect),
    false
);
const sineGraph = new Graph(sineVP, { numTicksX: 10, numTicksY: 8, color: "#aaa" });

const unitVP = new ViewportManager(
    unitApp.app,
    { xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5 },
    () => getDivViewport(document.getElementById("unitWrapper"), targetAspect),
    true
);
const unitGraph = new Graph(unitVP, { numTicksX: 4, numTicksY: 4, color: "#aaa" });

const triforceVP = new ViewportManager(
    triforceApp.app,
    { xMin: -1, xMax: 2, yMin: -0.5, yMax: 2 },
    () => getDivViewport(document.getElementById("triforceWrapper"), targetAspect),
    true
);

// -------------------- SINE WAVE DATA --------------------
const baseTimeSeries = Array.from({ length: 500 }, (_, i) => ({
    x: i,
    y: Math.sin(i * 0.01) * Math.exp(-i * 0.001) + Math.sin(i * 0.05) * Math.exp(-i * 0.005)
}));

const numVariations = 50;
const cachedSineWaves = [];
for (let v = 0; v < numVariations; v++) {
    cachedSineWaves.push(
        baseTimeSeries.map((pt, i) => ({ x: pt.x, y: pt.y + 0.1 * Math.sin(i * 0.2 + v) }))
    );
}
const sineWave = new DrawableFunction([...cachedSineWaves[0]], "cyan", true, "rgba(0,255,255,0.2)");
sineWave.graph = sineGraph;

// -------------------- UNIT CIRCLE --------------------
const circle = new DrawableCircle({ x: 0, y: 0 }, 1, "cyan");
const ptA = { x: 0, y: 0 };
let ptB = { x: Math.cos(Math.PI / 6), y: 0 };
let ptC = { x: Math.cos(Math.PI / 6), y: Math.sin(Math.PI / 6) };
const triangle = new DrawableTriangle(ptA, ptB, ptC, "yellow", true, "rgba(255,255,0,0.3)");
const lineSine = new DrawableLine(ptC, { x: ptC.x, y: 0 }, "cyan", 2);
const lineTangent = new DrawableLine(ptB, ptC, "magenta", 2);
const labelA = new DrawableText("A", ptA, "white");
const labelB = new DrawableText("B", ptB, "white");
const labelC = new DrawableText("C", ptC, "white");

// -------------------- TRIFORCE --------------------
const triforceSize = 0.5;
function makeTriangle(x, y) {
    return [
        { x: x - triforceSize / 2, y: y },
        { x: x + triforceSize / 2, y: y },
        { x: x, y: y + triforceSize }
    ];
}
const triTopOriginal = makeTriangle(0.5, 1);
const triLeftOriginal = makeTriangle(0.25, 0.5);
const triRightOriginal = makeTriangle(0.75, 0.5);

const triTop = new DrawableTriangle(...triTopOriginal, "yellow", true, "rgba(255,255,0,0.5)");
const triLeft = new DrawableTriangle(...triLeftOriginal, "yellow", true, "rgba(255,255,0,0.5)");
const triRight = new DrawableTriangle(...triRightOriginal, "yellow", true, "rgba(255,255,0,0.5)");

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

    // interpolate sine wave
    const interpolatedData = cachedSineWaves[frameA].map((pt, i) => {
        const y1 = cachedSineWaves[frameA][i].y;
        const y2 = cachedSineWaves[frameB][i].y;
        return { x: pt.x, y: y1 * (1 - t) + y2 * t };
    });
    sineWave.data = interpolatedData;

    const triforceAngle = (now * 0.001) % (2 * Math.PI);
    function rotateTri(original, tri) {
        const center = {
            x: (original[0].x + original[1].x + original[2].x) / 3,
            y: (original[0].y + original[1].y + original[2].y) / 3
        };
        tri.points = original.map(p => projectYRotation(p, center, triforceAngle));
    }
    rotateTri(triTopOriginal, triTop);
    rotateTri(triLeftOriginal, triLeft);
    rotateTri(triRightOriginal, triRight);

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
    triTop.draw(triforceApp.app, triforceVP);
    triLeft.draw(triforceApp.app, triforceVP);
    triRight.draw(triforceApp.app, triforceVP);
    triforceApp.render();

    requestAnimationFrame(animate);
}

animate();