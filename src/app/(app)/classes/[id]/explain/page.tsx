import { Lightbulb } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonCards } from "@/components/knowa/lesson-cards";
import { Card, Collapsible, EmptyState, SubjectDot } from "@/components/ui";
import { getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { subjectColor } from "@/lib/constants";
import { db } from "@/lib/db";
import { lessonsForGrade } from "@/lib/knowa/lessons";

export const metadata = { title: "Explain" };

/** Pick a lesson to learn: chapters with approved notes, by subject. */
export default async function ExplainIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const access = await getClassAccess(user.id, id);
  if (!access) notFound();
  const lessons3d = lessonsForGrade(access.classroom.grade);
  const showcase = lessons3d.length > 0 && (
    <section className="space-y-2">
      <div><h2 className="text-base font-semibold">Interactive 3D lessons</h2><p className="text-sm text-muted">Narrated lessons for Class {access.classroom.grade ?? "6–10"}: the tutor talks you through a 3D model, moves it and writes on a notepad. Take over any time.</p></div>
      <LessonCards lessons={lessons3d} basePath={`/classes/${id}/explain/lesson`} />
    </section>
  );
  const [subjects, counts] = await Promise.all([
    db.subject.findMany({ where: { classroomId: id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, color: true, chapters: { orderBy: { position: "asc" }, select: { id: true, name: true } } } }),
    db.note.groupBy({ by: ["chapterId"], where: { classroomId: id, status: "APPROVED", chapterId: { not: null } }, _count: true }),
  ]);
  const lessons = new Map(counts.map((c) => [c.chapterId!, c._count]));
  const withLessons = subjects.filter((s) => s.chapters.some((c) => lessons.has(c.id)));
  if (withLessons.length === 0) {
    return (
      <div className="space-y-6">
        {showcase}
        <Card><EmptyState icon={<Lightbulb className="size-5" />} title="No class notes to explain yet" description="Once notes are added and approved, each lesson gets a summary, key points and a simple explanation here." /></Card>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {showcase}
      <section className="space-y-3">
      <div><h2 className="text-base font-semibold">Your class notes, explained</h2><p className="text-sm text-muted">Pick a lesson: you get a short summary, the key points, a simple explanation in the same order as your notes, and your notes with the key points highlighted.</p></div>
      {withLessons.map((s) => {
        const chapters = s.chapters.filter((c) => lessons.has(c.id));
        return (
          <Collapsible key={s.id} defaultOpen={withLessons.length === 1} bodyClassName="pb-2"
            title={<span className="flex items-center gap-2"><SubjectDot color={subjectColor(s.color)} /> {s.name}</span>}
            meta={`${chapters.length} chapter${chapters.length === 1 ? "" : "s"} with lessons`}>
            <ul className="divide-y divide-border">
              {chapters.map((c) => (
                <li key={c.id} data-testid="explain-chapter">
                  <Link href={`/classes/${id}/explain/${c.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                    <span className="text-xs text-muted">{lessons.get(c.id)} lesson{lessons.get(c.id) === 1 ? "" : "s"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Collapsible>
        );
      })}
      </section>
    </div>
  );
}
