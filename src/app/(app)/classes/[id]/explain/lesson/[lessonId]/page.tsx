import { notFound } from "next/navigation";
import { LessonPlayer } from "@/components/knowa/lesson-player";
import { getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { LESSON_BY_ID } from "@/lib/knowa/lessons";

export const metadata = { title: "3D lesson" };

/** A narrated 3D lesson, for any member of the class. Fixed content: no AI and nothing about the student is sent anywhere. */
export default async function LessonPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params;
  const user = await requireUser();
  if (!(await getClassAccess(user.id, id))) notFound();
  const lesson = LESSON_BY_ID[lessonId];
  if (!lesson) notFound();
  return <LessonPlayer lesson={lesson} backHref={`/classes/${id}/explain`} backLabel="Explain" classroomId={id} />;
}
