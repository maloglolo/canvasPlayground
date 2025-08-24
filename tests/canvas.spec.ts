import { test, expect } from "@playwright/test";

const pageUrl = "/index.html";

// selectors for your DOM
const WRAPPERS = [
  "#signalWrapper",
  "#unitWrapper",
  "#triforceWrapper",
  "#scatterWrapper",
];

test.describe("Canvas graph app", () => {
  test("page loads with no console errors", async ({ page }) => {
    const errors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(String(err)));

    await page.goto(pageUrl);

    // Basic sanity: wrappers exist
    for (const sel of WRAPPERS) {
      await expect(page.locator(sel)).toHaveCount(1);
      await expect(page.locator(`${sel} canvas`)).toHaveCount(1);
    }

    // Give your rendering loop a tick to draw
    await page.waitForTimeout(150);

    expect(errors, "console.error messages").toEqual([]);
    expect(pageErrors, "page errors").toEqual([]);
  });

  test("each canvas draws non-background pixels", async ({ page }) => {
    await page.goto(pageUrl);
    await page.waitForTimeout(200);

    for (const sel of WRAPPERS) {
      const nonBgCount = await countNonBackgroundPixels(page, `${sel} canvas`, "#131313");
      expect(nonBgCount, `${sel} should have drawn something`).toBeGreaterThan(500); // heuristic
    }
  });

  test("resize triggers canvas resize and redraw", async ({ page }) => {
    await page.goto(pageUrl);
    await page.waitForTimeout(100);

    // record initial sizes
    const beforeSizes = await getCanvasSizes(page, WRAPPERS);

    // Resize viewport
    await page.setViewportSize({ width: 800, height: 500 });
    await page.waitForTimeout(150);

    const afterSizes = await getCanvasSizes(page, WRAPPERS);

    for (let i = 0; i < WRAPPERS.length; i++) {
      const b = beforeSizes[i];
      const a = afterSizes[i];

      // size should change in at least one dimension
      expect(
        a.width !== b.width || a.height !== b.height,
        `${WRAPPERS[i]} canvas size should react to viewport change`
      ).toBeTruthy();

      // still drawing after resize
      const nonBgCount = await countNonBackgroundPixels(page, `${WRAPPERS[i]} canvas`, "#131313");
      expect(nonBgCount).toBeGreaterThan(500);
    }
  });

  test("optional: visual snapshot (stable baseline)", async ({ page }) => {
    await page.goto(pageUrl);
    await page.waitForTimeout(200);

    // hide animations/variance if any (not strictly needed here)
    await page.evaluate(() => {
      document.body.style.animation = "none";
      document.body.style.transition = "none";
    });

    await expect(page).toHaveScreenshot("full-page.png", {
      fullPage: true,
      // give a little slack for anti-aliasing
      maxDiffPixelRatio: 0.02,
    });
  });
});

/**
 * Count non-background pixels in a canvas by direct pixel access.
 * Background hex -> RGBA compare with tolerance.
 */
async function countNonBackgroundPixels(page, canvasSelector: string, bgHex: string) {
  return await page.evaluate(
    ([sel, bg]) => {
      function hexToRGBA(hex: string) {
        hex = hex.replace("#", "");
        if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return [r, g, b, 255];
      }

      const tol = 2; // allow tiny numerical differences
      const [br, bgc, bb, ba] = hexToRGBA(bg);
      const can = document.querySelector(sel) as HTMLCanvasElement | null;
      if (!can) return 0;
      const ctx = can.getContext("2d");
      if (!ctx) return 0;
      const { width, height } = can;
      const img = ctx.getImageData(0, 0, width, height).data;

      let count = 0;
      for (let i = 0; i < img.length; i += 4) {
        const r = img[i], g = img[i + 1], b = img[i + 2], a = img[i + 3];
        const isBg =
          Math.abs(r - br) <= tol &&
          Math.abs(g - bgc) <= tol &&
          Math.abs(b - bb) <= tol &&
          Math.abs(a - ba) <= tol;

        if (!isBg) count++;
      }
      return count;
    },
    [canvasSelector, bgHex]
  );
}

async function getCanvasSizes(page, wrappers: string[]) {
  return await page.evaluate((sels: string[]) => {
    return sels.map((sel) => {
      const c = document.querySelector(`${sel} canvas`) as HTMLCanvasElement | null;
      return { width: c?.width ?? 0, height: c?.height ?? 0 };
    });
  }, wrappers);
}
