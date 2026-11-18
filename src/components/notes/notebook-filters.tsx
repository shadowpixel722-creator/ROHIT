"use client";

import { useRef } from "react";
import { Button, Field, Select } from "../ui";

type Subject = { id: string; name: string; chapters: { id: string; name: string; fresh: number }[] };

/**
 * Subject and chapter dropdowns for the notebook. Picking one reloads the page with the filter (a plain
 * GET form, so it also works before scripts load: the Apply button is shown only without JavaScript).
 * Choosing a new subject clears the chapter.
 */
export function NotebookFilters({ action, subjects, subjectId, chapterId, q }: { action: string; subjects: Subject[]; subjectId: string; chapterId: string; q: string }) {
  const form = useRef<HTMLFormElement>(null);
  const chapter = useRef<HTMLSelectElement>(null);
  const subject = subjects.find((s) => s.id === subjectId);
  const submit = () => form.current?.requestSubmit();
  return (
    <form ref={form} action={action} method="get" className="grid gap-3 sm:grid-cols-2" data-testid="notebook-filters">
      {q && <input type="hidden" name="q" value={q} />}
      <Field label="Subject" htmlFor="nb-subject">
        <Select id="nb-subject" name="subject" defaultValue={subjectId} onChange={() => { if (chapter.current) chapter.current.value = ""; submit(); }}>
          <option value="">All subjects</option>
          {subjects.map((s) => {
            const fresh = s.chapters.reduce((n, c) => n + c.fresh, 0);
            return <option key={s.id} value={s.id}>{s.name}{fresh ? ` (${fresh} new)` : ""}</option>;
          })}
        </Select>
      </Field>
      <Field label="Chapter" htmlFor="nb-chapter">
        <Select id="nb-chapter" name="chapter" ref={chapter} defaultValue={chapterId} disabled={!subject || subject.chapters.length === 0} onChange={submit}>
          <option value="">{subject ? "All chapters" : "Choose a subject first"}</option>
          {subject?.chapters.map((c) => <option key={c.id} value={c.id}>{c.name}{c.fresh ? ` (${c.fresh} new)` : ""}</option>)}
        </Select>
      </Field>
      <noscript><Button type="submit" size="sm" variant="secondary">Apply</Button></noscript>
    </form>
  );
}
