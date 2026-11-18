import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/files";
import { getVisibleNote } from "@/lib/notes";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await params;
  const img = await db.noteImage.findUnique({ where: { id }, select: { filePath: true, noteId: true } });
  // Same 404 for "doesn't exist" and "not allowed to see".
  if (!img || !(await getVisibleNote(user.id, img.noteId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let bytes: Buffer;
  try {
    bytes = await readUpload(img.filePath);
  } catch {
    return NextResponse.json({ error: "The image is missing from storage." }, { status: 410 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-cache", // pages can be rotated after upload
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
