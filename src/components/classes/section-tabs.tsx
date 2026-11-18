"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../ui";
import { activeItem, classSections, parseClassPath } from "./class-nav";

/**
 * Inside a class: the current section's title and its pages as sub-tabs (for example Practise →
 * Study · Flashcards · Mistake Map). Keeps one short row instead of every page in the class.
 */
export function SectionTabs({ classroomId, teacher, pending }: { classroomId: string; teacher: boolean; pending: number }) {
  const path = usePathname();
  const parsed = parseClassPath(path);
  const sections = classSections(teacher);
  const { section, item } = activeItem(sections, parsed?.rest ?? "");
  const base = `/classes/${classroomId}`;
  return (
    <nav aria-label={`${section.label} pages`} className="print:hidden" data-testid="section-tabs">
      <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {section.items.map((i) => {
          const on = i === item;
          return (
            <Link key={i.slug} href={i.slug ? `${base}/${i.slug}` : base} prefetch={false} aria-current={on ? "page" : undefined}
              className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                on ? "border-primary/30 bg-primary-soft text-primary" : "border-border bg-surface text-muted hover:border-border-strong hover:text-text")}>
              <i.Icon className="size-4" aria-hidden />
              {i.label}
              {i.slug === "review" && pending > 0 && <span className="rounded-full bg-warn-soft px-1.5 text-[11px] font-semibold text-warn">{pending}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
