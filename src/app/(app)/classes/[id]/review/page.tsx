import { CheckCheck, ShieldAlert } from "lucide-react";
import { formatBytes } from "@/lib/attachment-check";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewActions } from "@/components/notes/review-actions";
import { Badge, Card, EmptyState, SubjectDot } from "@/components/ui";
import { getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { subjectColor } from "@/lib/constants";
import { db } from "@/lib/db";
import { imageSrc } from "@/lib/note-queries";

export const metadata = { title: "Review" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const access = await getClassAccess(user.id, id);
  if (!access || access.role !== "TEACHER") notFound();
  const [pending, members] = await Promise.all([
    db.note.findMany({
      where: { classroomId: id, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { name: true } }, subject: { select: { name: true, color: true } }, chapter: { select: { name: true } }, images: { orderBy: { position: "asc" }, select: { id: true, width: true, height: true, size: true } }, attachments: { orderBy: { position: "asc" }, select: { id: true, fileName: true, size: true } } },
    }),
    db.membership.findMany({ where: { classroomId: id }, select: { userId: true, consentVerifiedAt: true } }),
  ]);
  const consent = new Map(members.map((m) => [m.userId, !!m.consentVerifiedAt]));

  if (pending.length === 0)
    return <Card><EmptyState icon={<CheckCheck className="size-5" />} title="All caught up" description="New notes from students will appear here for you to approve." /></Card>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{pending.length} note{pending.length === 1 ? "" : "s"} waiting, oldest first. Check each one, including any attachments, for accuracy and for personal details such as faces, names or phone numbers.</p>
      {pending.map((n) => {
        const ok = consent.get(n.authorId);
        return (
          <Card key={n.id} className="p-4" data-testid="review-item">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/classes/${id}/notebook/${n.id}`} className="font-medium hover:underline">{n.title}</Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <SubjectDot color={subjectColor(n.subject.color)} className="size-2" /> {n.subject.name}{n.chapter && ` · ${n.chapter.name}`} · by {n.author.name}
                </p>
              </div>
              {!ok && <Badge tone="warn"><ShieldAlert className="size-3" /> Consent form not confirmed</Badge>}
            </div>
            {n.images.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {n.images.map((img, i) => (
                  <Link key={img.id} href={`/classes/${id}/notebook/${n.id}`} className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageSrc(img)} alt={`Page ${i + 1}`} className="h-36 w-28 rounded-lg border border-border object-cover" loading="lazy" />
                  </Link>
                ))}
              </div>
            )}
            {n.text && <p className="mt-3 line-clamp-3 rounded-lg bg-surface-2 p-3 text-xs text-muted whitespace-pre-wrap">{n.text}</p>}
            {n.attachments.length > 0 && (
              <div className="mt-3 rounded-lg border border-border p-2.5 text-xs" data-testid="review-attachments">
                <p className="mb-1 font-medium text-warn">{n.attachments.length} attachment{n.attachments.length === 1 ? "" : "s"}: open each one and check it for personal details before approving.</p>
                <ul className="space-y-0.5">
                  {n.attachments.map((a) => (
                    <li key={a.id}><a href={`/api/attachments/${a.id}`} download={a.fileName} className="text-primary hover:underline">{a.fileName}</a> <span className="text-muted">· {formatBytes(a.size)}</span></li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-3"><ReviewActions noteId={n.id} status={n.status} compact /></div>
          </Card>
        );
      })}
    </div>
  );
}
