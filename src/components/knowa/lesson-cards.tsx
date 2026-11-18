import { Atom, Binary, Box, Calculator, Code2, Globe2, Microscope, PenLine, ScanEye, Shapes, Sigma, Triangle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { Lesson } from "@/lib/knowa/lessons";

const ICON: Record<string, LucideIcon> = {
  mensuration: Box, pythag: Triangle, solids: Shapes, atom: Atom, cell: Microscope, molecule: Sigma, lens: ScanEye,
  seasons: Globe2, quad: Calculator, binary: Binary, pyfor: Code2, voice: PenLine,
};

/** A grid of narrated 3D lessons. */
export function LessonCards({ lessons, classroomId }: { lessons: Lesson[]; classroomId: string }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="lesson-cards">
      {lessons.map((l) => {
        const Icon = ICON[l.id] ?? Box;
        return (
          <li key={l.id}>
            <Link href={`/classes/${classroomId}/explain/lesson/${l.id}`} data-testid="lesson-card"
              className="group flex h-full gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-primary/40">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#0d1530] text-[#9db3ff] group-hover:bg-[#13203f]"><Icon className="size-5" aria-hidden /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-snug">{l.title}</span>
                <span className="mt-0.5 block text-xs text-muted">{l.blurb}</span>
                <span className="mt-1.5 block text-[11px] font-medium text-faint">{l.subject} · {l.steps.length} steps · 3D</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
