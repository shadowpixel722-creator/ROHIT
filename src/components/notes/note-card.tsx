import { FileText, Images, MessageSquare, Paperclip } from "lucide-react";
import Link from "next/link";
import { subjectColor } from "@/lib/constants";
import type { NoteCardData } from "@/lib/note-queries";
import { Badge } from "../ui";
import { StatusBadge } from "./status-badge";

const date = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(iso));

export function NoteCard({ n, href, showStatus }: { n: NoteCardData; href: string; showStatus?: boolean }) {
  return (
    <Link href={href} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-colors hover:border-border-strong" data-testid="note-card">
      <div className="relative aspect-[4/3] bg-surface-2">
        {n.cover ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={n.cover} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col gap-1 overflow-hidden p-4 text-xs leading-relaxed text-muted"><FileText className="mb-1 size-5 text-primary" />{n.textPreview}</div>
        )}
        <span className="absolute top-2 left-2 size-2.5 rounded-full ring-2 ring-surface" style={{ background: subjectColor(n.subjectColor) }} />
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <p className="line-clamp-2 font-medium group-hover:underline">{n.title}</p>
        <p className="mt-1 truncate text-xs text-muted">{n.subjectName}{n.chapterName && ` · ${n.chapterName}`}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-xs text-faint">
          <span className="truncate">{n.authorName}</span>
          {n.authorIsTeacher && <Badge tone="primary">Teacher</Badge>}
          <span title={n.lessonDate ? "Date of the notes" : "Date added"}>· {date(n.lessonDate ?? n.createdAt)}</span>
          {n.pages > 0 && <span className="inline-flex items-center gap-0.5"><Images className="size-3" />{n.pages}</span>}
          {n.comments > 0 && <span className="inline-flex items-center gap-0.5"><MessageSquare className="size-3" />{n.comments}</span>}
          {n.attachments > 0 && <span className="inline-flex items-center gap-0.5" title="Attachments"><Paperclip className="size-3" />{n.attachments}</span>}
        </div>
        {showStatus && <div className="mt-2"><StatusBadge status={n.status} /></div>}
        {showStatus && n.status === "REJECTED" && n.rejectReason && <p className="mt-1.5 text-xs text-danger">“{n.rejectReason}”</p>}
      </div>
    </Link>
  );
}
