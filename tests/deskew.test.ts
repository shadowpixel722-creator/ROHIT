import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { deskew, estimateDeskew } from "@/lib/deskew";

/** A ruled notebook page with lines of "writing" (dark dashes). */
async function page() {
  const lines = Array.from({ length: 22 }, (_, i) => {
    const y = 90 + i * 45;
    const ruling = `<line x1="40" x2="860" y1="${y}" y2="${y}" stroke="#7aa6d6" stroke-width="2"/>`;
    const words = Array.from({ length: 9 }, (_, j) => `<rect x="${70 + j * 88}" y="${y - 22}" width="${50 + ((i * 7 + j * 13) % 30)}" height="12" fill="#1b2a49"/>`).join("");
    return ruling + words;
  }).join("");
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1150"><rect width="100%" height="100%" fill="#fffdf6"/>${lines}</svg>`)).png().toBuffer();
}
const tilt = async (deg: number) => sharp(await page()).rotate(deg, { background: "#fffdf6" }).png().toBuffer();

describe("deskew", () => {
  it("leaves a level page alone", async () => {
    expect(await estimateDeskew(await page())).toBe(0);
  });
  it.each([4, -6, 9])("levels a page tilted by %d°", async (deg) => {
    const angle = await estimateDeskew(await tilt(deg));
    expect(Math.abs(angle + deg)).toBeLessThanOrEqual(0.6);
    const { data } = await deskew(await tilt(deg));
    expect(Math.abs(await estimateDeskew(data))).toBeLessThanOrEqual(0.6);
  });
  it("does nothing for a blank page", async () => {
    const blank = await sharp({ create: { width: 400, height: 500, channels: 3, background: "#ffffff" } }).png().toBuffer();
    expect(await estimateDeskew(blank)).toBe(0);
  });
});
