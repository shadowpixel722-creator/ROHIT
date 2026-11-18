import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { countdown, kindLabel } from "@/lib/assessments";
import type { AssessmentRow } from "@/lib/study";
import { Card, CardHeader, cn } from "../ui";
import { ReadinessBadge } from "./readiness-badge";

/** Reminders for a student: dates in the next week with how ready they are, worked out from their own quizzes. */
export function UpcomingCard({ classroomId, rows }: { classroomId: string; rows: AssessmentRow[] }) {
  if (rows.length === 0) return null;
  return (
    <Card data-testid="upcoming-card">
      <CardHeader icon={<CalendarClock className="size-5" />} title="Coming up" description="Practise the chapters before the date." />
      <ul className="divide-y divide-border px-5 pb-3">
        {rows.map((r) => {
          const next = r.chapters.find((c) => c.percent === null) ?? [...r.chapters].sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0];
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.title} <span className="font-normal text-muted">· {kindLabel(r.kind)} · {r.subjectName}</span></p>
                <p className={cn("text-sm", r.days <= 3 ? "font-medium text-warn" : "text-muted")}>{countdown(r.days)}</p>
                {next && r.level !== "READY" && (
                  <p className="text-xs text-muted">
                    {next.percent === null ? "You haven't taken a quiz on " : "Practise more: "}
                    <Link href={`/classes/${classroomId}/study/${next.id}`} className="font-medium text-primary hover:underline">{next.name}</Link>
                  </p>
                )}
              </div>
              <ReadinessBadge percent={r.percent} level={r.level} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** A short banner on the class Overview when a date is 3 days away or less and the student isn't ready yet. */
export function UrgentBanner({ classroomId, rows }: { classroomId: string; rows: AssessmentRow[] }) {
  const urgent = rows.filter((r) => r.days <= 3 && r.level !== "READY");
  if (urgent.length === 0) return null;
  const first = urgent[0];
  return (
    <Link href={`/classes/${classroomId}/calendar`} data-testid="urgent-banner" className="block rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn print:hidden">
      <strong>{first.title}</strong> ({kindLabel(first.kind)}) is {countdown(first.days).toLowerCase()}
      {first.percent === null ? ". You haven't taken a practice quiz yet." : ` and you're at ${first.percent}%.`}
      {urgent.length > 1 && ` ${urgent.length - 1} more coming up.`} <span className="underline">See the calendar</span>
    </Link>
  );
}
