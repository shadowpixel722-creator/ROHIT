/**
 * Live check of Mistake Map question generation on a made-up note (no student data).
 *   npx tsx --env-file=.env scripts/try-mcq.mts
 */
import { generateMcqs, STUDY_MODEL } from "../src/lib/ai-study.ts";

const text = `## Motion
- **Distance** is the total length of the path travelled. It has only size (a scalar).
- **Displacement** is the shortest straight-line distance from the start to the end, with a direction (a vector). It can be zero even if you moved.
- **Speed** = distance / time. **Velocity** = displacement / time, so it has a direction.
- Uniform motion: equal distances in equal intervals of time.
- Acceleration = change in velocity / time. An object moving in a circle at constant speed is accelerating because its direction changes.`;

const t0 = Date.now();
const out = await generateMcqs({ grade: "9", subject: "Science", chapter: "Motion", text, existing: ["Confuses distance with displacement"] });
console.log("NEW MISCONCEPTIONS:", out.misconceptions.map((m) => `${m.label} -> ${m.fix}`));
for (const q of out.questions) {
  console.log(`\nQ: ${q.stem}`);
  q.choices.forEach((c, i) => console.log(`  ${i === q.answerIndex ? "✓" : " "} ${c}${q.tags[i] ? `   [trap: ${q.tags[i]}]` : ""}`));
}
console.log(`\ndropped=${out.dropped} model=${STUDY_MODEL} time=${((Date.now() - t0) / 1000).toFixed(1)}s tokens in/out=${out.inputTokens}/${out.outputTokens} cost≈$${((out.inputTokens * 0.1 + out.outputTokens * 0.5) / 1_000_000).toFixed(5)}`);
