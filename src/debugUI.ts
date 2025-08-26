// src/DebugUI.ts
import { Drawable } from "./drawables";
import { CanvasRenderer } from "./renderer";
import { V2 } from "./v2";

class UILabel {
    constructor(
        public text: string,
        public pos: V2,
        public color: string = "#fff",
        public font: string = "16px monospace"
    ) { }

    draw(renderer: CanvasRenderer, margin: number = 2) {
        const safePos = new V2(this.pos.x + margin, this.pos.y + margin);
        renderer.drawText(this.text, safePos, this.color, this.font, "left", "top");
    }
}

export class DebugUI extends Drawable {
    public elements: UILabel[] = [];
    private lastTime: number = performance.now();
    public visible: boolean = true;
    public ignoreViewport = true; // important
    private static registry: DebugUI[] = [];
    private readonly margin: number;

    constructor(pos: V2 = new V2(10, 10), margin: number = 2) {
        super("white", false, null);
        this.margin = margin;
        const fps = new UILabel("FPS: 0", pos);
        this.elements.push(fps);

        DebugUI.registry.push(this);
    }

    update() {
        const now = performance.now();
        const dt = now - this.lastTime;
        const fps = dt > 0 ? Math.round(1000 / dt) : 0;
        this.elements[0].text = `FPS: ${fps}`;
        this.lastTime = now;
    }

    draw(app: CanvasRenderer) {
        if (!this.visible) return;
        for (const el of this.elements) {
            el.draw(app, this.margin);
        }
    }

    static updateAll() {
        for (const ui of DebugUI.registry) ui.update();
    }
}
