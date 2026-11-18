import { ArrowLeft, ArrowRight, Box, CheckCircle2, Headphones, Highlighter, Lightbulb, ListChecks } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExplainLoader, RemakeExplanation } from "@/components/notes/explain-loader";
import { FormattedText } from "@/components/notes/formatted-text";
import { KeyHighlighter } from "@/components/notes/key-highlighter";
import { Lesson3D } from "@/components/notes/lesson-3d";
import { ReadingView } from "@/components/notes/reading-view";
import { Collapsible, SubjectDot } from "@/components/ui";
import { getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { subjectColor } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { lessonText, textHash, type Explanation } from "@/lib/explain-schema";
import { lessonForChapter } from "@/lib/knowa/lessons";
import { matchLibrary } from "@/lib/model3d-library";
import type { Scene } from "@/lib/model3d-schema";
import { tidyPageText } from "@/lib/tidy";

export const metadata = { title: "Explain" };

/**
 * One chapter's lessons, each explained: summary, key points, a simple explanation that follows the notes'
 * own headings in order, and the notes themselves with the key phrases highlighted.
 */
export default async function ExplainChapter({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const { id, chapterId } = await params;
  const user = await requireUser();
  const access = await getClassAccess(user.id, id);
  if (!access) notFound();
  const teacher = access.role === "TEACHER";
  const chapter = await db.chapter.findFirst({ where: { id: chapterId, subject: { classroomId: id } }, include: { subject: { select: { name: true, color: true } } } });
  if (!chapter) notFound();
  const lesson3d = lessonForChapter(chapter.name, access.classroom.grade);
  const notes = await db.note.findMany({
    where: { classroomId: id, chapterId, status: "APPROVED" },
    orderBy: [{ lessonDate: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, lessonDate: true, createdAt: true, text: true, images: { orderBy: { position: "asc" }, select: { transcript: true } }, explanation: true, model3d: true },
  });

  return (
    <div className="space-y-4">
      <Link href={`/classes/${id}/explain`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" /> All lessons</Link>
      <div>
        <p className="flex items-center gap-2 text-sm text-muted"><SubjectDot color={subjectColor(chapter.subject.color)} /> {chapter.subject.name}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{chapter.name}</h2>
        <p className="mt-1 text-xs text-faint">Explanations are made by AI from your class notes and may contain mistakes.</p>
      </div>
      {lesson3d && (
        <Link href={`/classes/${id}/explain/lesson/${lesson3d.id}`} data-testid="chapter-3d-lesson"
          className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary-soft px-4 py-3 hover:border-primary/60">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#0d1530] text-[#9db3ff]"><Box className="size-5" aria-hidden /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Watch the 3D lesson: {lesson3d.title}</span><span className="block text-xs text-muted">A narrated walkthrough with an interactive model, made for this chapter</span></span>
          <ArrowRight className="size-4 text-primary" aria-hidden />
        </Link>
      )}

      {notes.length === 0 && <p className="text-sm text-muted">No approved notes in this chapter yet.</p>}
      {notes.map((n) => {
        const text = lessonText(n);
        const hash = textHash(text);
        const fresh = n.explanation && n.explanation.sourceHash === hash ? (JSON.parse(n.explanation.content) as Explanation) : null;
        const notesId = `lesson-notes-${n.id}`;
        const model = n.model3d && n.model3d.sourceHash === hash ? { scene: JSON.parse(n.model3d.content) as Scene, source: n.model3d.source === "library" ? "library" as const : "ai" as const } : null;
        return (
          <Collapsible key={n.id} id={`lesson-${n.id}`} defaultOpen={notes.length <= 3} data-testid="lesson" icon={<Lightbulb className="size-5" />}
            title={n.title} meta={formatDate(n.lessonDate ?? n.createdAt)}>
            <>
            {!fresh ? (text ? <ExplainLoader noteId={n.id} /> : <p className="text-sm text-muted">This lesson has no text yet. Its page photos may still be converting.</p>) : (
              <ReadingView title={n.title}>
              <div className="space-y-5">
                <section data-testid="lesson-summary">
                  <h3 className="mb-1 text-sm font-semibold">In short</h3>
                  <p className="text-sm leading-relaxed">{fresh.summary}</p>
                </section>

                {fresh.keyPoints.length > 0 && (
                  <section>
                    <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold"><ListChecks className="size-4 text-primary" /> Key points</h3>
                    <ul className="space-y-1" data-testid="lesson-keypoints">
                      {fresh.keyPoints.map((k, i) => <li key={i} className="flex gap-2 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />{k}</li>)}
                    </ul>
                  </section>
                )}

                {fresh.sections.length > 0 && (
                  <section data-testid="lesson-explained">
                    <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Lightbulb className="size-4 text-primary" /> Explained, in the order of your notes</h3>
                    <ol className="space-y-3 border-l-2 border-primary/30 pl-4">
                      {fresh.sections.map((s, i) => (
                        <li key={i}>
                          <p className="text-sm font-semibold">{s.heading}</p>
                          <p className="text-sm leading-relaxed text-muted">{s.explanation}</p>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                <details open className="rounded-xl border border-border">
                  <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-semibold">
                    <Highlighter className="size-4 text-primary" /> Your notes, with key points highlighted
                    <span className="ml-auto inline-block rounded px-1.5 text-[11px] font-normal" style={{ background: "#fde68a", color: "#1c211f" }}>highlighted</span>
                  </summary>
                  <div id={notesId} className="px-3 pb-3" data-testid="lesson-notes">
                    <FormattedText text={tidyPageText(text, { lastDate: null })} />
                  </div>
                  <KeyHighlighter targetId={notesId} phrases={fresh.highlights} />
                </details>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <Link href={`/classes/${id}/explain/listen/${n.id}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline" data-testid="listen-lesson"><Headphones className="size-3.5" /> Listen as a lesson</Link>
                  <Link href={`/classes/${id}/notebook/${n.id}`} className="text-primary hover:underline">Open the original note</Link>
                  <Link href={`/classes/${id}/study/${chapterId}`} className="text-primary hover:underline">Practise this chapter</Link>
                  {teacher && <span className="ml-auto"><RemakeExplanation noteId={n.id} /></span>}
                </div>
              </div>
              </ReadingView>
            )}
            {text && <Lesson3D noteId={n.id} model={model} teacher={teacher} libraryFits={!!matchLibrary({ chapter: chapter.name, title: n.title, text })} />}
            </>
          </Collapsible>
        );
      })}
    </div>
  );
}
