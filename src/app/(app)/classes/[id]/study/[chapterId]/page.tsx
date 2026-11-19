import { ArrowLeft, ListChecks, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuizRunner } from "@/components/study/quiz-runner";
import { ReadinessBadge } from "@/components/study/readiness-badge";
import { StudyManager } from "@/components/study/study-manager";
import { McqManager } from "@/components/study/mcq-manager";
import { DraftReview } from "@/components/study/draft-review";
import { McqRunner } from "@/components/study/mcq-runner";
import { Collapsible, SubjectDot } from "@/components/ui";
import { can, getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { subjectColor } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { levelOf } from "@/lib/quiz";
import { MIN_NOTE_CHARS } from "@/lib/study-schema";
import { chapterPercents } from "@/lib/study";
import { aiEnabled } from "@/lib/transcribe";

export const metadata = { title: "Study" };

export default async function StudyChapterPage({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const { id, chapterId } = await params;
  const user = await requireUser();
  const access = await getClassAccess(user.id, id);
  if (!access) notFound();
  // teacher: makes and checks study material. learner: practises with it. (In their own space a student is both.)
  const teacher = can(access, "study");
  const learner = access.role === "STUDENT";
  const chapter = await db.chapter.findFirst({ where: { id: chapterId, subject: { classroomId: id } }, include: { subject: { select: { name: true, color: true } } } });
  if (!chapter) notFound();

  const [notes, allQuestions, attempts, percents, allMcqs] = await Promise.all([
    db.note.findMany({
      where: { classroomId: id, chapterId, status: "APPROVED" },
      orderBy: [{ lessonDate: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, lessonDate: true, createdAt: true, text: true, images: { select: { transcript: true } } },
    }),
    db.question.findMany({ where: { chapterId, ...(teacher ? {} : { status: "APPROVED" }) }, orderBy: { createdAt: "asc" } }),
    db.quizAttempt.findMany({ where: { userId: user.id, chapterId, submittedAt: { not: null } }, orderBy: { submittedAt: "desc" }, take: 5, select: { id: true, score: true, total: true, submittedAt: true } }),
    chapterPercents(user.id, [chapterId]),
    db.mcqQuestion.findMany({
      where: { chapterId }, orderBy: { createdAt: "asc" },
      include: { distractors: { include: { misconception: { select: { label: true } } } } },
    }),
  ]);
  const percent = percents.get(chapterId) ?? null;
  const fmtPoints = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const dateOf = (n: (typeof notes)[number]) => formatDate(n.lessonDate ?? n.createdAt);
  const titleOf = new Map(notes.map((n) => [n.id, n.title]));

  // What students practise with: approved items only (teachers see drafts in the manager, and can try the real thing below).
  // Written answers are marked by AI, so a student needs the AI on and their consent form confirmed (the same rule as adding notes).
  const quizBlocked = !aiEnabled()
    ? "AI is off, so written answers can't be checked right now."
    : learner && !access.membership?.consentVerifiedAt
      ? "Your teacher needs to confirm your parent/guardian consent form before the AI can check your written answers. Ask your teacher."
      : null;
  const drafts = allQuestions.filter((q) => q.status === "DRAFT").length;
  const questions = allQuestions.filter((q) => q.status === "APPROVED");
  const studentQuestionCount = access.classroom.studentQuestionCount;
  const tagsOf = (q: (typeof allMcqs)[number]) => {
    const tags: (string | null)[] = [null, null, null, null];
    for (const d of q.distractors) tags[d.choiceIndex] = d.misconception.label;
    return tags;
  };
  const approvedMcqs = allMcqs.filter((q) => q.status === "APPROVED").length;
  const draftMcqs = allMcqs.filter((q) => q.status === "DRAFT");

  return (
    <div className="space-y-4">
      <Link href={`/classes/${id}/study`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" /> All chapters</Link>
      <div>
        <p className="flex items-center gap-2 text-sm text-muted"><SubjectDot color={subjectColor(chapter.subject.color)} /> {chapter.subject.name}</p>
        <h2 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">{chapter.name} {learner && <ReadinessBadge percent={percent} level={levelOf(percent)} />}</h2>
        <p className="mt-1 text-sm"><Link href={`/classes/${id}/notebook/chapter/${chapterId}`} className="text-primary hover:underline">Read the notes for this chapter</Link></p>
      </div>

      {teacher && (
        <Collapsible icon={<Sparkles className="size-5" />} title="Make and check written questions" bodyClassName="px-4 sm:px-5" data-testid="questions-manager"
          meta={`${allQuestions.length} questions${drafts ? ` · ${drafts} to check` : ""}`} defaultOpen={drafts > 0 || allQuestions.length === 0}>
          <p className="mb-3 text-sm text-muted">Made from approved notes (text only). Students see a question once you approve it.</p>
          <StudyManager kind="questions" chapterId={chapterId} aiOn={aiEnabled()}
            notes={notes.map((n) => ({
              id: n.id, title: n.title, date: dateOf(n),
              enoughText: [n.text, ...n.images.map((i) => i.transcript)].filter(Boolean).join(" ").replace(/\s+/g, " ").length >= MIN_NOTE_CHARS,
              cards: 0,
              questions: allQuestions.filter((q) => q.noteId === n.id).length,
              drafts: allQuestions.filter((q) => q.noteId === n.id && q.status === "DRAFT").length,
            }))}
            questions={allQuestions.map((q) => ({ id: q.id, question: q.question, answer: q.answer, keyPoints: JSON.parse(q.keyPoints) as string[], noteId: q.noteId, draft: q.status === "DRAFT", source: q.source }))} />
        </Collapsible>
      )}

      <Collapsible icon={<ListChecks className="size-5" />} title={teacher && !learner ? "Quiz: what students see" : "Quiz yourself"} meta="Answer in your own words" defaultOpen={learner}>
          <QuizRunner classroomId={id} chapterId={chapterId} blocked={quizBlocked}
            notes={notes.map((n) => ({ id: n.id, title: n.title, date: dateOf(n), questions: questions.filter((q) => q.noteId === n.id).length }))} />
      </Collapsible>

      <Collapsible icon={<Target className="size-5" />} title={teacher && !learner ? "Multiple-choice practice: what students see" : "Multiple-choice practice"}
        meta={`${approvedMcqs} questions · each wrong answer shows the trap behind it`} defaultOpen={learner} data-testid="mcq-practice">
        <div className="space-y-4">
          {approvedMcqs > 0
            ? <McqRunner classroomId={id} target={{ chapterId }} generateCount={learner ? studentQuestionCount : 0} />
            : learner && studentQuestionCount > 0 && aiEnabled()
              ? <McqRunner classroomId={id} target={{ chapterId }} generateCount={studentQuestionCount} generateOnly />
              : <p className="text-sm text-muted">No multiple-choice questions yet{teacher ? ". Make some below." : "."}</p>}
          {learner && draftMcqs.length > 0 && (
            <details className="rounded-xl border border-border" data-testid="drafts-to-check">
              <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-semibold">
                Draft questions to check <span className="font-normal text-muted">({draftMcqs.length})</span>
                <span className="ml-auto text-xs font-normal text-muted">approve the ones whose ticked answer is right</span>
              </summary>
              <ul className="space-y-2 px-3 pb-3">
                {draftMcqs.map((q) => <DraftReview key={q.id} q={{ id: q.id, chapterName: chapter.name, stem: q.stem, choices: JSON.parse(q.choices) as string[], answerIndex: q.answerIndex, explanation: q.explanation, tags: tagsOf(q) }} />)}
              </ul>
            </details>
          )}
        </div>
      </Collapsible>

      {teacher && (
        <Collapsible icon={<Target className="size-5" />} title="Make and check multiple-choice questions" data-testid="mcq-manager"
          meta={`${allMcqs.length} questions${draftMcqs.length ? ` · ${draftMcqs.length} to check` : ""}`}
          defaultOpen={allMcqs.length === 0 || draftMcqs.length > 0} bodyClassName="px-4 sm:px-5">
          <McqManager classroomId={id} chapterId={chapterId} aiOn={aiEnabled()} studentCount={studentQuestionCount}
            notes={notes.map((n) => ({ id: n.id, title: n.title, mcqs: allMcqs.filter((q) => q.noteId === n.id).length,
              enoughText: [n.text, ...n.images.map((i) => i.transcript)].filter(Boolean).join(" ").replace(/\s+/g, " ").length >= MIN_NOTE_CHARS }))}
            mcqs={allMcqs.map((q) => ({ id: q.id, stem: q.stem, choices: JSON.parse(q.choices) as string[], answerIndex: q.answerIndex, explanation: q.explanation, tags: tagsOf(q),
              draft: q.status === "DRAFT", noteTitle: q.noteId ? (titleOf.get(q.noteId) ?? null) : null, byStudent: q.approvedByRole === "STUDENT", madeByStudent: q.source === "STUDENT" }))} />
        </Collapsible>
      )}

      {attempts.length > 0 && (
        <Collapsible title="Your recent quizzes" meta={`Last: ${fmtPoints(attempts[0].score ?? 0)} / ${attempts[0].total} · only you can see these`}>
          <ul className="divide-y divide-border text-sm" data-testid="attempt-history">
            {attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <span className="text-muted">{formatDate(a.submittedAt)}</span>
                <span className="font-medium tabular-nums">{fmtPoints(a.score ?? 0)} / {a.total}</span>
              </li>
            ))}
          </ul>
        </Collapsible>
      )}
    </div>
  );
}
