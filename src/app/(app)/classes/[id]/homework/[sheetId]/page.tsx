import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnswerSheet } from "@/components/homework/student";
import { MarkingTable, SheetEditor } from "@/components/homework/teacher";
import { getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { HwMarks, HwQuestion } from "@/lib/homework";

export const metadata = { title: "Homework" };
const parse = <T,>(s: string | null, fallback: T): T => { try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; } };

export default async function SheetPage({ params }: { params: Promise<{ id: string; sheetId: string }> }) {
  const { id, sheetId } = await params;
  const user = await requireUser();
  const access = await getClassAccess(user.id, id);
  if (!access) notFound();
  const teacher = access.role === "TEACHER";
  const sheet = await db.homeworkSheet.findFirst({ where: { id: sheetId, classroomId: id, ...(teacher ? {} : { publishedAt: { not: null } }) }, include: { chapter: { select: { name: true } } } });
  if (!sheet) notFound();
  const questions = parse<HwQuestion[]>(sheet.questions, []);
  const back = <Link href={`/classes/${id}/homework`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" /> All homework</Link>;

  if (!teacher) {
    const work = await db.homeworkWork.findUnique({ where: { sheetId_userId: { sheetId, userId: user.id } } });
    return (
      <div className="space-y-4">{back}
        <AnswerSheet sheetId={sheetId} title={sheet.title} note={sheet.note} questions={questions.map((q) => ({ q: q.q, marks: q.marks }))}
          answers={parse<string[]>(work?.answers ?? null, questions.map(() => ""))} submitted={!!work?.submittedAt}
          marks={work?.markStatus === "CONFIRMED" ? parse<HwMarks | null>(work.marks, null) : null} />
      </div>
    );
  }
  const [students, work] = await Promise.all([
    db.membership.findMany({ where: { classroomId: id, role: "STUDENT", status: "ACTIVE" }, orderBy: { joinedAt: "asc" }, select: { userId: true, consentVerifiedAt: true, user: { select: { name: true } } } }),
    db.homeworkWork.findMany({ where: { sheetId } }),
  ]);
  const byUser = new Map(work.map((w) => [w.userId, w]));
  return (
    <div className="space-y-5">{back}
      <SheetEditor sheetId={sheetId} title={sheet.title} note={sheet.note} questions={questions} published={!!sheet.publishedAt} className={access.classroom.name} />
      {sheet.publishedAt && (
        <MarkingTable sheetId={sheetId} questions={questions} rows={students.map((s) => {
          const w = byUser.get(s.userId);
          return { id: s.userId, name: s.user.name, consent: !!s.consentVerifiedAt, submitted: !!w?.submittedAt, answers: parse<string[] | null>(w?.answers ?? null, null), status: (w?.markStatus as "SUGGESTED" | "CONFIRMED" | null) ?? null, marks: parse<HwMarks | null>(w?.marks ?? null, null) };
        })} />
      )}
    </div>
  );
}
