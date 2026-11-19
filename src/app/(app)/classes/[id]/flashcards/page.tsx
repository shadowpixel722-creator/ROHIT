import { SquareStack } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Collapsible, EmptyState, SubjectDot } from "@/components/ui";
import { can, getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { subjectColor } from "@/lib/constants";
import { db } from "@/lib/db";
import { materialCounts } from "@/lib/study";

export const metadata = { title: "Flashcards" };

/** The only place flashcards live: pick a chapter to study its cards (teachers make and check them here too). */
export default async function FlashcardsIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const access = await getClassAccess(user.id, id);
  if (!access) notFound();
  const teacher = can(access, "study"); // makes and checks flashcards (a student does too, in their own space)
  const subjects = await db.subject.findMany({
    where: { classroomId: id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, color: true, chapters: { orderBy: { position: "asc" }, select: { id: true, name: true } } },
  });
  const counts = await materialCounts(subjects.flatMap((s) => s.chapters.map((c) => c.id)));
  if (subjects.length === 0) {
    return <Card><EmptyState icon={<SquareStack className="size-5" />} title="No subjects yet" description={teacher ? "Add subjects and chapters on the Overview tab first." : (access.kind === "ROOM" ? "The student head hasn't added subjects yet." : "Your teacher hasn't added subjects yet.")} /></Card>;
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{teacher ? "Open a chapter to make flashcards from its notes, then approve them." : "Open a chapter and flip through its flashcards."}</p>
      {subjects.map((s) => {
        const ready = s.chapters.filter((c) => (counts.get(c.id)?.cardsApproved ?? 0) > 0).length;
        const toCheck = s.chapters.reduce((t, c) => t + (counts.get(c.id)?.cardsDraft ?? 0), 0);
        return (
          <Collapsible key={s.id} title={<span className="flex items-center gap-2"><SubjectDot color={subjectColor(s.color)} /> {s.name}</span>}
            meta={`${ready} of ${s.chapters.length} chapters have flashcards${teacher && toCheck ? ` · ${toCheck} to check` : ""}`}
            defaultOpen={subjects.length === 1 || (teacher ? toCheck > 0 : ready > 0)} bodyClassName="pb-2">
            <ul className="divide-y divide-border">
              {s.chapters.length === 0 && <li className="py-3 text-sm text-muted">No chapters yet.</li>}
              {s.chapters.map((c) => {
                const n = counts.get(c.id);
                const cards = n?.cardsApproved ?? 0;
                const row = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="text-xs text-muted">{cards ? `${cards} flashcard${cards === 1 ? "" : "s"}` : "No flashcards yet"}</span>
                    </span>
                    {teacher && (n?.cardsDraft ?? 0) > 0 && <Badge tone="warn">{n!.cardsDraft} to check</Badge>}
                  </>
                );
                return (
                  <li key={c.id} data-testid="flashcard-chapter">
                    {teacher || cards
                      ? <Link href={`/classes/${id}/flashcards/${c.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">{row}</Link>
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
