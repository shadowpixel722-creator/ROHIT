import { notFound } from "next/navigation";
import { LessonPlayer } from "@/components/knowa/lesson-player";
import { requireUser } from "@/lib/auth";
import { LESSON_BY_ID } from "@/lib/knowa/lessons";

export const metadata = { title: "3D lesson" };

/** A narrated 3D lesson outside any class. Fixed content: no AI and nothing about the student is sent anywhere. */
export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  await requireUser();
  const lesson = LESSON_BY_ID[lessonId];
  if (!lesson) notFound();
  return <LessonPlayer lesson={lesson} backHref="/lessons" backLabel="All 3D lessons" />;
}
