import { ArrowLeft, Download, FileText, Paperclip, Pencil } from "lucide-react";
import { ReadAloud } from "@/components/speech";
import { formatBytes, kindLabel } from "@/lib/attachment-check";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Comments } from "@/components/notes/comments";
import { DeleteNote } from "@/components/notes/delete-note";
import { Gallery } from "@/components/notes/gallery";
import { ReviewActions } from "@/components/notes/review-actions";
import { StatusBadge } from "@/components/notes/status-badge";
import { Badge, ButtonLink, Card, Collapsible, SubjectDot } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { subjectColor } from "@/lib/constants";
import { db } from "@/lib/db";
import { imageSrc } from "@/lib/note-queries";
import { canEdit, canUpload, getVisibleNote } from "@/lib/notes";
import { aiEnabled } from "@/lib/transcribe";
import { PageTexts } from "@/components/notes/page-texts";
import { FormattedText } from "@/components/notes/formatted-text";

export const metadata = { title: "Note" };

export default async function NotePage({ params }: { params: Promise<{ id: string; noteId: string }> }) {
  const { id, noteId } = await params;
  const user = await requireUser();
  const r = await getVisibleNote(user.id, noteId);
  if (!r || r.note.classroomId !== id) notFound();
  const { access } = r;
  const note = await db.note.findUniqueOrThrow({
    where: { id: noteId },
    include: {
      author: { select: { name: true, role: true } },
      subject: { select: { id: true, name: true, color: true } },
      chapter: { select: { id: true, name: true } },
      images: { orderBy: { position: "asc" } },
      attachments: { orderBy: { position: "asc" }, select: { id: true, fileName: true, size: true } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, role: true } } } },
    },
  });
  const teacher = access.role === "TEACHER";
  const editable = canEdit(note, access.role, user.id);
  const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: note.lessonDate ? "UTC" : undefined }).format(note.lessonDate ?? note.createdAt);

  return (
    <div className="space-y-4">
      <Link href={`/classes/${id}/notebook?subject=${note.subject.id}${note.chapter ? `&chapter=${note.chapter.id}` : ""}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" /> {note.subject.name}{note.chapter && ` · ${note.chapter.name}`}
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">{note.title}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <SubjectDot color={subjectColor(note.subject.color)} /> {note.subject.name}{note.chapter && ` · ${note.chapter.name}`} · {note.author.name}
            {note.author.role === "TEACHER" && <Badge tone="primary">Teacher</Badge>} · <span data-testid="lesson-date">Notes from {date}</span>
          </p>
          {note.status !== "APPROVED" && <div className="mt-2"><StatusBadge status={note.status} /></div>}
        </div>
        {editable && (
          <div className="flex shrink-0 gap-1">
            {canUpload(access) && <ButtonLink href={`/classes/${id}/notebook/${noteId}/edit`} variant="secondary"><Pencil className="size-4" /> Edit</ButtonLink>}
            <DeleteNote noteId={noteId} />
          </div>
        )}
      </div>

      {note.status === "REJECTED" && note.rejectReason && (
        <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          <span className="font-medium">Teacher&apos;s feedback:</span> {note.rejectReason}
          {note.authorId === user.id && " Edit the note to fix it, and it will be sent for approval again."}
        </div>
      )}
      {note.status === "PENDING" && !teacher && <div className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">Only you and your teacher can see this note until it&apos;s approved.</div>}
      {teacher && note.status !== "APPROVED" && (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">{note.status === "PENDING" ? "Check the pages for accuracy and personal details, then approve or ask for changes." : "You asked for changes on this note."}</p>
          <ReviewActions noteId={noteId} status={note.status} />
        </Card>
      )}

      {note.images.length > 0 && <Gallery title={note.title} images={note.images.map((i) => ({ id: i.id, src: imageSrc(i), width: i.width, height: i.height }))} />}
      {note.images.length > 0 && (teacher ? note.status === "APPROVED" : true) && (
        <PageTexts noteId={noteId} title={note.title} teacher={teacher} aiOn={aiEnabled()} approved={note.status === "APPROVED"}
          pages={note.images.map((i) => ({ id: i.id, src: imageSrc(i), width: i.width, height: i.height, transcript: i.transcript, status: i.transcriptStatus, source: i.transcriptSource, error: i.transcriptError, convert: i.convert }))} />
      )}
      {note.text && (
        <Collapsible title="Typed notes" defaultOpen><div className="-mt-1 mb-2 flex justify-end"><ReadAloud text={note.text} label="Read these notes aloud" /></div><div data-testid="note-text"><FormattedText text={note.text} /></div></Collapsible>
      )}
      {note.attachments.length > 0 && (
        <Collapsible icon={<Paperclip className="size-5" />} title={`Attachments (${note.attachments.length})`} defaultOpen data-testid="note-attachments">
          {teacher && note.status !== "APPROVED" && <p className="mb-2 text-xs text-warn">Open each file before approving: check it for names, phone numbers or other personal details (file properties can include the author&apos;s name).</p>}
          <ul className="divide-y divide-border rounded-xl border border-border">
            {note.attachments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm" data-testid="note-attachment">
                <FileText className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate font-medium">{a.fileName}</span>
                <span className="text-xs text-muted">{kindLabel(a.fileName)} · {formatBytes(a.size)}</span>
                <a href={`/api/attachments/${a.id}`} download={a.fileName} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-2" aria-label={`Download ${a.fileName}`}>
                  <Download className="size-3.5" /> Download
                </a>
              </li>
            ))}
          </ul>
        </Collapsible>
      )}
      {note.status === "APPROVED" && note.chapter && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium">
          <a href={`/classes/${id}/explain/${note.chapter.id}#lesson-${note.id}`} className="text-primary hover:underline">Explain this lesson →</a>
          <a href={`/classes/${id}/notebook/chapter/${note.chapter.id}`} className="text-primary hover:underline">Read all notes for {note.chapter.name} →</a>
        </div>
      )}

      {note.status === "APPROVED" && (
        <Collapsible title={`Discussion (${note.comments.length})`} meta={note.comments.length ? undefined : "Ask a question about this note"} defaultOpen>
          {teacher && <div className="mb-3 flex justify-end"><ReviewActions noteId={noteId} status={note.status} compact /></div>}
          <div>
            <Comments noteId={noteId} canModerate={teacher} comments={note.comments.map((c) => ({
              id: c.id, body: c.body, authorName: c.author.name, authorIsTeacher: c.author.role === "TEACHER", mine: c.authorId === user.id, createdAt: c.createdAt.toISOString(),
            }))} />
          </div>
        </Collapsible>
      )}
    </div>
  );
}
