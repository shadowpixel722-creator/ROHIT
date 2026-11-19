import { ArrowLeft, Sparkles, SquareStack } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlashcardDeck } from "@/components/study/flashcard-deck";
import { StudyManager } from "@/components/study/study-manager";
import { Collapsible, SubjectDot } from "@/components/ui";
import { can, getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { subjectColor } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { MIN_NOTE_CHARS } from "@/lib/study-schema";
import { aiEnabled } from "@/lib/transcribe";

export const metadata = { title: "Flashcards" };

/** One chapter's flashcards: the deck (approved cards), and for teachers, making and checking them. */
export default async function FlashcardChapter({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const { id, chapterId } = await params;
  const user = await requireUser();
  const access = await getClassAccess(user.id, id);
  if (!access) notFound();
  // teacher: makes and checks study material. learner: practises with it. (In their own space a student is both.)
  const teacher = can(access, "study");
  const learner = access.role === "STUDENT";
  const chapter = await db.chapter.findFirst({ where: { id: chapterId, subject: { classroomId: id } }, include: { subject: { select: { name: true, color: true } } } });
  if (!chapter) notFound();
  const [notes, allCards] = await Promise.all([
    db.note.findMany({
      where: { classroomId: id, chapterId, status: "APPROVED" }, orderBy: [{ lessonDate: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, lessonDate: true, createdAt: true, text: true, images: { select: { transcript: true } } },
    }),
    db.flashcard.findMany({ where: { chapterId, ...(teacher ? {} : { status: "APPROVED" }) }, orderBy: { createdAt: "asc" } }),
  ]);
  const titleOf = new Map(notes.map((n) => [n.id, n.title]));
  const cards = allCards.filter((c) => c.status === "APPROVED");
  const drafts = allCards.filter((c) => c.status === "DRAFT").length;

  return (
    <div className="space-y-4">
      <Link href={`/classes/${id}/flashcards`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" /> All chapters</Link>
      <div>
        <p className="flex items-center gap-2 text-sm text-muted"><SubjectDot color={subjectColor(chapter.subject.color)} /> {chapter.subject.name}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{chapter.name}</h2>
      </div>

      {teacher && (
        <Collapsible icon={<Sparkles className="size-5" />} title="Make and check flashcards" bodyClassName="px-4 sm:px-5" data-testid="flashcards-manager"
          meta={`${allCards.length} flashcards${drafts ? ` · ${drafts} to check` : ""}`} defaultOpen={drafts > 0 || allCards.length === 0}>
          <p className="mb-3 text-sm text-muted">Made from approved notes (text only): the key points to remember. Students see a card once you approve it.</p>
          <StudyManager kind="flashcards" chapterId={chapterId} aiOn={aiEnabled()}
            notes={notes.map((n) => ({
              id: n.id, title: n.title, date: formatDate(n.lessonDate ?? n.createdAt),
              enoughText: [n.text, ...n.images.map((i) => i.transcript)].filter(Boolean).join(" ").replace(/\s+/g, " ").length >= MIN_NOTE_CHARS,
              cards: allCards.filter((c) => c.noteId === n.id).length,
              questions: 0,
              drafts: allCards.filter((c) => c.noteId === n.id && c.status === "DRAFT").length,
            }))}
            cards={allCards.map((c) => ({ id: c.id, front: c.front, back: c.back, noteId: c.noteId, draft: c.status === "DRAFT", source: c.source }))} />
        </Collapsible>
      )}

      <Collapsible icon={<SquareStack className="size-5" />} title={teacher && !learner ? "Flashcards: what students see" : "Flashcards"} defaultOpen={learner}
        meta={`${cards.length} card${cards.length === 1 ? "" : "s"} · flip each one`}>
        <FlashcardDeck key={cards.map((c) => c.id).join(",")} cards={cards.map((c) => ({ id: c.id, front: c.front, back: c.back, from: c.noteId ? (titleOf.get(c.noteId) ?? null) : null }))} />
      </Collapsible>
    </div>
  );
}
