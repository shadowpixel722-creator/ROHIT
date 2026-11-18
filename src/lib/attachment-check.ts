/**
 * Which attachments a note may carry, checked by CONTENT (never trusting the name or the browser's type),
 * plus safe file names. Pure functions, so they're unit-tested.
 */

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = ".pdf,.docx,.pptx,.xlsx,.txt";
export const ATTACHMENT_KINDS = "PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx) or text (.txt)";

type Kind = { ext: string; mime: string; label: string };
const KINDS: Record<string, Kind> = {
  pdf: { ext: "pdf", mime: "application/pdf", label: "PDF" },
  docx: { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Word" },
  pptx: { ext: "pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", label: "PowerPoint" },
  xlsx: { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "Excel" },
  txt: { ext: "txt", mime: "text/plain; charset=utf-8", label: "Text" },
};

export const kindLabel = (fileName: string) => KINDS[extOf(fileName)]?.label ?? "File";

export class AttachmentError extends Error {}

export const extOf = (name: string) => (name.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1] ?? "");

const startsWith = (b: Uint8Array, s: string) => s.split("").every((c, i) => b[i] === c.charCodeAt(0));
/** Byte search for an ASCII marker (works in the browser and on the server). */
function contains(b: Uint8Array, s: string) {
  const first = s.charCodeAt(0);
  outer: for (let i = b.indexOf(first); i !== -1 && i <= b.length - s.length; i = b.indexOf(first, i + 1)) {
    for (let j = 1; j < s.length; j++) if (b[i + j] !== s.charCodeAt(j)) continue outer;
    return true;
  }
  return false;
}

/** Office files are zip packages with a known folder inside (word/, ppt/, xl/). */
function isOffice(b: Uint8Array, folder: string) {
  return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 && contains(b, "[Content_Types].xml") && contains(b, folder);
}

/** Plain text: valid UTF-8 with no NUL bytes (binary files nearly always contain them). */
function isText(b: Uint8Array) {
  if (b.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(b);
    return true;
  } catch {
    return false;
  }
}

const CHECKS: Record<string, (b: Uint8Array) => boolean> = {
  pdf: (b) => startsWith(b, "%PDF-"),
  docx: (b) => isOffice(b, "word/"),
  pptx: (b) => isOffice(b, "ppt/"),
  xlsx: (b) => isOffice(b, "xl/"),
  txt: isText,
};

/** A file name that's safe to store and to send back in a download header. Keeps the real extension. */
export function safeFileName(name: string, ext: string) {
  const base = (name.split(/[\\/]/).pop() ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "") // control characters and characters filesystems or headers dislike
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.[a-z0-9]{1,8}$/i, "")
    .slice(0, 100) || "attachment";
  return `${base}.${ext}`;
}

/** Throws a clear message if the file isn't allowed; otherwise says what it is. */
export function checkAttachment(bytes: Uint8Array, name: string): Kind & { fileName: string } {
  const ext = extOf(name);
  const kind = KINDS[ext];
  if (!kind) throw new AttachmentError(`“${name}” can't be attached. Use ${ATTACHMENT_KINDS}.`);
  if (bytes.length === 0) throw new AttachmentError(`“${name}” is empty.`);
  if (bytes.length > MAX_ATTACHMENT_BYTES) throw new AttachmentError(`“${name}” is larger than 10 MB.`);
  if (!CHECKS[ext](bytes)) throw new AttachmentError(`“${name}” isn't really a ${kind.label} file, so it wasn't attached.`);
  return { ...kind, fileName: safeFileName(name, ext) };
}

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
