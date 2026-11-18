import { ArrowLeft, BookOpen, CalendarDays, Download, FileText, Lightbulb, Paperclip } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/exam-patterns/pattern-editor";
import { Card } from "@/components/ui";
import { getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { formatBytes, kindLabel } from "@/lib/attachment-check";
import { countdown, kindColor, kindLabel as assessmentKind } from "@/lib/assessments";
import { dateToKey, daysBetween, formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { getToday } from "@/lib/server";
import { QUESTION_TYPES, totalMarks, totalQuestions, type Pattern } from "@/lib/exam-schema";

export const metadata = { title: "Exam pattern" };

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** An exam pattern: the lessons it covers and how it is set out, section by section. Everyone in the class can see it. */
export default async function PatternPage({ params }: { params: Promise<{ id: string; patternId: string }> }) {
  const { id, patternId } = await params;
  const user = await requireUser();
  const access = await getClassAccess(user.id, id);
  if (!access) notFound();
  const pattern = await db.examPattern.findFirst({ where: { id: patternId, classroomId: id }, include: { attachments: { orderBy: { position: "asc" }, select: { id: true, fileName: true, size: true } } } });
  if (!pattern) notFound();
  const sections = JSON.parse(pattern.sections) as Pattern["sections"];
  const [today, dates] = await Promise.all([
    getToday(),
    db.assessment.findMany({ where: { patternId, classroomId: id }, orderBy: { date: "asc" }, select: { id: true, kind: true, title: true, date: true, subject: { select: { name: true } } } }),
  ]);
  const lessons = await db.chapter.findMany({
    where: { examPatterns: { some: { patternId } } },
    orderBy: [{ subject: { position: "asc" } }, { position: "asc" }],
    select: { id: true, name: true, subject: { select: { id: true, name: true } } },
  });
  const bySubject = [...lessons.reduce((m, c) => m.set(c.subject.id, { id: c.subject.id, name: c.subject.name, chapters: [...(m.get(c.subject.id)?.chapters ?? []), c] }), new Map<string, { id: string; name: string; chapters: typeof lessons }>()).values()];
  const total = totalMarks(sections);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/classes/${id}/exam-patterns`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" /> Exam patterns</Link>
        <PrintButton />
      </div>
      <Card className="p-5 sm:p-8 print:border-0 print:p-0 print:shadow-none" data-testid="pattern-sheet">
        <header className="border-b border-border pb-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Exam pattern</p>
          <h2 className="mt-1 text-xl font-semibold">{pattern.name}</h2>
          <p className="mt-1 text-sm text-muted">{access.classroom.name}{access.classroom.grade ? ` · Class ${access.classroom.grade}` : ""}</p>
          <p className="mt-2 flex justify-between text-sm font-medium"><span>Time: {pattern.durationMinutes} minutes</span><span data-testid="pattern-sheet-marks">Maximum marks: {num(total)}</span></p>
        </header>
        {dates.length > 0 && (
          <section className="mt-4 print:hidden" data-testid="pattern-dates">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold"><CalendarDays className="size-4 text-primary" /> On the calendar</h3>
            <ul className="mt-1.5 space-y-1 text-sm">
              {dates.map((a) => {
                const key = dateToKey(a.date);
                return (
                  <li key={a.id} className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: kindColor(a.kind) }} aria-hidden />
                    <Link href={`/classes/${id}/calendar?m=${key.slice(0, 7)}#a-${a.id}`} className="font-medium hover:underline">{a.title}</Link>
                    <span className="text-xs text-muted">{assessmentKind(a.kind)} · {a.subject.name} · {formatDate(key, { weekday: "short", day: "numeric", month: "short" })} · {countdown(daysBetween(today, key))}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <section className="mt-4" data-testid="pattern-lessons">
          <h3 className="text-sm font-semibold">Portion (syllabus) for this exam</h3>
          <p className="text-xs text-muted print:hidden">Open a lesson&apos;s explanation (summary, key points, simple explanation) or the class notes.</p>
          {bySubject.length === 0 ? <p className="mt-1 text-sm text-muted">No lessons chosen yet.</p> : bySubject.map((s) => (
            <div key={s.id} className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{s.name}</p>
              <ol className="mt-1 divide-y divide-border rounded-xl border border-border print:divide-y-0 print:border-0">
                {s.chapters.map((c, i) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm print:px-0 print:py-0.5" data-testid="portion-lesson">
                    <span className="min-w-0 flex-1"><span className="text-muted">{i + 1}.</span> <span className="font-medium" data-testid="pattern-lesson">{c.name}</span></span>
                    <span className="flex gap-1 print:hidden">
                      <Link href={`/classes/${id}/explain/${c.id}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft"><Lightbulb className="size-3.5" /> Explanation</Link>
                      <Link href={`/classes/${id}/notebook?subject=${s.id}&chapter=${c.id}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft"><BookOpen className="size-3.5" /> Notes</Link>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>
        {pattern.instructions && <p className="mt-4 text-sm"><span className="font-semibold">General instructions:</span> {pattern.instructions}</p>}
        {pattern.attachments.length > 0 && (
          <section className="mt-4 print:hidden">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Paperclip className="size-4 text-primary" /> Attachments</h3>
            <ul className="mt-1.5 divide-y divide-border rounded-xl border border-border" data-testid="pattern-attachments">
              {pattern.attachments.map((f) => (
                <li key={f.id}>
                  <a href={`/api/pattern-files/${f.id}`} download className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-2">
                    <FileText className="size-4 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate">{f.fileName}</span>
                    <span className="text-xs text-muted">{kindLabel(f.fileName)} · {formatBytes(f.size)}</span>
                    <Download className="size-4 text-faint" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="py-2 pr-3 font-medium">Section</th>
                <th className="py-2 pr-3 font-medium">Type of questions</th>
                <th className="py-2 pr-3 text-right font-medium">Questions</th>
                <th className="py-2 pr-3 text-right font-medium">Marks each</th>
                <th className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((s, i) => (
                <tr key={i} className="border-b border-border align-top" data-testid="pattern-row">
                  <td className="py-2.5 pr-3 font-medium">{s.name}</td>
                  <td className="py-2.5 pr-3">{QUESTION_TYPES[s.type]}{s.note && <span className="block text-xs text-muted">{s.note}</span>}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{s.count}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{num(s.marks)}</td>
                  <td className="py-2.5 text-right tabular-nums">{num(s.count * s.marks)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="py-2.5 pr-3" colSpan={2}>Total</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{totalQuestions(sections)}</td>
                <td />
                <td className="py-2.5 text-right tabular-nums">{num(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <ul className="mt-4 space-y-1 text-xs text-muted">
          {Object.entries(sections.reduce<Record<string, number>>((m, s) => ({ ...m, [s.type]: (m[s.type] ?? 0) + s.count * s.marks }), {})).map(([type, marks]) => (
            <li key={type}>{QUESTION_TYPES[type as Pattern["sections"][number]["type"]]}: {num(marks)} marks ({Math.round((marks / total) * 100)}%)</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
