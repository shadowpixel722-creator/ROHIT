import { NotebookPen } from "lucide-react";
import { notFound } from "next/navigation";
import { NoteCard } from "@/components/notes/note-card";
import { ButtonLink, Card, EmptyState } from "@/components/ui";
import { getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { noteCards } from "@/lib/note-queries";
import { canUpload } from "@/lib/notes";

export const metadata = { title: "My notes" };

export default async function MyNotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const access = await getClassAccess(user.id, id);
  if (!access) notFound();
  const notes = await noteCards({ classroomId: id, authorId: user.id });
  if (notes.length === 0)
    return (
      <Card>
        {canUpload(access) ? (
          <EmptyState icon={<NotebookPen className="size-5" />} title="You haven't added any notes yet"
            description={access.kind === "CLASS" ? "Photograph your notebook pages or type your notes. Your teacher approves them before the class sees them." : "Photograph your notebook pages or type your notes. They appear here straight away."}
            action={<ButtonLink href={`/classes/${id}/new`}>Add a note</ButtonLink>} />
        ) : (
          <EmptyState icon={<NotebookPen className="size-5" />} title="You can't add notes yet"
            description="Your teacher chooses which students can add notes. You can read and discuss every approved note in the Notebook tab." />
        )}
      </Card>
    );
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((n) => <li key={n.id}><NoteCard n={n} href={`/classes/${id}/notebook/${n.id}`} showStatus /></li>)}
    </ul>
  );
}
