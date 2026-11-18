"use client";

import { useState, type ReactNode } from "react";
import { cn } from "./ui";

/**
 * Small, dependency-free charts for the dashboard. One series each, in the validated chart blue
 * (--viz-1). Text is real HTML so it stays readable at any width; only the line itself is SVG.
 * Every chart has a hover/keyboard tooltip and a "Show as table" view, so no value depends on colour
 * or on hovering.
 */

export type Point = { label: string; detail?: string; value: number };

const fmt = (v: number, unit: string) => `${Number.isInteger(v) ? v : v.toFixed(1)}${unit}`;

function Tooltip({ x, children }: { x: number; children: ReactNode }) {
  // Keep the box inside the chart near the edges.
  const align = x < 15 ? "translate-x-0" : x > 85 ? "-translate-x-full" : "-translate-x-1/2";
  return (
    <div role="status" className={cn("pointer-events-none absolute top-0 z-10 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg", align)} style={{ left: `${x}%` }}>
      {children}
    </div>
  );
}

function TableView({ caption, rows, unit, valueLabel }: { caption: string; rows: Point[]; unit: string; valueLabel: string }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="inline-flex cursor-pointer items-center gap-1 text-muted hover:text-text">Show as table</summary>
      <table className="mt-2 w-full text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-muted"><tr><th className="py-1 font-medium">Item</th><th className="py-1 text-right font-medium">{valueLabel}</th></tr></thead>
        <tbody className="tabular-nums">
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border"><td className="py-1">{r.label}{r.detail && <span className="text-muted"> · {r.detail}</span>}</td><td className="py-1 text-right">{fmt(r.value, unit)}</td></tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** A trend over time (0–max), e.g. quiz scores. Crosshair snaps to the nearest point. */
export function LineChart({ points, max = 100, unit = "%", caption, valueLabel = "Score" }: { points: Point[]; max?: number; unit?: string; caption: string; valueLabel?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;
  const n = points.length;
  const xAt = (i: number) => (n === 1 ? 50 : 3 + (i / (n - 1)) * 94); // % across, with a little edge room
  const yAt = (v: number) => 100 - (Math.max(0, Math.min(max, v)) / max) * 100; // % down
  const path = points.map((p, i) => `${i ? "L" : "M"}${xAt(i)},${yAt(p.value)}`).join(" ");
  const area = `${path} L${xAt(n - 1)},100 L${xAt(0)},100 Z`;
  const pick = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const pct = ((clientX - r.left) / r.width) * 100;
    let best = 0;
    points.forEach((_, i) => { if (Math.abs(xAt(i) - pct) < Math.abs(xAt(best) - pct)) best = i; });
    setHover(best);
  };
  const h = hover !== null ? points[hover] : null;
  return (
    <figure aria-label={caption} data-testid="line-chart">
      <div className="flex gap-2">
        <div className="flex h-40 flex-col justify-between py-0 text-right text-[11px] text-faint tabular-nums" aria-hidden><span>{fmt(max, unit)}</span><span>{fmt(max / 2, unit)}</span><span>0</span></div>
        <div className="relative h-40 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" tabIndex={0}
          aria-label={`${caption}. Use left and right arrow keys to read each point.`}
          onPointerMove={(e) => pick(e.clientX, e.currentTarget)} onPointerLeave={() => setHover(null)} onBlur={() => setHover(null)}
          onFocus={() => setHover(n - 1)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setHover((i) => Math.max(0, (i ?? n - 1) - 1));
            if (e.key === "ArrowRight") setHover((i) => Math.min(n - 1, (i ?? 0) + 1));
          }}>
          {[0, 50, 100].map((y) => <div key={y} className="absolute inset-x-0 border-t border-border" style={{ top: `${y}%` }} aria-hidden />)}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            <path d={area} fill="var(--viz-1)" opacity={0.1} />
            <path d={path} fill="none" stroke="var(--viz-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {hover !== null && <div className="absolute inset-y-0 border-l border-border-strong" style={{ left: `${xAt(hover)}%` }} aria-hidden />}
          {points.map((p, i) => (
            <span key={i} className={cn("absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--surface)]", hover === i && "size-3.5")}
              style={{ left: `${xAt(i)}%`, top: `${yAt(p.value)}%`, background: "var(--viz-1)" }} aria-hidden />
          ))}
          {h && hover !== null && (
            <Tooltip x={xAt(hover)}>
              <p className="text-sm font-semibold tabular-nums text-text">{fmt(h.value, unit)}</p>
              <p className="text-muted">{h.label}{h.detail && ` · ${h.detail}`}</p>
            </Tooltip>
          )}
        </div>
      </div>
      <div className="mt-1 flex justify-between pl-9 text-[11px] text-faint" aria-hidden><span>{points[0].label}</span>{n > 1 && <span>{points[n - 1].label}</span>}</div>
      <TableView caption={caption} rows={points} unit={unit} valueLabel={valueLabel} />
    </figure>
  );
}

/** Counts per period (e.g. quizzes per week), as columns from one baseline. */
export function ColumnChart({ bars, caption, unit = "", valueLabel = "Count" }: { bars: Point[]; caption: string; unit?: string; valueLabel?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const top = Math.ceil(max / 2) * 2 || 2; // even top so the midline is a whole number
  return (
    <figure aria-label={caption} data-testid="column-chart">
      <div className="flex gap-2">
        <div className="flex h-32 flex-col justify-between text-right text-[11px] text-faint tabular-nums" aria-hidden><span>{top}</span><span>{top / 2}</span><span>0</span></div>
        <div className="relative h-32 flex-1">
          {[0, 50].map((y) => <div key={y} className="absolute inset-x-0 border-t border-border" style={{ top: `${y}%` }} aria-hidden />)}
          <div className="absolute inset-x-0 bottom-0 border-t border-border-strong" aria-hidden />
          <div className="absolute inset-0 flex items-end">
            {bars.map((b, i) => (
              <button key={i} type="button" className="relative flex h-full flex-1 items-end justify-center outline-none focus-visible:bg-surface-2"
                aria-label={`${b.label}: ${fmt(b.value, unit)}`}
                onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
                <span className={cn("block w-full max-w-6 rounded-t transition-opacity", hover !== null && hover !== i && "opacity-60")}
                  style={{ height: `${(b.value / top) * 100}%`, background: "var(--viz-1)", minHeight: b.value ? 2 : 0 }} />
              </button>
            ))}
          </div>
          {hover !== null && (
            <Tooltip x={((hover + 0.5) / bars.length) * 100}>
              <p className="text-sm font-semibold tabular-nums text-text">{fmt(bars[hover].value, unit)}</p>
              <p className="text-muted">{bars[hover].label}</p>
            </Tooltip>
          )}
        </div>
      </div>
      <div className="mt-1 flex pl-9 text-[11px] text-faint" aria-hidden>
        {bars.map((b, i) => <span key={i} className={cn("flex-1 text-center", i % 2 === 1 && "max-sm:invisible")}>{b.label}</span>)}
      </div>
      <TableView caption={caption} rows={bars} unit={unit} valueLabel={valueLabel} />
    </figure>
  );
}

/** One ratio per named row (e.g. average score per subject): name, bar and figure, bars aligned. */
export function BarList({ rows, caption, unit = "%", max = 100, valueLabel = "Average" }: { rows: (Point & { href?: string })[]; caption: string; unit?: string; max?: number; valueLabel?: string }) {
  if (rows.length === 0) return null;
  return (
    <figure aria-label={caption} data-testid="bar-list">
      <ul className="space-y-2.5">
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_3rem]">
            <span className="truncate text-sm">{r.href ? <a href={r.href} className="hover:underline">{r.label}</a> : r.label}{r.detail && <span className="text-xs text-muted"> · {r.detail}</span>}</span>
            <span className="col-span-2 row-start-2 h-2.5 overflow-hidden rounded-full bg-surface-2 sm:col-span-1 sm:col-start-2 sm:row-start-1" title={`${r.label}: ${fmt(r.value, unit)}`}>
              <span className="block h-full rounded-full" style={{ width: `${(Math.max(0, Math.min(max, r.value)) / max) * 100}%`, background: "var(--viz-1)" }} />
            </span>
            <span className="text-right text-sm font-medium tabular-nums sm:col-start-3 sm:row-start-1">{fmt(r.value, unit)}</span>
          </li>
        ))}
      </ul>
      <TableView caption={caption} rows={rows} unit={unit} valueLabel={valueLabel} />
    </figure>
  );
}
