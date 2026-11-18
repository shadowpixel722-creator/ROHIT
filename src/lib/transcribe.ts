import "server-only";
import OpenAI from "openai";
import { aiEnabled, MODEL, provider, readPage as callModel } from "./ai-ocr";
import sharp from "sharp";
import { db } from "./db";
import { readUpload } from "./files";
import { cleanTranscript } from "./redact";

export { aiEnabled, provider };

/**
 * AI handwriting reading (OpenAI GPT-6 Luna).
 *
 * Privacy rules (agreed with the product owner):
 *  - Only pages of TEACHER-APPROVED notes are sent; the teacher has checked them for faces/names.
 *  - Only the page image (metadata already stripped on upload) and a fixed instruction are sent:
 *    no title, names, emails, user or class IDs.
 *  - `store: false` so OpenAI doesn't keep the response as application state. (OpenAI may keep
 *    abuse-monitoring logs for up to 30 days; API data is not used for training by default.)
 *  - Output is filtered for contact details before saving.
 */

const DAILY_LIMIT = Number(process.env.AI_DAILY_PAGE_LIMIT || 300);

async function pagesSentToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return db.aiUsage.count({ where: { kind: "PAGE", createdAt: { gte: start } } });
}

/** Marks a note's pages for reading. Only call for APPROVED notes. Skips pages that already have text. */
export async function queueNote(noteId: string, opts: { force?: boolean } = {}) {
  if (!aiEnabled()) return 0;
  const note = await db.note.findUnique({ where: { id: noteId }, select: { status: true } });
  if (note?.status !== "APPROVED") return 0;
  const res = await db.noteImage.updateMany({
    where: { noteId, convert: true, ...(opts.force ? { OR: [{ transcriptSource: null }, { transcriptSource: "AI" }] } : { transcriptStatus: { in: ["NONE", "FAILED"] } }) },
    data: { transcriptStatus: "QUEUED", transcriptError: null },
  });
  kickQueue();
  return res.count;
}

/** Queue one page (teacher's per-page "Convert" button). */
export async function queuePage(imageId: string) {
  if (!aiEnabled()) return;
  await db.noteImage.update({ where: { id: imageId }, data: { transcriptStatus: "QUEUED", transcriptError: null } });
  kickQueue();
}

let running: Promise<void> | null = null;

/** Processes queued pages one at a time in the background (single worker per server). */
export function kickQueue() {
  if (!aiEnabled() || running) return;
  running = (async () => {
    try {
      for (;;) {
        const img = await db.noteImage.findFirst({
          where: { transcriptStatus: "QUEUED", convert: true, note: { status: "APPROVED" } },
          orderBy: { id: "asc" },
          select: { id: true, filePath: true, note: { select: { classroomId: true } } },
        });
        if (!img) break;
        if ((await pagesSentToday()) >= DAILY_LIMIT) break; // stays QUEUED; resumes tomorrow
        await db.noteImage.update({ where: { id: img.id }, data: { transcriptStatus: "PROCESSING" } });
        try {
          // Smaller JPEG for the request: plenty for handwriting, and cheaper.
          const jpeg = await sharp(await readUpload(img.filePath)).resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
          const out = await callModel(jpeg);
          await db.aiUsage.create({ data: { classroomId: img.note.classroomId, imageId: img.id, model: provider() === "fake" ? "fake" : MODEL, inputTokens: out.inputTokens, outputTokens: out.outputTokens } });
          // Don't overwrite text a teacher typed while this was running.
          await db.noteImage.updateMany({
            where: { id: img.id, transcriptStatus: "PROCESSING" },
            data: { transcript: cleanTranscript(out.text), transcriptStatus: "DONE", transcriptSource: "AI", transcriptError: null, transcribedAt: new Date() },
          });
        } catch (e) {
          console.error("transcription failed", img.id, e instanceof Error ? e.message : e);
          await db.noteImage.updateMany({
            where: { id: img.id, transcriptStatus: "PROCESSING" },
            data: { transcriptStatus: "FAILED", transcriptError: e instanceof OpenAI.APIError ? `AI service error (${e.status ?? "network"})` : "Couldn't read this page" },
          });
        }
      }
    } finally {
      running = null;
    }
  })();
  running.catch(() => {});
}

/**
 * Catch-up: approved pages that should be converted but never were (e.g. approved before AI was
 * switched on) are queued. Teacher-typed text and pages switched off are left alone.
 */
export async function backfill() {
  if (!aiEnabled()) return 0;
  const res = await db.noteImage.updateMany({
    where: { convert: true, transcriptStatus: "NONE", transcriptSource: null, note: { status: "APPROVED" } },
    data: { transcriptStatus: "QUEUED", transcriptError: null },
  });
  kickQueue();
  return res.count;
}

/** Pages left PROCESSING by a server restart go back to the queue. */
export async function recoverStuck() {
  await db.noteImage.updateMany({ where: { transcriptStatus: "PROCESSING", transcribedAt: null }, data: { transcriptStatus: "QUEUED" } });
}

export async function usageSummary(classroomId: string) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [rows, pages, searches] = await Promise.all([
    db.aiUsage.aggregate({ where: { classroomId, createdAt: { gte: since } }, _sum: { inputTokens: true, outputTokens: true } }),
    db.aiUsage.count({ where: { classroomId, kind: "PAGE", createdAt: { gte: since } } }),
    db.aiUsage.count({ where: { classroomId, kind: "SEARCH", createdAt: { gte: since } } }),
  ]);
  const input = rows._sum.inputTokens ?? 0;
  const output = rows._sum.outputTokens ?? 0;
  // GPT-6 Luna list price: $0.10 / 1M input, $0.50 / 1M output (OpenAI model page, 2026-11-04). Includes study material.
  // Web search: $10 per 1,000 calls (OpenAI pricing page, 2026-11-12); its content tokens are already in the token sums.
  return { pages, input, output, usd: (input * 0.1 + output * 0.5) / 1_000_000 + searches * 0.01 };
}
