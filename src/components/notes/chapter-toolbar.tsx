"use client";

import { ChevronDown, ChevronsDownUp, ChevronsUpDown, ChevronUp, Printer, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input } from "../ui";

type HighlightRegistry = { set: (name: string, h: unknown) => void; delete: (name: string) => void };
declare const Highlight: { new (...ranges: Range[]): unknown };

/**
 * Search within the combined chapter (highlights every match, with next/previous) and
 * Print / Save as PDF. Searching uses the CSS Custom Highlight API, so the page's HTML is never modified.
 */
export function ChapterToolbar({ targetId }: { targetId: string }) {
  const [q, setQ] = useState("");
  const [ranges, setRanges] = useState<Range[]>([]);
  const [current, setCurrent] = useState(0);
  const [photos, setPhotos] = useState(false);
  const supported = useRef(false);

  useEffect(() => {
    supported.current = typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";
  }, []);

  const registry = () => (CSS as unknown as { highlights: HighlightRegistry }).highlights;

  /** Opens or closes every note in the chapter. */
  const setAll = useCallback((open: boolean) => {
    document.getElementById(targetId)?.querySelectorAll("details").forEach((d) => { d.open = open; });
  }, [targetId]);

  // Printing shows every note; a Contents link opens the note it points to.
  useEffect(() => {
    const openAll = () => setAll(true);
    const openLinked = () => { const id = decodeURIComponent(location.hash.slice(1)); if (id) document.getElementById(id)?.querySelector("details")?.setAttribute("open", ""); };
    window.addEventListener("beforeprint", openAll);
    window.addEventListener("hashchange", openLinked);
    openLinked();
    return () => { window.removeEventListener("beforeprint", openAll); window.removeEventListener("hashchange", openLinked); };
  }, [setAll]);

  // Find matches whenever the query changes.
  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root || !supported.current) return;
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) {
      registry().delete("chapter-search");
      registry().delete("chapter-search-current");
      setRanges([]);
      return;
    }
    const found: Range[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.toLowerCase() ?? "";
      let i = text.indexOf(needle);
      while (i !== -1) {
        const r = document.createRange();
        r.setStart(node, i);
        r.setEnd(node, i + needle.length);
        found.push(r);
        i = text.indexOf(needle, i + needle.length);
      }
    }
    registry().set("chapter-search", new Highlight(...found));
    registry().delete("chapter-search-current"); // the previous search's "current" match must not linger
    setRanges(found);
    setCurrent(0);
  }, [q, targetId]);

  const focus = useCallback((i: number) => {
    if (!ranges.length) return;
    const r = ranges[(i + ranges.length) % ranges.length];
    registry().set("chapter-search-current", new Highlight(r));
    const el = r.startContainer.parentElement;
    const note = el?.closest("details");
    if (note && !note.open) note.open = true; // a match inside a closed note opens it
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [ranges]);

  useEffect(() => { if (ranges.length) focus(current); }, [current, ranges, focus]);
  useEffect(() => () => { try { registry().delete("chapter-search"); registry().delete("chapter-search-current"); } catch {} }, []);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-2 sm:flex-row sm:items-center print:hidden" data-testid="chapter-toolbar">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search in this chapter" className="h-9 pr-9 pl-9" aria-label="Search in this chapter"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setCurrent((c) => c + (e.shiftKey ? -1 : 1)); } }} />
        {q && <button onClick={() => setQ("")} className="absolute top-1/2 right-2 -translate-y-1/2 text-faint hover:text-text" aria-label="Clear search"><X className="size-4" /></button>}
      </div>
      {q.trim().length >= 2 && (
        <div className="flex items-center gap-1 text-xs text-muted">
          <span data-testid="search-count">{ranges.length ? `${(current % ranges.length + ranges.length) % ranges.length + 1} of ${ranges.length}` : "No matches"}</span>
          <Button size="sm" variant="ghost" onClick={() => setCurrent((c) => c - 1)} disabled={!ranges.length} aria-label="Previous match"><ChevronUp className="size-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setCurrent((c) => c + 1)} disabled={!ranges.length} aria-label="Next match"><ChevronDown className="size-4" /></Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setAll(true)}><ChevronsUpDown className="size-4" /> Expand all</Button>
        <Button size="sm" variant="ghost" onClick={() => setAll(false)}><ChevronsDownUp className="size-4" /> Collapse all</Button>
        <label className="inline-flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" className="size-3.5 accent-[var(--primary)]" checked={photos} onChange={(e) => setPhotos(e.target.checked)} />
          Include page photos
        </label>
        <Button size="sm" variant="secondary" onClick={() => {
          document.documentElement.dataset.printPhotos = photos ? "yes" : "no";
          setAll(true);
          window.print();
        }}><Printer className="size-4" /> Print / PDF</Button>
      </div>
    </div>
  );
}
