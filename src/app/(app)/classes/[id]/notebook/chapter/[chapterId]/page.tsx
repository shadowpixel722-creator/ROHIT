import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormattedText } from "@/components/notes/formatted-text";
import { PageThumb } from "@/components/notes/gallery";
import { ChapterToolbar } from "@/components/notes/chapter-toolbar";
import { tidyPageText } from "@/lib/tidy";
import { Badge, Card, Chevron, EmptyState, SubjectDot } from "@/components/ui";
import { getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { markChapterSeen } from "@/lib/chapter-news";
import { subjectColor } from "@/lib/constants";
import { db } from "@/lib/db";
import { imageSrc } from "@/lib/note-queries";

export const metadata = { title: "Chapter notes" };

const fmtDay = (d: Date) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
const fmt = (d: Date) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);

/** All approved notes for one chapter, in the order they were added, with new ones marked. */
export default async function ChapterPage({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const { id, chapterId } = await params;
  const user = await requireUser();
  if (!(await getClassAccess(user.id, id))) notFound();
  const chapter = await db.chapter.findFirst({ where: { id: chapterId, subject: { classroomId: id } }, include: { subject: { select: { id: true, name: true, color: true } } } });
  if (!chapter) notFound();
  const notes = await db.note.findMany({
    where: { classroomId: id, chapterId, status: "APPROVED" },
    orderBy: [{ lessonDate: "asc" }, { createdAt: "asc" }],
    include: { author: { select: { name: true, role: true } }, images: { orderBy: { position: "asc" } } },
  });
  const lastSeen = await markChapterSeen(user.id, chapterId);
  const isNew = (n: (typeof notes)[number]) => n.authorId !== user.id && (n.reviewedAt ?? n.createdAt) > lastSeen;
  const newCount = notes.filter(isNew).length;

  const dateOf = (n: (typeof notes)[number]) => (n.lessonDate ? fmtDay(n.lessonDate) : fmt(n.createdAt));

  return (
    <div className="space-y-4">
      <Link href={`/classes/${id}/notebook?subject=${chapter.subject.id}&chapter=${chapterId}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text print:hidden">
        <ArrowLeft className="size-4" /> Back to notes
      </Link>
      <div>
        <p className="flex items-center gap-2 text-sm text-muted"><SubjectDot color={subjectColor(chapter.subject.color)} /> {chapter.subject.name}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{chapter.name}</h2>
        <p className="mt-1 text-sm text-muted">
          {notes.length} note{notes.length === 1 ? "" : "s"}, in date order. Tap a note to open or close it.
          {newCount > 0 && <span className="print:hidden"> <Badge tone="primary">{newCount} new since your last visit</Badge></span>}
        </p>
      </div>

      {notes.length === 0 ? (
        <Card><EmptyState icon={<FileText className="size-5" />} title="No approved notes for this chapter yet" description="When notes are added and approved, they'll be combined here." /></Card>
      ) : (
        <>
          <ChapterToolbar targetId="chapter-body" />
          <Card className="p-4 sm:p-5 print:border-0 print:p-0 print:shadow-none" data-testid="chapter-toc">
            <p className="mb-2 text-sm font-semibold">Contents</p>
            <ol className="space-y-1 text-sm">
              {notes.map((n, i) => (
                <li key={n.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="w-5 shrink-0 text-right text-faint tabular-nums">{i + 1}.</span>
                  <a href={`#note-${n.id}`} className="font-medium hover:underline">{n.title}</a>
                  <span className="text-xs text-muted">{dateOf(n)} · {n.author.name} · {n.images.length} page{n.images.length === 1 ? "" : "s"}</span>
                  {isNew(n) && <span className="print:hidden"><Badge tone="primary">New</Badge></span>}
                </li>
              ))}
            </ol>
          </Card>
          <ol className="space-y-4" id="chapter-body">
            {notes.map((n) => {
              const tidyState = { lastDate: null as string | null };
              return (
                <li key={n.id} id={`note-${n.id}`} className="scroll-mt-24 print:break-inside-auto">
                  <Card className={`${isNew(n) ? "ring-2 ring-primary/40 print:ring-0" : ""} print:border-0 print:shadow-none`} data-testid="chapter-note">
                    <details open={notes.length <= 3 || isNew(n)} className="group/note">
                    <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-5 py-3 group-open/note:border-b group-open/note:border-border print:px-0">
                      <Link href={`/classes/${id}/notebook/${n.id}`} className="font-medium hover:underline">{n.title}</Link>
                      {isNew(n) && <span className="print:hidden"><Badge tone="primary">New</Badge></span>}
                      <span className="ml-auto text-xs text-muted">{n.author.name}{n.author.role === "TEACHER" ? " (teacher)" : ""} · {dateOf(n)}</span>
                      <Chevron className="size-4 print:hidden" />
                    </summary>
                    <div className="space-y-4 px-5 py-4 print:px-0">
                      {n.images.map((img, idx) => {
                        const all = n.images.map((x) => ({ id: x.id, src: imageSrc(x), width: x.width, height: x.height }));
                        return (
                          <section key={img.id} className="grid gap-3 sm:grid-cols-[96px_minmax(0,1fr)] print:block" data-testid="chapter-page">
                            <div className="chapter-photo"><PageThumb images={all} index={idx} title={n.title} className="aspect-[3/4] w-24 print:w-40" /></div>
                            <div className="min-w-0">
                              <p className="mb-1 text-[11px] font-medium tracking-wide text-faint uppercase">
                                Page {idx + 1}{img.transcriptSource === "AI" ? " · converted by AI" : img.transcriptSource === "TEACHER" ? " · checked by teacher" : !img.convert ? " · not converted" : " · no text yet"}
                              </p>
                              {img.transcript ? <FormattedText text={tidyPageText(img.transcript, tidyState)} /> : <p className="text-sm text-faint">View the page image for this page.</p>}
                            </div>
                          </section>
                        );
                      })}
                      {n.text && (
                        <section>
                          <p className="mb-1 text-[11px] font-medium tracking-wide text-faint uppercase">Typed notes</p>
                          <FormattedText text={n.text} />
                        </section>
                      )}
                    </div>
                    </details>
                  </Card>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
