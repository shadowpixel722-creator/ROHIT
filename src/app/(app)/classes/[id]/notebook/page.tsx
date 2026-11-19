import { NotebookPen, Plus, Search } from "lucide-react";
import { notFound } from "next/navigation";
import { NoteCard } from "@/components/notes/note-card";
import { ButtonLink, Card, EmptyState, Input } from "@/components/ui";
import { NotebookFilters } from "@/components/notes/notebook-filters";
import { getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { formSubjects, noteCards } from "@/lib/note-queries";
import { canUpload } from "@/lib/notes";
import { newNotesByChapter } from "@/lib/chapter-news";

export const metadata = { title: "Notebook" };

export default async function NotebookPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ subject?: string; chapter?: string; q?: string }> }) {
  const [{ id }, sp, user] = await Promise.all([params, searchParams, requireUser()]);
  const access = await getClassAccess(user.id, id);
  if (!access) notFound();
  const [subjects, news] = await Promise.all([formSubjects(id), newNotesByChapter(user.id, id)]);
  const allowed = canUpload(access);
  const subject = subjects.find((s) => s.id === sp.subject);
  const chapter = subject?.chapters.find((c) => c.id === sp.chapter);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const notes = await noteCards({
    classroomId: id,
    status: "APPROVED",
    ...(subject ? { subjectId: subject.id } : {}),
    ...(chapter ? { chapterId: chapter.id } : {}),
    ...(q ? { OR: [{ title: { contains: q } }, { text: { contains: q } }, { images: { some: { transcript: { contains: q } } } }] } : {}),
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form className="relative flex-1 sm:max-w-sm" action={`/classes/${id}/notebook`}>
          {subject && <input type="hidden" name="subject" value={subject.id} />}
          {chapter && <input type="hidden" name="chapter" value={chapter.id} />}
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <Input name="q" defaultValue={q} placeholder="Search notes, including text in photos" className="pl-9" aria-label="Search notes" />
        </form>
        {allowed && <ButtonLink href={`/classes/${id}/new${subject ? `?subject=${subject.id}` : ""}`}><Plus className="size-4" /> Add note</ButtonLink>}
      </div>
      <NotebookFilters action={`/classes/${id}/notebook`} subjectId={subject?.id ?? ""} chapterId={chapter?.id ?? ""} q={q}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name, chapters: s.chapters.map((c) => ({ id: c.id, name: c.name, fresh: news.get(c.id) ?? 0 })) }))} />
      {chapter && notes.length > 0 && (
        <a href={`/classes/${id}/notebook/chapter/${chapter.id}`} className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary-soft px-4 py-3 text-sm font-medium text-primary hover:brightness-95">
          <span>Read the whole chapter: all {notes.length} note{notes.length === 1 ? "" : "s"} combined{news.get(chapter.id) ? `, ${news.get(chapter.id)} new` : ""}</span>
          <span aria-hidden>→</span>
        </a>
      )}
      {notes.length === 0 ? (
        <Card><EmptyState icon={<NotebookPen className="size-5" />} title={q ? `No notes match “${q}”` : "No approved notes here yet"}
          description={q ? "Search covers titles, typed notes and the text read from page photos." : access.kind === "CLASS" ? "Notes appear here once they are added and approved by the teacher." : "Notes appear here as soon as they are added."}
          action={allowed ? <ButtonLink href={`/classes/${id}/new`} variant="secondary">Add the first note</ButtonLink> : undefined} /></Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => <li key={n.id}><NoteCard n={n} href={`/classes/${id}/notebook/${n.id}`} /></li>)}
        </ul>
      )}
    </div>
  );
}
