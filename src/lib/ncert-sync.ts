import { ncertChapters } from "@/data/ncert-index";
import { db } from "./db";

const sourceLabel = (books: { code: string; title: string; edition: string }[]) =>
  "NCERT " + books.map((b) => `${b.title} (${b.code})`).join(" + ") + `, ${books[0].edition}`;

/**
 * When a class's grade changes, switch each subject's NCERT chapter list to the new grade's books.
 * - Chapters from the OLD grade's index are removed only if no note uses them (nothing is lost).
 * - The new grade's chapters are added (no duplicates) and put first, in book order; the teacher's
 *   own chapters and any kept old ones follow.
 */
export async function switchIndexGrade(classroomId: string, oldGrade: string | null, newGrade: string | null) {
  const subjects = await db.subject.findMany({
    where: { classroomId },
    include: { chapters: { orderBy: { position: "asc" }, include: { _count: { select: { notes: true } } } } },
  });
  let removed = 0;
  let added = 0;
  let kept = 0;
  for (const s of subjects) {
    const oldIdx = ncertChapters(oldGrade, s.name);
    const newIdx = ncertChapters(newGrade, s.name);
    if (!oldIdx && !newIdx) continue;
    const oldNames = new Set((oldIdx?.chapters ?? []).map((c) => c.toLowerCase()));
    const newNames = new Set((newIdx?.chapters ?? []).map((c) => c.toLowerCase()));
    const removable = s.chapters.filter((c) => oldNames.has(c.name.toLowerCase()) && !newNames.has(c.name.toLowerCase()) && c._count.notes === 0);
    kept += s.chapters.filter((c) => oldNames.has(c.name.toLowerCase()) && !newNames.has(c.name.toLowerCase()) && c._count.notes > 0).length;
    const remaining = s.chapters.filter((c) => !removable.includes(c));
    const have = new Map(remaining.map((c) => [c.name.toLowerCase(), c.id]));
    const toAdd = (newIdx?.chapters ?? []).filter((c) => !have.has(c.toLowerCase()));

    await db.$transaction(async (tx) => {
      if (removable.length) await tx.chapter.deleteMany({ where: { id: { in: removable.map((c) => c.id) } } });
      const created = await Promise.all(toAdd.map((name) => tx.chapter.create({ data: { subjectId: s.id, name } })));
      const createdBy = new Map(created.map((c) => [c.name.toLowerCase(), c.id]));
      // Order: new index chapters in book order, then everything else in its previous order.
      const indexIds = (newIdx?.chapters ?? []).map((n) => have.get(n.toLowerCase()) ?? createdBy.get(n.toLowerCase())!).filter(Boolean);
      const rest = remaining.map((c) => c.id).filter((id) => !indexIds.includes(id));
      await Promise.all([...indexIds, ...rest].map((id, position) => tx.chapter.update({ where: { id }, data: { position } })));
      await tx.subject.update({ where: { id: s.id }, data: { indexSource: newIdx ? sourceLabel(newIdx.books) : null } });
    });
    removed += removable.length;
    added += toAdd.length;
  }
  return { removed, added, kept };
}
