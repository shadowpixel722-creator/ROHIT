/**
 * Accuracy and cost check on sample pages BEFORE turning AI on for a class.
 *   OPENAI_API_KEY=sk-... npx tsx scripts/try-transcribe.mts ./samples
 * Reads every .jpg/.jpeg/.png/.webp in the folder, prints the text and the measured cost.
 * Costs real money (about $0.001 per page with gpt-6-luna). Use photos without names or faces.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { MODEL, provider, readPage } from "../src/lib/ai-ocr";
import { cleanTranscript } from "../src/lib/redact";
import { deskew } from "../src/lib/deskew";

const dir = process.argv[2];
if (!dir) throw new Error("Usage: npx tsx scripts/try-transcribe.mts <folder-of-photos>");
if (provider() !== "openai") throw new Error("Set OPENAI_API_KEY first.");

const files = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
let inTok = 0;
let outTok = 0;
for (const f of files) {
  // Same preparation as the app: upright, metadata stripped, max 1600 px JPEG.
  const { data: level, angle } = await deskew(await sharp(readFileSync(path.join(dir, f))).rotate().png().toBuffer());
  if (angle) console.log(`(${f}: straightened by ${angle}°)`);
  const jpeg = await sharp(level).resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  const t0 = Date.now();
  const r = await readPage(jpeg);
  inTok += r.inputTokens;
  outTok += r.outputTokens;
  console.log(`\n===== ${f}  (${((Date.now() - t0) / 1000).toFixed(1)} s, ${r.inputTokens} in / ${r.outputTokens} out tokens)\n${cleanTranscript(r.text)}`);
}
const usd = (inTok * 0.1 + outTok * 0.5) / 1_000_000;
console.log(`\n${files.length} page(s) with ${MODEL}: ${inTok} input + ${outTok} output tokens ≈ $${usd.toFixed(4)} (≈ $${(usd / Math.max(1, files.length)).toFixed(4)} per page)`);
