import Link from "next/link";
import { LessonCards } from "@/components/knowa/lesson-cards";
import { cn, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { LESSONS, lessonsForGrade } from "@/lib/knowa/lessons";

export const metadata = { title: "3D lessons" };

/** Every class level some lesson is written for, lowest first. */
const LEVELS = [...new Set(LESSONS.flatMap((l) => l.classes))].sort((a, b) => a - b).map(String);

/**
 * The narrated 3D lessons for everyone signed in, with or without a class. They are fixed content: no AI,
 * and nothing about the student is sent anywhere. Filter by class level (`?class=8`); a student whose
 * classes are all one level starts on that level.
 */
export default async function LessonsPage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  const user = await requireUser();
  const asked = (await searchParams).class;
  let level: string | null = asked === "all" ? null : asked && LEVELS.includes(asked) ? asked : null;
  if (asked === undefined) {
    const grades = await db.classroom.findMany({
      where: { OR: [{ teacherId: user.id }, { members: { some: { userId: user.id, status: "ACTIVE" } } }], grade: { not: null } },
      select: { grade: true }, distinct: ["grade"],
    });
    level = grades.length === 1 && LEVELS.includes(grades[0].grade!) ? grades[0].grade : null;
  }
  const lessons = lessonsForGrade(level);
  const subjects = [...new Set(lessons.map((l) => l.subject))];
  const chip = (value: string, label: string, on: boolean) => (
    <Link key={value} href={`/lessons?class=${value}`} aria-current={on ? "page" : undefined}
      className={cn("rounded-full border px-3 py-1 text-sm font-medium", on ? "border-primary/30 bg-primary-soft text-primary" : "border-border text-muted hover:text-text")}>
      {label}
    </Link>
  );
  return (
    <div className="space-y-6" data-testid="lessons-page">
      <PageHeader title="3D lessons" description="Narrated lessons: the tutor talks you through a 3D model, moves it and writes notes as it goes. Take over the model any time, then try the quick check. You don't need a class for these." />
      <nav aria-label="Class level" className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Class:</span>
        {chip("all", "All", level === null)}
        {LEVELS.map((g) => chip(g, g, level === g))}
      </nav>
      {subjects.map((s) => (
        <section key={s} className="space-y-2">
          <h2 className="text-base font-semibold">{s}</h2>
          <LessonCards lessons={lessons.filter((l) => l.subject === s)} basePath="/lessons" />
        </section>
      ))}
    </div>
  );
}
