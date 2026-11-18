"use client";

import { useEffect } from "react";
import { findSpans } from "@/lib/highlight";

type Registry = { set: (name: string, h: unknown) => void; delete: (name: string) => void };
declare const Highlight: { new (...ranges: Range[]): unknown };

// One shared highlight for the whole page, built from every lesson's ranges.
const rangesByTarget = new Map<string, Range[]>();
function publish() {
  const all = [...rangesByTarget.values()].flat();
  const registry = (CSS as unknown as { highlights: Registry }).highlights;
  if (all.length) registry.set("keypoint", new Highlight(...all));
  else registry.delete("keypoint");
}

/**
 * Highlights the lesson's key phrases inside the element with id `targetId`, using the CSS Custom Highlight API
 * (the notes' HTML is never changed). Browsers without it simply show no highlight; the key points list remains.
 */
export function KeyHighlighter({ targetId, phrases }: { targetId: string; phrases: string[] }) {
  useEffect(() => {
    if (typeof CSS === "undefined" || !("highlights" in CSS) || typeof Highlight === "undefined") return;
    const root = document.getElementById(targetId);
    if (!root) return;
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
    const ranges = findSpans(nodes.map((n) => n.textContent ?? ""), phrases).map((s) => {
      const r = document.createRange();
      r.setStart(nodes[s.start.piece], s.start.offset);
      r.setEnd(nodes[s.end.piece], s.end.offset);
      return r;
    });
    rangesByTarget.set(targetId, ranges);
    root.dataset.highlights = String(ranges.length); // lets tests (and curious teachers) see how many were found
    publish();
    return () => { rangesByTarget.delete(targetId); publish(); };
  }, [targetId, phrases]);
  return null;
}
