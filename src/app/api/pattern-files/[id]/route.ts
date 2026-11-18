import { NextResponse } from "next/server";
import { getClassAccess } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fileDownload } from "@/lib/download";
import { readUpload } from "@/lib/files";

/** Downloads a file attached to an exam pattern: anyone in the class (patterns are visible to the whole class). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await params;
  const file = await db.examPatternAttachment.findUnique({ where: { id }, select: { filePath: true, fileName: true, mimeType: true, pattern: { select: { classroomId: true } } } });
  // Same 404 for "doesn't exist" and "not allowed to see".
  if (!file || !(await getClassAccess(user.id, file.pattern.classroomId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let bytes: Buffer;
  try {
    bytes = await readUpload(file.filePath);
  } catch {
    return NextResponse.json({ error: "The file is missing from storage." }, { status: 410 });
  }
  return fileDownload(bytes, file.fileName, file.mimeType);
}
