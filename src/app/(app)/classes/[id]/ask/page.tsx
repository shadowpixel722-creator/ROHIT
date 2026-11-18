import { notFound } from "next/navigation";
import { Tutor } from "@/components/tutor";
import { getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiEnabled } from "@/lib/transcribe";

export const metadata = { title: "Ask" };

export default async function AskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const access = await getClassAccess(user.id, id);
  if (!access) notFound();
  const teacher = access.role === "TEACHER";
  const blocked = !access.classroom.aiTutor ? (teacher ? "The AI tutor is switched off for this class. Switch it on in Settings → this class." : "Your teacher has switched the AI tutor off for this class.")
    : !teacher && !access.membership?.consentVerifiedAt ? "Your teacher needs to confirm your parent/guardian consent form before you can use the AI tutor. Ask your teacher."
    : !aiEnabled() ? "AI is off right now, so the tutor can't answer." : null;
  const topics = await db.chapter.findMany({ where: { subject: { classroomId: id }, notes: { some: { status: "APPROVED" } } }, orderBy: { position: "asc" }, take: 8, select: { name: true } });
  return <Tutor classroomId={id} blocked={blocked} topics={topics.map((t) => t.name.replace(/^\s*(?:part\s*\d+\s*·\s*)?\d+\.\s*/i, ""))} />;
}
