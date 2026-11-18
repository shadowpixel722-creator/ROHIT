import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

/** Image URL with a version tag that changes when a page is rotated, so browsers fetch the new image. */
export const imageSrc = (img: { id: string; width: number; height: number; size: number }) => `/api/images/${img.id}?v=${img.width}x${img.height}-${img.size}`;

export async function noteCards(where: Prisma.NoteWhereInput) {
  const rows = await db.note.findMany({
    where,
    orderBy: [{ lessonDate: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      author: { select: { name: true, role: true } },
      subject: { select: { name: true, color: true } },
      chapter: { select: { name: true } },
      images: { orderBy: { position: "asc" }, take: 1, select: { id: true, width: true, height: true, size: true } },
      _count: { select: { images: true, comments: true, attachments: true } },
    },
  });
  return rows.map((n) => ({
    id: n.id, title: n.title, status: n.status, rejectReason: n.rejectReason, hasText: !!n.text,
    textPreview: n.text?.slice(0, 160) ?? null,
    authorName: n.author.name, authorIsTeacher: n.author.role === "TEACHER", authorId: n.authorId,
    subjectId: n.subjectId, subjectName: n.subject.name, subjectColor: n.subject.color,
    chapterId: n.chapterId, chapterName: n.chapter?.name ?? null,
    cover: n.images[0] ? imageSrc(n.images[0]) : null,
    pages: n._count.images, comments: n._count.comments, attachments: n._count.attachments, createdAt: n.createdAt.toISOString(),
    lessonDate: n.lessonDate?.toISOString() ?? null,
  }));
}
export type NoteCardData = Awaited<ReturnType<typeof noteCards>>[number];

export async function formSubjects(classroomId: string) {
  return db.subject.findMany({
    where: { classroomId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, color: true, chapters: { orderBy: { position: "asc" }, select: { id: true, name: true } } },
  });
}

