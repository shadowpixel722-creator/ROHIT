import "server-only";
import { UserError } from "./action";
import { AttachmentError, checkAttachment } from "./attachment-check";
import { removeUploads, saveClassFile } from "./files";

/** Shared by note and exam-pattern attachments. */
export const attachmentsFrom = (form: FormData) => form.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);

/** Checks every attachment by content first (nothing is saved if any is refused), then saves them. */
export async function saveAttachments(classroomId: string, files: File[]) {
  const checked = await Promise.all(files.map(async (f) => {
    const bytes = new Uint8Array(await f.arrayBuffer());
    try {
      return { bytes, kind: checkAttachment(bytes, f.name || "attachment") };
    } catch (e) {
      if (e instanceof AttachmentError) throw new UserError(e.message);
      throw e;
    }
  }));
  const saved: { fileName: string; mimeType: string; size: number; filePath: string }[] = [];
  try {
    for (const c of checked) saved.push({ fileName: c.kind.fileName, mimeType: c.kind.mime, size: c.bytes.length, filePath: await saveClassFile(classroomId, c.bytes, c.kind.ext) });
    return saved;
  } catch (e) {
    await removeUploads(saved.map((a) => a.filePath));
    throw e;
  }
}
