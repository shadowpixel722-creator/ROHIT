import { ChevronRight, Eye, ListChecks, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PatternEditor } from "@/components/exam-patterns/pattern-editor";
import { Card, CardHeader, Collapsible, EmptyState } from "@/components/ui";
import { can, getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { totalMarks, totalQuestions, type Pattern } from "@/lib/exam-schema";
import { aiEnabled } from "@/lib/transcribe";

export const metadata = { title: "Exam patterns" };

/** Exam patterns: the lessons an exam covers and how it is set out. Teachers make them; the whole class can see them. */
export default async function ExamPatternsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const access = await getClassAccess(user.id, id);
  if (!access) notFound();
  const teacher = can(access, "study");
  const patterns = (await db.examPattern.findMany({
    where: { classroomId: id },
    orderBy: { createdAt: "asc" },
    include: { lessons: { select: { chapterId: true } }, attachments: { orderBy: { position: "asc" }, select: { id: true, fileName: true, size: true } } },
  })).map((p) => ({ ...p, sections: JSON.parse(p.sections) as Pattern["sections"], lessonIds: p.lessons.map((l) => l.chapterId) }));
  const summary = (p: (typeof patterns)[number]) =>
    `${p.lessonIds.length} lesson${p.lessonIds.length === 1 ? "" : "s"} · ${totalQuestions(p.sections)} questions · ${totalMarks(p.sections)} marks · ${p.durationMinutes} min${p.attachments.length ? ` · ${p.attachments.length} file${p.attachments.length === 1 ? "" : "s"}` : ""}`;

  if (!teacher) {
    return (
      <Card>
        <CardHeader icon={<ListChecks className="size-5" />} title="Exam patterns" description="Which lessons each exam covers, and how it is set out: sections, types of questions and marks." />
        {patterns.length === 0
          ? <EmptyState icon={<ListChecks className="size-5" />} title="No exam patterns yet" description={access.kind === "ROOM" ? "Nobody has added any exam patterns here yet." : "Your teacher hasn't added any exam patterns yet."} />
          : (
            <ul className="divide-y divide-border px-5 pb-2" data-testid="pattern-list">
              {patterns.map((p) => (
                <li key={p.id}>
                  <Link href={`/classes/${id}/exam-patterns/${p.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="text-xs text-muted">{summary(p)}</span>
                    </span>
                    <ChevronRight className="size-4 text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </Card>
    );
  }

  const [subjects, noteCounts] = await Promise.all([
    db.subject.findMany({ where: { classroomId: id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, chapters: { orderBy: { position: "asc" }, select: { id: true, name: true } } } }),
    db.note.groupBy({ by: ["chapterId"], where: { classroomId: id, status: "APPROVED", chapterId: { not: null } }, _count: true }),
  ]);
  const notesBy = new Map(noteCounts.map((n) => [n.chapterId!, n._count]));
  const lessonSubjects = subjects.map((s) => ({ id: s.id, name: s.name, chapters: s.chapters.map((c) => ({ ...c, notes: notesBy.get(c.id) ?? 0 })) }));
  const aiOn = aiEnabled();

  return (
    <div className="space-y-4">
      <Collapsible icon={<Plus className="size-5" />} title="New exam pattern" meta="Choose the lessons, then set the sections and marks" defaultOpen={patterns.length === 0} data-testid="new-pattern">
        <PatternEditor classroomId={id} aiOn={aiOn} subjects={lessonSubjects} />
      </Collapsible>

      <Card>
        <CardHeader icon={<ListChecks className="size-5" />} title="Exam patterns" description="Students can see these, so they know which lessons each exam covers and how it is set out." />
        <div className="space-y-2 px-5 pb-5">
          {patterns.length === 0 ? <p className="text-sm text-muted">No patterns yet. Make one above.</p> : patterns.map((p) => (
            <details key={p.id} className="rounded-xl border border-border" data-testid="saved-pattern">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted">{summary(p)}</span>
              </summary>
              <div className="px-3 pb-3">
                <Link href={`/classes/${id}/exam-patterns/${p.id}`} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><Eye className="size-4" /> View pattern</Link>
                <PatternEditor classroomId={id} patternId={p.id} aiOn={aiOn} subjects={lessonSubjects} initialLessons={p.lessonIds} files={p.attachments}
                  initial={{ name: p.name, durationMinutes: p.durationMinutes, instructions: p.instructions, sections: p.sections }} />
              </div>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
