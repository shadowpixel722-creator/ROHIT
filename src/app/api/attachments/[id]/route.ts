import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fileDownload } from "@/lib/download";
import { readUpload } from "@/lib/files";
import { getVisibleNote } from "@/lib/notes";

/**
 * Downloads a note's attachment, with the same rules as page photos: signed in, and allowed to see the note
 * (approved notes for the class; pending ones only for the author and teachers). Always a download, never shown
 * inside the app, so a file can't run anything here.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await params;
  const file = await db.noteAttachment.findUnique({ where: { id }, select: { filePath: true, noteId: true, fileName: true, mimeType: true } });
  // Same 404 for "doesn't exist" and "not allowed to see".
  if (!file || !(await getVisibleNote(user.id, file.noteId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let bytes: Buffer;
  try {
    bytes = await readUpload(file.filePath);
  } catch {
    return NextResponse.json({ error: "The file is missing from storage." }, { status: 410 });
  }
  return fileDownload(bytes, file.fileName, file.mimeType);
}
