import {
    CanvasApp, Graph, DrawableFunction, DrawableCircle, DrawableTriangle,
    DrawableLine, DrawableText, Intercepts, ViewportManager, projectYRotation
} from "./canvasLib.js";

const canvas = document.getElementById("mainCanvas");
const app = new CanvasApp(canvas);

function getViewportFromDivAspect(div, aspect = 1) {
    const rect = div.getBoundingClientRect();
    let width = rect.width;
    let height = rect.height;

    const divAspect = width / height;

    if (divAspect > aspect) {
        width = height * aspect;
    } else {
        height = width / aspect;
    }

    return { x: rect.left, y: rect.top, width, height };
}

const targetAspect = 1; // square

// -------------------- SINE WAVE --------------------
const sineVP = new ViewportManager(
    app,
    { xMin: 0, xMax: 500, yMin: -2, yMax: 2 },
    () => getViewportFromDivAspect(document.getElementById("sineWrapper"), targetAspect),
    false
);

const sineGraph = new Graph(sineVP, { numTicksX: 10, numTicksY: 8, color: "#aaa" });

const baseTimeSeries = Array.from({ length: 500 }, (_, i) => ({
    x: i,
    y: Math.sin(i * 0.01) * Math.exp(-i * 0.001) + Math.sin(i * 0.05) * Math.exp(-i * 0.005)
}));

const numVariations = 50;
const cachedSineWaves = [];
for (let v = 0; v < numVariations; v++) {
    cachedSineWaves.push(
        baseTimeSeries.map((pt, i) => ({
            x: pt.x,
            y: pt.y + 0.1 * Math.sin(i * 0.2 + v)
        }))
    );
}

const sineWave = new DrawableFunction([...cachedSineWaves[0]], "cyan", true, "rgba(0,255,255,0.2)");

// -------------------- UNIT CIRCLE --------------------
const unitVP = new ViewportManager(
    app,
    { xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5 },
    () => getViewportFromDivAspect(document.getElementById("unitWrapper"), targetAspect),
    true
);
const unitGraph = new Graph(unitVP, { numTicksX: 4, numTicksY: 4, color: "#aaa" });

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
const triforceVP = new ViewportManager(
    app,
    { xMin: -1, xMax: 2, yMin: -0.5, yMax: 2 },
    () => getViewportFromDivAspect(document.getElementById("triforceWrapper"), targetAspect),
    true
);

const triforceSize = 0.5;
const triTopOriginal = [
    { x: 0.5 - triforceSize / 2, y: 1 },
    { x: 0.5 + triforceSize / 2, y: 1 },
    { x: 0.5, y: 1 + triforceSize }
];
const triLeftOriginal = [
    { x: 0.25 - triforceSize / 2, y: 0.5 },
    { x: 0.25 + triforceSize / 2, y: 0.5 },
    { x: 0.25, y: 0.5 + triforceSize }
];
const triRightOriginal = [
    { x: 0.75 - triforceSize / 2, y: 0.5 },
    { x: 0.75 + triforceSize / 2, y: 0.5 },
    { x: 0.75, y: 0.5 + triforceSize }
];

const triTop = new DrawableTriangle(...triTopOriginal, "yellow", true, "rgba(255,255,0,0.5)");
const triLeft = new DrawableTriangle(...triLeftOriginal, "yellow", true, "rgba(255,255,0,0.5)");
const triRight = new DrawableTriangle(...triRightOriginal, "yellow", true, "rgba(255,255,0,0.5)");

// -------------------- RENDER --------------------
const loopDuration = 4000;
let startTime = performance.now();

app.addRenderable({
    draw(app) {
        const now = performance.now();
        const elapsed = now - startTime;
        const loopProgress = (elapsed % loopDuration) / loopDuration;
        const exactFrame = loopProgress * numVariations;
        const frameA = Math.floor(exactFrame) % numVariations;
        const frameB = (frameA + 1) % numVariations;
        const t = exactFrame - frameA;

        const interpolatedData = cachedSineWaves[frameA].map((pt, i) => {
            const y1 = cachedSineWaves[frameA][i].y;
            const y2 = cachedSineWaves[frameB][i].y;
            return { x: pt.x, y: y1 * (1 - t) + y2 * t };
        });

        sineWave.data = interpolatedData;

        sineGraph.draw(app);
        sineWave.draw(app, sineGraph);
        Intercepts.drawX(app, sineGraph, sineWave.data);

        unitGraph.draw(app);
        circle.draw(app, unitGraph);
        lineSine.draw(app, unitGraph);
        lineTangent.draw(app, unitGraph);
        labelA.draw(app, unitGraph);
        labelB.draw(app, unitGraph);
        labelC.draw(app, unitGraph);
        triangle.draw(app, unitGraph);

        triTop.draw(app, triforceVP);
        triLeft.draw(app, triforceVP);
        triRight.draw(app, triforceVP);
    }
});

function animate() {
    const now = Date.now() * 0.001;

    const triforceAngle = now % (2 * Math.PI);
    function rotateTri(original) {
        const center = {
            x: (original[0].x + original[1].x + original[2].x) / 3,
            y: (original[0].y + original[1].y + original[2].y) / 3
        };
        return original.map(pt => projectYRotation(pt, center, triforceAngle));
    }
    triTop.points = rotateTri(triTopOriginal);
    triLeft.points = rotateTri(triLeftOriginal);
    triRight.points = rotateTri(triRightOriginal);

    const angle = now % (2 * Math.PI);
    ptB = { x: Math.cos(angle), y: 0 };
    ptC = { x: Math.cos(angle), y: Math.sin(angle) };
    triangle.points = [ptA, ptB, ptC];
    lineSine.p1 = ptC;
    lineSine.p2 = { x: ptC.x, y: 0 };
    lineTangent.p1 = ptB;
    lineTangent.p2 = ptC;
    labelB.pos = ptB;
    labelC.pos = ptC;

    app.renderAll();
    requestAnimationFrame(animate);
}

animate();
