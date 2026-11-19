import { notFound } from "next/navigation";
import { NoteForm } from "@/components/notes/note-form";
import { getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { formSubjects } from "@/lib/note-queries";
import { canUpload } from "@/lib/notes";

export const metadata = { title: "Add note" };

export default async function NewNotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ subject?: string }> }) {
  const [{ id }, sp, user] = await Promise.all([params, searchParams, requireUser()]);
  const access = await getClassAccess(user.id, id);
  if (!access) notFound();
  const teacher = access.role === "TEACHER";
  const subjects = canUpload(access) ? await formSubjects(id) : [];
  return <NoteForm classroomId={id} subjects={subjects} teacher={teacher} room={access.kind !== "CLASS"} defaultSubjectId={subjects.some((s) => s.id === sp.subject) ? sp.subject : undefined} />;
}
