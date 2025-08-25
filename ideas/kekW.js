// -------------------- CORE "CLASSES" --------------------
class CanvasApp {
    constructor() {
        this.canvas = document.querySelector("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.size = { x: window.innerWidth, y: window.innerHeight };
        this.resizeCanvas();

        this.resizeCallbacks = [];
        this.renderables = [];
        window.addEventListener("resize", () => this.onResize());
    }

    resizeCanvas() {
        this.canvas.width = this.size.x;
        this.canvas.height = this.size.y;
    }

    onResize() {
        this.size = { x: window.innerWidth, y: window.innerHeight };
        this.resizeCanvas();
        this.renderAll();
        this.resizeCallbacks.forEach(cb => cb());
    }

    onResizeCallback(cb) {
        this.resizeCallbacks.push(cb);
    }

    addRenderable(obj) {
        this.renderables.push(obj);
    }

    renderAll() {
        this.clear();
        this.renderables.forEach(obj => obj.draw(this));
    }

    clear(color = "#131313") {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.size.x, this.size.y);
    }
}

class ViewportManager {
    constructor(app, worldBounds, viewport, preserveAspect = false) {
        this.app = app;
        this.worldBounds = worldBounds;
        this._viewport = viewport || { x: 0, y: 0, width: app.size.x, height: app.size.y };
        this.preserveAspect = preserveAspect;
    }

    get viewport() {
        return typeof this._viewport === "function" ? this._viewport(this.app) : this._viewport;
    }

    get scale() {
        const { xMin, xMax, yMin, yMax } = this.worldBounds;
        const xRange = xMax - xMin;
        const yRange = yMax - yMin;
        const vp = this.viewport;

        if (!this.preserveAspect) return { x: vp.width / xRange, y: vp.height / yRange };

        const viewRatio = vp.width / vp.height;
        const dataRatio = xRange / yRange;
        const s = viewRatio > dataRatio ? vp.height / yRange : vp.width / xRange;
        return { x: s, y: s };
    }

    worldToCanvas(x, y) {
        const vp = this.viewport;
        const { xMin, xMax, yMin, yMax } = this.worldBounds;
        const xRange = xMax - xMin;
        const yRange = yMax - yMin;

        if (this.preserveAspect) {
            const s = this.scale.x;
            const scaledWidth = s * xRange;
            const scaledHeight = s * yRange;
            const offsetX = vp.x + (vp.width - scaledWidth) / 2;
            const offsetY = vp.y + (vp.height - scaledHeight) / 2;
            return [
                offsetX + (x - xMin) * s,
                offsetY + (yRange - (y - yMin)) * s
            ];
        } else {
            const { x: scaleX, y: scaleY } = this.scale;
            return [
                vp.x + (x - xMin) * scaleX,
                vp.y + (yMax - y) * scaleY
            ];
        }
    }
}

// -------------------- GRAPH & GRID --------------------
class Graph {
    constructor(viewportManager, options = {}) {
        this.vp = viewportManager;
        this.tickSize = options.tickSize || 10;
        this.numTicksX = options.numTicksX || 10;
        this.numTicksY = options.numTicksY || 10;
        this.font = options.font || "12px sans-serif";
        this.color = options.color || "#F9FBFF";
    }

    generateGridLines() {
        const lines = [];
        const { xMin, xMax, yMin, yMax } = this.vp.worldBounds;
        const dx = (xMax - xMin) / this.numTicksX;
        const dy = (yMax - yMin) / this.numTicksY;

        for (let i = 0; i <= this.numTicksX; i++) {
            const x = xMin + i * dx;
            const [cx, cy0] = this.vp.worldToCanvas(x, yMin);
            const [_, cy1] = this.vp.worldToCanvas(x, yMax);
            lines.push([cx, cy0, cx, cy1]);
        }

        for (let i = 0; i <= this.numTicksY; i++) {
            const y = yMin + i * dy;
            const [cx0, cy] = this.vp.worldToCanvas(xMin, y);
            const [cx1, _] = this.vp.worldToCanvas(xMax, y);
            lines.push([cx0, cy, cx1, cy]);
        }

        const arr = new Float32Array(lines.length * 4);
        for (let i = 0; i < lines.length; i++) arr.set(lines[i], i * 4);
        return arr;
    }

    drawLines(app, lines, color = "#F9FBFF") {
        const ctx = app.ctx;
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (let i = 0; i < lines.length; i += 4) {
            ctx.moveTo(lines[i], lines[i + 1]);
            ctx.lineTo(lines[i + 2], lines[i + 3]);
        }
        ctx.stroke();
    }

    draw(app) {
        const grid = this.generateGridLines();
        this.drawLines(app, grid, this.color);
        this.drawLabels(app);
    }

    drawLabels(app) {
        const ctx = app.ctx;
        ctx.fillStyle = this.color;
        ctx.font = this.font;
        const { xMin, xMax, yMin, yMax } = this.vp.worldBounds;

        // X labels
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const yAxisPos = yMin <= 0 && yMax >= 0 ? this.vp.worldToCanvas(0, 0)[1] : this.vp.worldToCanvas(0, yMin)[1];
        const dx = (xMax - xMin) / this.numTicksX;
        for (let i = 0; i <= this.numTicksX; i++) {
            const x = xMin + i * dx;
            const [cx, _] = this.vp.worldToCanvas(x, yMin);
            ctx.fillText(x.toFixed(0), cx, yAxisPos + 4);
        }

        // Y labels
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        const xAxisPos = xMin <= 0 && xMax >= 0 ? this.vp.worldToCanvas(0, 0)[0] : this.vp.worldToCanvas(xMin, 0)[0];
        const dy = (yMax - yMin) / this.numTicksY;
        for (let i = 0; i <= this.numTicksY; i++) {
            const y = yMin + i * dy;
            const [_, cy] = this.vp.worldToCanvas(xMin, y);
            ctx.fillText(y.toFixed(0), xAxisPos + 15, cy);
        }
    }
}

// -------------------- OBJECTS --------------------
class DrawableFunction {
    constructor(data, color = "red", fill = false, fillColor = "rgba(255,0,0,0.3)") {
        this.data = data;
        this.color = color;
        this.fill = fill;
        this.fillColor = fillColor;
    }

    draw(app, graph) {
        if (!graph) throw "Graph reference required";
        const ctx = app.ctx;
        if (!this.data.length) return;

        ctx.strokeStyle = this.color;
        ctx.beginPath();

        let [px, py] = graph.vp.worldToCanvas(this.data[0].x, this.data[0].y);
        ctx.moveTo(px, py);

        for (let i = 1; i < this.data.length; i++) {
            [px, py] = graph.vp.worldToCanvas(this.data[i].x, this.data[i].y);
            ctx.lineTo(px, py);
        }

        if (this.fill) {
            const [pxEnd, pyEnd] = graph.vp.worldToCanvas(this.data[this.data.length - 1].x, 0);
            ctx.lineTo(pxEnd, pyEnd);
            const [pxStart, pyStart] = graph.vp.worldToCanvas(this.data[0].x, 0);
            ctx.lineTo(pxStart, pyStart);
            ctx.closePath();
            ctx.fillStyle = this.fillColor;
            ctx.fill();
        }

        ctx.stroke();
    }
}

class DrawableCircle {
    constructor(center = { x: 0, y: 0 }, radius = 1, color = "white", segments = 64) {
        this.center = center;
        this.radius = radius;
        this.color = color;
        this.segments = segments;
    }

    draw(app, graph) {
        const points = [];
        for (let i = 0; i <= this.segments; i++) {
            const angle = (i / this.segments) * Math.PI * 2;
            points.push(graph.vp.worldToCanvas(
                this.center.x + Math.cos(angle) * this.radius,
                this.center.y + Math.sin(angle) * this.radius
            ));
        }

        const lineCoords = new Float32Array((points.length - 1) * 4);
        for (let i = 0; i < points.length - 1; i++) {
            lineCoords.set(points[i], i * 4);
            lineCoords.set(points[i + 1], i * 4 + 2);
        }

        graph.drawLines(app, lineCoords, this.color);
    }
}

class DrawableLine {
    constructor(p1, p2, color = "yellow", width = 2) {
        this.p1 = p1;
        this.p2 = p2;
        this.color = color;
        this.width = width;
    }

    draw(app, graph) {
        const ctx = app.ctx;
        ctx.lineWidth = this.width;
        const coords = new Float32Array([
            ...graph.vp.worldToCanvas(this.p1.x, this.p1.y),
            ...graph.vp.worldToCanvas(this.p2.x, this.p2.y)
        ]);
        graph.drawLines(app, coords, this.color);
        ctx.lineWidth = 1;
    }
}

class DrawableText {
    constructor(text, pos, color = "white", font = "14px sans-serif") {
        this.text = text;
        this.pos = pos;
        this.color = color;
        this.font = font;
    }

    draw(app, graph) {
        const ctx = app.ctx;
        const [x, y] = graph.vp.worldToCanvas(this.pos.x, this.pos.y);
        ctx.fillStyle = this.color;
        ctx.font = this.font;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(this.text, x, y);
    }
}

class DrawableTriangle {
    constructor(p1, p2, p3, color = "yellow", fill = true, fillColor = "rgba(255,255,0,0.5)") {
        this.points = [p1, p2, p3];
        this.color = color;
        this.fill = fill;
        this.fillColor = fillColor;
    }

    draw(app, obj) {
        const ctx = app.ctx;
        const vp = obj.vp || obj; 
        ctx.beginPath();
        let [x, y] = vp.worldToCanvas(this.points[0].x, this.points[0].y);
        ctx.moveTo(x, y);

        for (let i = 1; i < this.points.length; i++) {
            [x, y] = vp.worldToCanvas(this.points[i].x, this.points[i].y);
            ctx.lineTo(x, y);
        }

        ctx.closePath();
        if (this.fill) {
            ctx.fillStyle = this.fillColor;
            ctx.fill();
        }
        ctx.strokeStyle = this.color;
        ctx.stroke();
    }

}

// -------------------- UTILS --------------------
function rotatePoint(p, center, angle) {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos
    };
}

function rotateTriangleAroundCenter(tri, center, angle) {
    tri.points = tri.points.map(p => rotatePoint(p, center, angle));
}

function rotateTriangleVertical(tri, center, angle) {
    tri.points = tri.points.map(p => {
        const dx = p.x - center.x;
        const dz = 0;
        const newX = dx * Math.cos(angle) + dz * Math.sin(angle);
        return { x: center.x + newX, y: p.y };
    });
}
function projectYRotation(point, center, angle) {
    const dx = point.x - center.x;
    const xRot = center.x + dx * Math.cos(angle);
    return { x: xRot, y: point.y };
}

class Intercepts {
    static findX(series) {
        const intercepts = [];
        for (let i = 1; i < series.length; i++) {
            const y1 = series[i - 1].y, y2 = series[i].y;
            if (y1 === 0) intercepts.push(series[i - 1].x);
            else if (y1 * y2 < 0) {
                const x1 = series[i - 1].x, x2 = series[i].x;
                intercepts.push(x1 + (-y1 / (y2 - y1)) * (x2 - x1));
            }
        }
        return intercepts;
    }

    static drawX(app, graph, series, color = "yellow") {
        const ctx = app.ctx;
        ctx.fillStyle = color;
        Intercepts.findX(series).forEach(x => {
            const [cx, cy] = graph.vp.worldToCanvas(x, 0);
            ctx.beginPath();
            ctx.arc(cx, cy, 5, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

export {
    CanvasApp,
    Graph,
    DrawableFunction,
    DrawableCircle,
    DrawableTriangle,
    DrawableLine,
    DrawableText,
    Intercepts,
    ViewportManager,
    rotatePoint,
    rotateTriangleAroundCenter,
    rotateTriangleVertical,
    projectYRotation
};