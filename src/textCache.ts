

// ─────────────────────────────────────────────────────────────────────────────
// File: src/textCache.ts
// ─────────────────────────────────────────────────────────────────────────────

export class TextCache {
    private map = new Map<string, ImageData>();
    constructor(public capacity: number = 256) { this.capacity |= 0; }

    get(key: string): ImageData | null {
        const v = this.map.get(key);
        if (v) { this.map.delete(key); this.map.set(key, v); }
        return v ?? null;
    }

    set(key: string, value: ImageData): void {
        if (this.map.has(key)) this.map.delete(key);
        this.map.set(key, value);
        while (this.map.size > this.capacity) {
            const firstKey = this.map.keys().next().value;
            if (firstKey !== undefined) {
                this.map.delete(firstKey);
            }
        }
    }

    clear(): void { this.map.clear(); }
}
