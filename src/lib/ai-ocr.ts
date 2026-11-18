/**
 * The single place that talks to OpenAI for handwriting reading (no Next.js imports, so the
 * try-out script can use it too). Sends ONLY the page image and a fixed instruction.
 */
import OpenAI from "openai";

export const MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-6-luna";

export const INSTRUCTIONS = `You transcribe photos of school notebook pages (Class 6–12) into neatly formatted Markdown.
- Copy exactly what is written, in reading order. Do not add, explain, summarise or correct facts.
- Keep the original language and script (English, Hindi, Sanskrit, etc.).
- Formatting:
  - A page or section title (often centred or underlined) becomes "## Title"; smaller headings become "### Heading".
  - Numbered points become a numbered list ("1. ..."), bullets become "- ...", one item per line, even if written on one line.
  - Underlined or highlighted key terms become **bold**.
  - Definitions written as "Term = meaning" or "Term: meaning" stay on one line with the term in **bold**.
  - Tables become Markdown tables.
  - Leave a blank line between paragraphs. Do not wrap the whole answer in a code block.
- Maths and chemistry stay plain text: x^2 + 3x = 0, C + O2 -> CO2, H2O.
- For a diagram or drawing write one line in italics, e.g. *[Diagram: coal mine]*.
- Write [?] for any word you cannot read.
- If you see a person's name, phone number, address or email, write [removed] instead.
- If the page has no readable writing, reply with exactly: [No readable text]
Reply with the transcription only.`;

type Provider = "openai" | "fake" | "off";

export function provider(): Provider {
  // "fake" exists only for automated tests (set in playwright.config.ts); it never calls the network.
  if (process.env.TRANSCRIBE_PROVIDER === "fake") return "fake";
  return process.env.OPENAI_API_KEY ? "openai" : "off";
}
export const aiEnabled = () => provider() !== "off";

let client: OpenAI | null = null;
export const openai = () => (client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 2, timeout: 120_000 }));

export async function readPage(jpeg: Buffer): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  if (provider() === "fake") {
    return { text: `## Fake transcription\n\n- ${jpeg.length > 0 ? "page received" : "empty"}\n- **Coal** is a fossil fuel.\n\nCall 98765 43210.`, inputTokens: 0, outputTokens: 0 };
  }
  const response = await openai().responses.create({
    model: MODEL,
    instructions: INSTRUCTIONS,
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: "Transcribe this notebook page." },
        { type: "input_image", image_url: `data:image/jpeg;base64,${jpeg.toString("base64")}`, detail: "high" },
      ],
    }],
    reasoning: { effort: "low" },
    max_output_tokens: 4000,
    store: false,
  });
  if (response.status === "incomplete") throw new Error(`The AI stopped early (${response.incomplete_details?.reason ?? "unknown reason"}).`);
  return { text: response.output_text ?? "", inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 };
}

