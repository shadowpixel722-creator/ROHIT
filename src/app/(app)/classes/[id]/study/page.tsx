import { BookOpen } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReadinessBadge } from "@/components/study/readiness-badge";
import { Badge, Card, Collapsible, EmptyState, SubjectDot } from "@/components/ui";
import { getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { subjectColor } from "@/lib/constants";
import { db } from "@/lib/db";
import { levelOf } from "@/lib/quiz";
import { chapterPercents, materialCounts } from "@/lib/study";

export const metadata = { title: "Study" };

/** Every chapter with its quizzes (written and multiple choice). Flashcards have their own tab. */
export default async function StudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const access = await getClassAccess(user.id, id);
  if (!access) notFound();
  const teacher = access.role === "TEACHER";

  const subjects = await db.subject.findMany({
    where: { classroomId: id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, color: true, chapters: { orderBy: { position: "asc" }, select: { id: true, name: true } } },
  });
  const chapterIds = subjects.flatMap((s) => s.chapters.map((c) => c.id));
  const [counts, percents] = await Promise.all([materialCounts(chapterIds), teacher ? Promise.resolve(new Map<string, number | null>()) : chapterPercents(user.id, chapterIds)]);

  if (subjects.length === 0) {
    return <Card><EmptyState icon={<BookOpen className="size-5" />} title="No subjects yet" description={teacher ? "Add subjects and chapters on the Overview tab first." : "Your teacher hasn't added subjects yet."} /></Card>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {teacher
          ? "Open a chapter to make quiz questions from its notes, then approve them."
          : "Open a chapter to quiz yourself."}
      </p>
      {subjects.map((s) => {
        const ready = s.chapters.filter((c) => { const n = counts.get(c.id); return (n?.questionsApproved ?? 0) + (n?.mcqApproved ?? 0) > 0; }).length;
        const toCheck = s.chapters.reduce((t, c) => t + (counts.get(c.id)?.questionsDraft ?? 0) + (counts.get(c.id)?.mcqDraft ?? 0), 0);
        return (
        <Collapsible key={s.id} title={<span className="flex items-center gap-2"><SubjectDot color={subjectColor(s.color)} /> {s.name}</span>}
          meta={`${ready} of ${s.chapters.length} chapters ready${teacher && toCheck ? ` · ${toCheck} to check` : ""}`}
          defaultOpen={subjects.length === 1 || (teacher ? toCheck > 0 : ready > 0)} bodyClassName="pb-2">
          <ul className="divide-y divide-border">
            {s.chapters.length === 0 && <li className="py-3 text-sm text-muted">No chapters yet.</li>}
            {s.chapters.map((c) => {
              const n = counts.get(c.id);
              const ready = (n?.questionsApproved ?? 0) + (n?.mcqApproved ?? 0) > 0;
              const drafts = (n?.questionsDraft ?? 0) + (n?.mcqDraft ?? 0);
              const percent = percents.get(c.id) ?? null;
              const row = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="text-xs text-muted">
                      {ready || teacher ? `${n?.questionsApproved ?? 0} written · ${n?.mcqApproved ?? 0} multiple-choice questions` : "Not ready yet"}
                    </span>
                  </span>
                  {teacher && drafts > 0 && <Badge tone="warn">{drafts} to check</Badge>}
                  {!teacher && ready && <ReadinessBadge percent={percent} level={levelOf(percent)} />}
                </>
              );
              return (
                <li key={c.id} data-testid="study-chapter">
                  {teacher || ready
                    ? <Link href={`/classes/${id}/study/${c.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">{row}</Link>
                    : <div className="flex items-center gap-3 py-3 opacity-60">{row}</div>}
                </li>
              );
            })}
          </ul>
        </Collapsible>
        );
      })}
    </div>
  );
}
