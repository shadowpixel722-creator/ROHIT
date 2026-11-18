/**
 * Asks the AI for flashcards and written-answer questions from one note's text, and to mark a
 * student's written answers (no Next.js imports, so the try-out script can use it). Same provider
 * switch as handwriting reading: OPENAI_API_KEY unset means off, TRANSCRIBE_PROVIDER=fake runs
 * everything locally for tests and never calls the network.
 */
import type { ResponseInput } from "openai/resources/responses/responses";
import { openai, provider } from "./ai-ocr";
import type { Grade } from "./quiz";
import { buildMcqPrompt, parseMcqOutput } from "./mcq-schema";
import { buildExplainPrompt, parseExplanation } from "./explain-schema";
import { buildModelPrompt, MODEL3D_JSON_SCHEMA, parseScene } from "./model3d-schema";
import { buildMarkPrompt, buildSheetPrompt, MARKS_SCHEMA, parseMarks, parseSheet, SHEET_SCHEMA, type HwQuestion } from "./homework";
import { ASK_SCHEMA, buildAskPrompt, buildTeachPrompt, parseAsk, parseTeach, TEACH_SCHEMA, type NoteSnippet } from "./tutor";
import { buildPatternPrompt, parsePatternOutput, PRESETS } from "./exam-schema";
import { buildGradePrompt, buildStudyPrompt, buildVerifyPrompt, parseGradeOutput, parseStudyOutput, StudyOutputError, type GradeItem } from "./study-schema";

export const STUDY_MODEL = process.env.OPENAI_STUDY_MODEL || process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-6-luna";

const text = { type: "string" } as const;
const STUDY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["flashcards", "questions"],
  properties: {
    flashcards: { type: "array", items: { type: "object", additionalProperties: false, required: ["front", "back"], properties: { front: text, back: text } } },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "answer", "keyPoints"],
        properties: { question: text, answer: text, keyPoints: { type: "array", items: text } },
      },
    },
  },
} as const;

const GRADE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "verdict", "feedback"],
        properties: { index: { type: "integer" }, verdict: { type: "string", enum: ["CORRECT", "PARTLY", "INCORRECT"] }, feedback: text },
      },
    },
  },
} as const;

const FAKE = {
  flashcards: [
    { front: "What is coal?", back: "A black fossil fuel formed from plants buried for millions of years." },
    { front: "Name one use of coal.", back: "It is burned to make electricity." },
    { front: "Why is coal called a fossil fuel?", back: "It was formed from the remains of ancient plants." },
  ],
  questions: [
    { question: "Explain how coal was formed.", answer: "Coal formed from plants that were buried under the earth for millions of years.", keyPoints: ["plants buried", "millions of years"] },
    { question: "Why is coal called a non-renewable resource?", answer: "It took millions of years to form, so it will finish one day if we keep using it.", keyPoints: ["takes millions of years", "will finish"] },
    { question: "Describe one common use of coal.", answer: "Coal is burned in power plants to produce electricity.", keyPoints: ["burned", "electricity"] },
  ],
};

export type StudyRequest = { grade: string | null; subject: string; chapter: string; text: string; counts?: { flashcards?: number; questions?: number } };

/** Runs a JSON-schema request, retrying once if the reply isn't usable; carries the tokens spent on a final failure. */
async function ask<T>(instructions: string, input: string | ResponseInput, name: string, schema: object, parse: (raw: string) => T, maxOutput: number, opts: { webSearches?: number } = {}) {
  let inputTokens = 0;
  let outputTokens = 0;
  let searches = 0;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await openai().responses.create({
      model: STUDY_MODEL,
      instructions,
      input,
      text: { format: { type: "json_schema", name, schema: schema as Record<string, unknown>, strict: true } },
      reasoning: { effort: "low" },
      max_output_tokens: maxOutput,
      store: false,
      // A few quick searches at most, only for the second look at answers about to be marked down.
      ...(opts.webSearches ? { tools: [{ type: "web_search" as const, search_context_size: "low" as const }], max_tool_calls: opts.webSearches } : {}),
    });
    searches += response.output.filter((o) => o.type === "web_search_call").length;
    inputTokens += response.usage?.input_tokens ?? 0;
    outputTokens += response.usage?.output_tokens ?? 0;
    try {
      if (response.status === "incomplete") throw new StudyOutputError("The AI stopped early.");
      return { ...parse(response.output_text ?? ""), inputTokens, outputTokens, searches };
    } catch (e) {
      if (!(e instanceof StudyOutputError)) throw e;
      lastError = e;
    }
  }
  // Carry the tokens already spent, so the caller can still count the cost of a failed try.
  throw Object.assign(lastError instanceof Error ? lastError : new Error("The AI request failed"), { inputTokens, outputTokens, searches });
}

export async function generateStudyMaterial(req: StudyRequest) {
  const { instructions, input } = buildStudyPrompt(req);
  if (provider() === "fake") return { ...parseStudyOutput(JSON.stringify(FAKE)), inputTokens: 0, outputTokens: 0 };
  return ask(instructions, input, "study_material", STUDY_SCHEMA, parseStudyOutput, 6000);
}

/** The fake marker (tests only): a real-looking answer that shares a word with a key point is correct. */
function fakeGrade(item: GradeItem): Grade {
  const answer = item.studentAnswer.toLowerCase();
  if (answer.replace(/\s+/g, " ").trim().length < 12) return { verdict: "INCORRECT", feedback: "Try to explain it in a full sentence." };
  const hits = item.keyPoints.filter((k) => k.toLowerCase().split(/\W+/).some((w) => w.length >= 4 && answer.includes(w))).length;
  if (hits >= Math.min(2, item.keyPoints.length)) return { verdict: "CORRECT", feedback: "Well done. You covered the main ideas." };
  if (hits === 1) return { verdict: "PARTLY", feedback: "You have part of it. Check the notes for what is missing." };
  return { verdict: "INCORRECT", feedback: "That isn't what the notes say. Read them again." };
}

const RANK: Record<Grade["verdict"], number> = { SKIPPED: 0, INCORRECT: 1, PARTLY: 2, CORRECT: 3 };
/** Most web searches for one quiz's second look (about $0.01 each). */
export const MAX_SEARCHES_PER_QUIZ = 3;

/**
 * Marks written answers (already filtered: none are blank). Returns one grade per item, in order.
 * 1. Mark everything in one request, using the notes and general subject knowledge.
 * 2. Answers about to be marked down get a second look that may do a quick web search; it can only
 *    raise a mark. If the second look fails, the first marks stand, so a submission never fails because of it.
 */
export async function gradeAnswers(items: GradeItem[]) {
  if (items.length === 0) return { grades: [] as Grade[], inputTokens: 0, outputTokens: 0, searches: 0 };
  if (provider() === "fake") return { grades: items.map(fakeGrade), inputTokens: 0, outputTokens: 0, searches: 0 };
  const { instructions, input } = buildGradePrompt(items);
  const first = await ask(instructions, input, "marks", GRADE_SCHEMA, (raw) => ({ grades: parseGradeOutput(raw, items.length) }), 3000);
  const grades = [...first.grades];
  let { inputTokens, outputTokens } = first;
  let searches = 0;

  const doubtful = grades.flatMap((g, i) => (g.verdict === "CORRECT" ? [] : [i]));
  if (doubtful.length > 0) {
    try {
      const second = await secondLook(doubtful.map((i) => ({ ...items[i], verdict: grades[i].verdict, feedback: grades[i].feedback })));
      inputTokens += second.inputTokens;
      outputTokens += second.outputTokens;
      searches = second.searches;
      second.grades.forEach((g, j) => {
        const i = doubtful[j];
        if (RANK[g.verdict] > RANK[grades[i].verdict]) grades[i] = g; // never lowers a mark
      });
    } catch (e) {
      const spent = e as { inputTokens?: number; outputTokens?: number; searches?: number };
      inputTokens += spent.inputTokens ?? 0;
      outputTokens += spent.outputTokens ?? 0;
      searches += spent.searches ?? 0;
      console.error("second look failed; keeping first marks", e instanceof Error ? e.message : e);
    }
  }
  return { grades, inputTokens, outputTokens, searches };
}

/** The second look on its own (also used by the live check script). May do up to 3 quick web searches. */
export async function secondLook(items: (GradeItem & { verdict: string; feedback: string })[]) {
  const v = buildVerifyPrompt(items);
  return ask(v.instructions, v.input, "checked_marks", GRADE_SCHEMA, (raw) => ({ grades: parseGradeOutput(raw, items.length) }), 4000, { webSearches: MAX_SEARCHES_PER_QUIZ });
}

/* ------------------------------------------------------------------ Mistake Map questions */

const MCQ_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["misconceptions", "questions"],
  properties: {
    misconceptions: { type: "array", items: { type: "object", additionalProperties: false, required: ["label", "fix"], properties: { label: text, fix: text } } },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["stem", "choices", "answerIndex", "explanation"],
        properties: {
          stem: text,
          choices: { type: "array", items: { type: "object", additionalProperties: false, required: ["text", "misconception"], properties: { text, misconception: text } } },
          answerIndex: { type: "integer" },
          explanation: text,
        },
      },
    },
  },
} as const;

const FAKE_MCQ = {
  misconceptions: [
    { label: "Thinks coal is renewable", fix: "Coal took millions of years to form, so once used it is gone. It is non-renewable." },
    { label: "Thinks coal comes from rocks", fix: "Coal formed from the remains of ancient plants buried under the earth." },
  ],
  questions: [
    {
      stem: "Is coal a renewable resource?",
      choices: [
        { text: "Yes, new coal forms every year", misconception: "Thinks coal is renewable" },
        { text: "No, it took millions of years to form", misconception: "" },
        { text: "Yes, because plants keep growing", misconception: "Thinks coal is renewable" },
        { text: "It is melted rock, so it never runs out", misconception: "Thinks coal comes from rocks" },
      ],
      answerIndex: 1,
      explanation: "Coal formed over millions of years, so it cannot be replaced quickly.",
    },
    {
      stem: "What was coal formed from?",
      choices: [
        { text: "Rocks melted by the earth's heat", misconception: "Thinks coal comes from rocks" },
        { text: "Remains of ancient plants", misconception: "" },
        { text: "Plants that grew last year", misconception: "Thinks coal is renewable" },
        { text: "Sand pressed together", misconception: "Thinks coal comes from rocks" },
      ],
      answerIndex: 1,
      explanation: "Coal is the buried remains of ancient plants.",
    },
    {
      stem: "Why should we use coal carefully?",
      choices: [
        { text: "It will run out one day", misconception: "" },
        { text: "It grows back too slowly in a year", misconception: "Thinks coal is renewable" },
        { text: "Rocks are hard to dig", misconception: "Thinks coal comes from rocks" },
        { text: "We can always make more", misconception: "Thinks coal is renewable" },
      ],
      answerIndex: 0,
      explanation: "Coal is non-renewable, so it will run out.",
    },
  ],
};

export type McqRequest = StudyRequest & { existing: string[]; target?: { label: string; fix: string } | null; count?: number };

/** Multiple-choice questions whose wrong options are tagged with misconceptions (see mcq-schema.ts for what is sent). */
export async function generateMcqs(req: McqRequest) {
  const { instructions, input } = buildMcqPrompt(req);
  if (provider() === "fake") return { ...parseMcqOutput(JSON.stringify(FAKE_MCQ), req.existing), inputTokens: 0, outputTokens: 0, searches: 0 };
  return ask(instructions, input, "mistake_map_questions", MCQ_SCHEMA, (raw) => parseMcqOutput(raw, req.existing), 8000);
}

/* ------------------------------------------------------------------ Explain tab */

const EXPLAIN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "keyPoints", "highlights", "sections"],
  properties: {
    summary: text,
    keyPoints: { type: "array", items: text },
    highlights: { type: "array", items: text },
    sections: { type: "array", items: { type: "object", additionalProperties: false, required: ["heading", "explanation"], properties: { heading: text, explanation: text } } },
  },
} as const;

const FAKE_EXPLANATION = {
  summary: "This lesson explains what coal is, how it formed and why we must use it carefully. Coal is a fossil fuel that took millions of years to form.",
  keyPoints: ["Coal is a fossil fuel", "It formed from the remains of ancient plants", "It took millions of years to form", "It is non-renewable, so use it carefully"],
  highlights: ["fossil fuel", "remains of ancient plants", "millions of years", "non-renewable"],
  sections: [
    { heading: "What coal is", explanation: "Coal is a black fuel we dig out of the ground. It is called a fossil fuel because it comes from things that lived long ago." },
    { heading: "Why we must save it", explanation: "Coal takes millions of years to form, so once we burn it, it is gone for a very long time. That is why it is non-renewable." },
  ],
};

/** Explains one lesson: summary, key points, exact phrases to highlight, and section-by-section explanations. */
export async function explainLesson(req: { grade: string | null; subject: string; chapter: string; title: string; text: string }) {
  const { instructions, input } = buildExplainPrompt(req);
  if (provider() === "fake") return { explanation: parseExplanation(JSON.stringify(FAKE_EXPLANATION), req.text), inputTokens: 0, outputTokens: 0 };
  const out = await ask(instructions, input, "lesson_explanation", EXPLAIN_SCHEMA, (raw) => ({ explanation: parseExplanation(raw, req.text) }), 6000);
  return { explanation: out.explanation, inputTokens: out.inputTokens, outputTokens: out.outputTokens };
}

/* ------------------------------------------------------------------ Explain tab: 3D models */

const FAKE_SCENE = {
  title: "How coal forms",
  intro: "Layers of buried plants are pressed and heated over millions of years until they become coal.",
  objects: [
    { id: "plants", shape: "box", label: "Ancient plants", info: "Forests that grew millions of years ago.", color: "#5aa469", position: [0, 2, 0], size: [5, 0.6, 3], rotation: [0, 0, 0], opacity: 1, to: null, motion: { kind: "none", center: null, speed: 1 }, hideLabel: false },
    { id: "soil", shape: "box", label: "Soil and rock", info: "Layers that buried the dead plants.", color: "#a0785a", position: [0, 0.8, 0], size: [5, 1.2, 3], rotation: [0, 0, 0], opacity: 1, to: null, motion: { kind: "none", center: null, speed: 1 }, hideLabel: false },
    { id: "coal", shape: "box", label: "Coal seam", info: "Coal is a fossil fuel formed from the remains of ancient plants.", color: "#2b2b2b", position: [0, -0.6, 0], size: [5, 0.8, 3], rotation: [0, 0, 0], opacity: 1, to: null, motion: { kind: "none", center: null, speed: 1 }, hideLabel: false },
    { id: "pressure", shape: "arrow", label: "Heat and pressure", info: "Heat and pressure over millions of years turn the plants into coal.", color: "#d1544f", position: [3.5, 3, 0], to: [3.5, -0.4, 0], size: [0.08, 0, 0], rotation: [0, 0, 0], opacity: 1, motion: { kind: "none", center: null, speed: 1 }, hideLabel: false },
  ],
  steps: [
    { caption: "Long ago, forests of plants grew here.", focus: ["plants"] },
    { caption: "They were buried under soil and rock, then pressed and heated.", focus: ["soil", "pressure"] },
    { caption: "Over millions of years they became coal, a non-renewable fossil fuel.", focus: ["coal"] },
  ],
};

/** Builds an interactive 3D scene for one lesson (see model3d-schema.ts for what is sent and how the reply is checked). */
export async function buildLessonModel(req: { grade: string | null; subject: string; chapter: string; title: string; text: string }) {
  const { instructions, input } = buildModelPrompt(req);
  if (provider() === "fake") return { scene: parseScene(FAKE_SCENE), inputTokens: 0, outputTokens: 0 };
  const out = await ask(instructions, input, "lesson_3d_model", MODEL3D_JSON_SCHEMA, (raw) => ({ scene: parseScene(raw) }), 8000);
  return { scene: out.scene, inputTokens: out.inputTokens, outputTokens: out.outputTokens };
}

/* ------------------------------------------------------------------ exam patterns */

const PATTERN_SCHEMA = {
  type: "object", additionalProperties: false, required: ["name", "durationMinutes", "instructions", "sections"],
  properties: {
    name: text, durationMinutes: { type: "integer" }, instructions: text,
    sections: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "type", "count", "marks", "note"],
      properties: { name: text, type: { type: "string", enum: ["mcq", "fill_blank", "very_short", "short", "long", "case_based"] }, count: { type: "integer" }, marks: { type: "number" }, note: text } } },
  },
} as const;

/** Turns a teacher's description of their school's exam pattern into sections to check and edit. */
export async function readPattern(description: string) {
  const { instructions, input } = buildPatternPrompt(description);
  if (provider() === "fake") return { pattern: parsePatternOutput(JSON.stringify(PRESETS[0])), inputTokens: 0, outputTokens: 0 };
  const out = await ask(instructions, input, "exam_pattern", PATTERN_SCHEMA, (raw) => ({ pattern: parsePatternOutput(raw) }), 3000);
  return { pattern: out.pattern, inputTokens: out.inputTokens, outputTokens: out.outputTokens };
}

/* ------------------------------------------------------------------ the guarded AI tutor */

/** Answers a student's doubt from the class notes (and a photo of the question, metadata already stripped). See tutor.ts for what is sent. */
export async function askTutor(req: { grade: string | null; subject: string | null; question: string; notes: NoteSnippet[]; image?: Buffer | null }) {
  const { instructions, input } = buildAskPrompt({ ...req, hasImage: !!req.image });
  if (provider() === "fake") {
    const answer = req.notes.length ? `From your notes: ${req.notes[0].text.split(/(?<=\.)\s/)[0]} Try explaining it back in your own words.` : "Your class notes don't cover this yet, so ask your teacher too. In short: break the question into small steps and try the first one.";
    return { reply: parseAsk(JSON.stringify({ answer: req.image ? `I can see your picture. ${answer}` : answer, fromNotes: req.notes.length > 0 })), inputTokens: 0, outputTokens: 0 };
  }
  const content: string | ResponseInput = req.image
    ? [{ role: "user", content: [{ type: "input_text", text: input }, { type: "input_image", image_url: `data:image/jpeg;base64,${req.image.toString("base64")}`, detail: "high" }] }]
    : input;
  const out = await ask(instructions, content, "tutor_answer", ASK_SCHEMA, (raw) => ({ reply: parseAsk(raw) }), 1500);
  return { reply: out.reply, inputTokens: out.inputTokens, outputTokens: out.outputTokens };
}

/** "Teach Knowa": judges the student's own explanation of a topic, kindly, against the class notes. */
export async function teachBack(req: { grade: string | null; topic: string; explanation: string; history: string[]; notes: NoteSnippet[] }) {
  const { instructions, input } = buildTeachPrompt(req);
  if (provider() === "fake") {
    const long = req.explanation.split(/\s+/).length >= 12;
    return { reply: parseTeach(JSON.stringify({ stars: long ? 4 : 2, say: long ? "I think I get it now! You explained the main idea clearly." : "Thanks! I understood a little, but I need more.", got: long ? ["You gave the main idea"] : [], missing: [{ gap: "An everyday example", fix: "Add an example from daily life to make it clear." }], question: "Can you give me an example?" })), inputTokens: 0, outputTokens: 0 };
  }
  const out = await ask(instructions, input, "teach_feedback", TEACH_SCHEMA, (raw) => ({ reply: parseTeach(raw) }), 1500);
  return { reply: out.reply, inputTokens: out.inputTokens, outputTokens: out.outputTokens };
}

/* ------------------------------------------------------------------ homework */

/** Writes a homework sheet for a chapter from its approved notes (see homework.ts for what is sent). */
export async function writeHomework(req: { grade: string | null; subject: string; chapter: string; notes: string; count: number; level: string; note: string }) {
  const { instructions, input } = buildSheetPrompt(req);
  if (provider() === "fake") {
    const qs = Array.from({ length: req.count }, (_, i) => ({ q: `Question ${i + 1}: explain one idea from ${req.chapter}.`, marks: (i % 3) + 1, answer: `A model answer for question ${i + 1}.` }));
    return { sheet: parseSheet(JSON.stringify({ title: `${req.chapter}: homework`, questions: qs }), req.count), inputTokens: 0, outputTokens: 0 };
  }
  const out = await ask(instructions, input, "homework_sheet", SHEET_SCHEMA, (raw) => ({ sheet: parseSheet(raw, req.count) }), 6000);
  return { sheet: out.sheet, inputTokens: out.inputTokens, outputTokens: out.outputTokens };
}

/** Suggests marks for a student's homework: typed answers, or photos of the paper (metadata already stripped). */
export async function markHomework(req: { grade: string | null; questions: HwQuestion[]; answers: string[] | null; photos?: Buffer[] }) {
  const { instructions, input } = buildMarkPrompt(req);
  if (provider() === "fake") {
    const answers = req.questions.map((q, i) => ({ n: i + 1, awarded: (req.answers?.[i] ?? (req.photos?.length ? "photo" : "")).trim().length >= 8 ? q.marks : 0, comment: "Checked." }));
    return { marks: parseMarks(JSON.stringify({ answers, feedback: "Good effort. Keep practising.", weak: ["Key terms"] }), req.questions), inputTokens: 0, outputTokens: 0 };
  }
  const content: string | ResponseInput = req.photos?.length
    ? [{ role: "user", content: [{ type: "input_text", text: input }, ...req.photos.map((p) => ({ type: "input_image" as const, image_url: `data:image/jpeg;base64,${p.toString("base64")}`, detail: "high" as const }))] }]
    : input;
  const out = await ask(instructions, content, "homework_marks", MARKS_SCHEMA, (raw) => ({ marks: parseMarks(raw, req.questions) }), 3000);
  return { marks: out.marks, inputTokens: out.inputTokens, outputTokens: out.outputTokens };
}
