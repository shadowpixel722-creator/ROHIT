"use client";

import { ArrowRight, Network, PenLine, ShieldAlert, Target, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { TOPIC_LABEL, topicSentence, type TopicStatus } from "@/lib/confidence";
import { STATUS_LABEL, type TrapStatus } from "@/lib/mistakes";
import { neighbours, type GraphNode, type TopicGraph } from "@/lib/topic-graph";
import { Badge, cn } from "../ui";

const TOPIC_FILL: Record<TopicStatus, string> = { STRONG: "var(--success)", SHAKY: "var(--warn)", NEEDS_WORK: "var(--danger)", NOT_STARTED: "var(--surface-2)" };
const TRAP_FILL: Record<TrapStatus, string> = { ACTIVE: "var(--danger)", FADING: "var(--warn)", FIXED: "var(--success)", CLEAR: "var(--faint)" };
const TOPIC_TONE: Record<TopicStatus, "success" | "warn" | "danger" | "neutral"> = { STRONG: "success", SHAKY: "warn", NEEDS_WORK: "danger", NOT_STARTED: "neutral" };
const TRAP_TONE: Record<TrapStatus, "success" | "warn" | "danger" | "neutral"> = { ACTIVE: "danger", FADING: "warn", FIXED: "success", CLEAR: "neutral" };

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
/** Longest label drawn on the map (the details panel shows the full name). */
const labelMax = (kind: GraphNode["kind"], narrow: boolean) => (kind === "subject" ? 24 : kind === "topic" ? (narrow ? 18 : 26) : 30);

export type TrapInfo = { fix: string; sentence: string; confidenceNote: string | null };

/**
 * The student's own topic map: subjects, their topics (chapters) and the traps fallen for in them, drawn as
 * connected nodes. Topic colour = how well it's known (from recent answers and how sure they were); a trap
 * joins every topic it was met in. Tap or press Enter on a node to see its details and what's connected to it.
 */
export function TopicMap({ graph, classroomId, trapInfo }: { graph: TopicGraph; classroomId: string; trapInfo: Record<string, TrapInfo> }) {
  const [selected, setSelected] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(900);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxWidth(e.contentRect.width || 900));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const lit = useMemo(() => (selected ? neighbours(graph, selected) : null), [graph, selected]);
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const node = selected ? byId.get(selected) ?? null : null;
  const topics = graph.nodes.filter((n) => n.kind === "topic");
  const count = (s: TopicStatus) => topics.filter((t) => t.kind === "topic" && t.status === s).length;

  const narrow = boxWidth < 560;
  // Crop the drawing to the nodes and their labels so it fills the width on phones. On a narrow screen the
  // drawing shrinks a lot, so its text is drawn larger (k) to stay readable; on a wide one it isn't blown up.
  const { view, textScale } = useMemo(() => {
    const crop = (k: number) => {
      let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
      for (const n of graph.nodes) {
        const size = (n.kind === "subject" ? 17 : n.kind === "topic" ? 14 : 12) * k;
        const shown = n.kind === "trap" && narrow ? 0 : Math.min(n.label.length, labelMax(n.kind, narrow));
        const half = Math.max(n.r + 6, shown * size * 0.3);
        x0 = Math.min(x0, n.x - half); x1 = Math.max(x1, n.x + half);
        y0 = Math.min(y0, n.y - n.r - 10); y1 = Math.max(y1, n.y + n.r + 10 + size * 1.4);
      }
      // Never zoom in so far that a wide screen shows a few giant circles.
      const minW = Math.min(graph.width, Math.max(240, boxWidth * 0.85));
      const w = Math.max(x1 - x0, minW);
      const cx = (x0 + x1) / 2;
      return { x: cx - w / 2, y: y0, w, h: Math.max(y1 - y0, 180) };
    };
    const first = crop(1);
    const k = Math.min(2, Math.max(1, (first.w / Math.max(boxWidth, 1)) * 0.8));
    return { view: crop(k), textScale: k };
  }, [graph, boxWidth, narrow]);

  if (topics.length === 0) return null;
  const dim = (id: string) => lit !== null && !lit.has(id);
  // Draw subjects last among the circles so their labels sit on top; edges first.
  const RANK = { written: 0, trap: 0, topic: 1, subject: 2 } as const;
  const order = [...graph.nodes].sort((a, b) => RANK[a.kind] - RANK[b.kind]);

  return (
    <div className="space-y-3" data-testid="topic-map">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Key">
        <Legend color={TOPIC_FILL.STRONG} label={`Strong (${count("STRONG")})`} />
        <Legend color={TOPIC_FILL.SHAKY} label={`Shaky (${count("SHAKY")})`} />
        <Legend color={TOPIC_FILL.NEEDS_WORK} label={`Needs work (${count("NEEDS_WORK")})`} />
        <Legend color={TOPIC_FILL.NOT_STARTED} label={`Not practised (${count("NOT_STARTED")})`} outline />
        <span className="inline-flex items-center gap-1.5"><svg className="size-3.5" viewBox="0 0 14 14" aria-hidden><rect x="3" y="3" width="8" height="8" transform="rotate(45 7 7)" fill="var(--danger)" /></svg>Trap you fell for</span>
        <span className="inline-flex items-center gap-1.5"><svg className="size-3.5" viewBox="0 0 14 14" aria-hidden><rect x="3.5" y="3.5" width="7" height="7" transform="rotate(45 7 7)" fill="var(--danger)" stroke="var(--text)" strokeWidth="1.6" /></svg>…while sure</span>
        <span className="inline-flex items-center gap-1.5"><svg className="size-3.5" viewBox="0 0 14 14" aria-hidden><rect x="2" y="2" width="10" height="10" rx="2" fill="var(--warn)" /></svg>Written answer to fix</span>
      </div>

      <div ref={boxRef} className="overflow-hidden rounded-xl border border-border bg-surface-2/40">
        <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} className="block h-auto w-full" role="group" aria-label="Your topic map" data-testid="topic-map-svg"
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          {graph.edges.map((e, i) => {
            const a = byId.get(e.from)!;
            const b = byId.get(e.to)!;
            const off = dim(e.from) || dim(e.to);
            return (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={e.kind === "trap" ? "var(--danger)" : e.kind === "written" ? "var(--warn)" : "var(--border-strong)"} strokeWidth={e.kind === "subject" ? 2.2 : 1.6}
                strokeDasharray={e.kind === "subject" ? undefined : e.kind === "written" ? "2 4" : "5 4"} opacity={off ? 0.12 : e.kind === "subject" ? 0.9 : 0.55} />
            );
          })}
          {order.map((n) => <NodeShape key={n.id} n={n} dim={dim(n.id)} selected={selected === n.id} k={textScale} max={labelMax(n.kind, narrow)}
            showLabel={n.kind !== "trap" || !narrow || (lit?.has(n.id) ?? false)} onSelect={() => setSelected(selected === n.id ? null : n.id)} />)}
        </svg>
      </div>
      <p className="text-xs text-faint">Tap a topic or trap to see what it&apos;s connected to. A trap linked to several topics is one wrong idea that shows up in all of them.</p>

      {node && <Details node={node} classroomId={classroomId} trapInfo={trapInfo} byId={byId} graph={graph} onClose={() => setSelected(null)} onSelect={setSelected} />}
    </div>
  );
}

function Legend({ color, label, outline }: { color: string; label: string; outline?: boolean }) {
  return <span className="inline-flex items-center gap-1.5"><span className={cn("inline-block size-3 rounded-full", outline && "border border-dashed border-border-strong")} style={{ background: color }} />{label}</span>;
}

/** `k` scales text (bigger on narrow screens); `showLabel` hides trap names on phones until something is selected. */
function NodeShape({ n, dim, selected, onSelect, k, showLabel, max }: { n: GraphNode; dim: boolean; selected: boolean; onSelect: () => void; k: number; showLabel: boolean; max: number }) {
  const common = {
    role: "button", tabIndex: 0, "data-node": n.kind, "data-status": n.kind === "topic" || n.kind === "trap" ? n.status : undefined,
    className: "cursor-pointer outline-none [&:focus-visible>.ring]:opacity-100",
    style: { opacity: dim ? 0.2 : 1, transition: "opacity 150ms" },
    onClick: (e: MouseEvent) => { e.stopPropagation(); onSelect(); },
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } },
  };
  const ring = <circle className="ring" cx={n.x} cy={n.y} r={n.r + 6} fill="none" stroke="var(--primary)" strokeWidth={3} opacity={selected ? 1 : 0} />;

  if (n.kind === "subject") {
    return (
      <g {...common} aria-label={`Subject: ${n.label}`}>
        {ring}
        <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} stroke="var(--surface)" strokeWidth={3} />
        <text x={n.x} y={n.y + n.r + 6 + 14 * k} textAnchor="middle" fontSize={17 * k} fontWeight={700} fill="var(--text)" paintOrder="stroke" stroke="var(--surface)" strokeWidth={4}>{clip(n.label, max)}</text>
      </g>
    );
  }
  if (n.kind === "topic") {
    const notStarted = n.status === "NOT_STARTED";
    return (
      <g {...common} aria-label={`Topic: ${n.label}. ${TOPIC_LABEL[n.status]}. ${topicSentence(n.stats)}`} data-testid="topic-node">
        {ring}
        <circle cx={n.x} cy={n.y} r={n.r} fill={TOPIC_FILL[n.status]} stroke={n.color} strokeWidth={notStarted ? 2 : 3} strokeDasharray={notStarted ? "4 3" : undefined} />
        {n.stats.recentPercent !== null && <text x={n.x} y={n.y + 4.5} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">{n.stats.recentPercent}%</text>}
        <text x={n.x} y={n.y + n.r + 5 + 12 * k} textAnchor="middle" fontSize={14 * k} fontWeight={600} fill="var(--text)" paintOrder="stroke" stroke="var(--surface)" strokeWidth={4}>{clip(n.label, max)}</text>
      </g>
    );
  }
  if (n.kind === "written") {
    const w = n.r * 1.7;
    return (
      <g {...common} aria-label={`Written question still to fix: ${n.label}${n.sure ? ". You were sure of your answer" : ""}`} data-testid="written-node">
        {ring}
        <rect x={n.x - w / 2} y={n.y - w / 2} width={w} height={w} rx={4} fill="var(--warn)" stroke={n.sure ? "var(--text)" : "var(--surface)"} strokeWidth={n.sure ? 2.5 : 2} />
        <path d={`M${n.x - w * 0.22} ${n.y + w * 0.2} l${w * 0.44} ${-w * 0.44}`} stroke="var(--surface)" strokeWidth={2} strokeLinecap="round" />
        {showLabel && <text x={n.x} y={n.y + n.r + 4 + 11 * k} textAnchor="middle" fontSize={11 * k} fill="var(--muted)" paintOrder="stroke" stroke="var(--surface)" strokeWidth={4}>{clip(n.label, max)}</text>}
      </g>
    );
  }
  const s = n.r * 1.25;
  return (
    <g {...common} aria-label={`Trap: ${n.label}. ${STATUS_LABEL[n.status]}. Fell for it ${n.falls} of ${n.chances} times${n.sureFalls ? `, ${n.sureFalls} while sure` : ""}.`} data-testid="trap-node">
      {ring}
      <rect x={n.x - s / 2} y={n.y - s / 2} width={s} height={s} transform={`rotate(45 ${n.x} ${n.y})`} fill={TRAP_FILL[n.status]}
        stroke={n.sureFalls > 0 ? "var(--text)" : "var(--surface)"} strokeWidth={n.sureFalls > 0 ? 2.5 : 2} />
      {showLabel && <text x={n.x} y={n.y + n.r + 4 + 11 * k} textAnchor="middle" fontSize={12 * k} fill="var(--muted)" paintOrder="stroke" stroke="var(--surface)" strokeWidth={4}>{clip(n.label, max)}</text>}
    </g>
  );
}

function Details({ node, classroomId, trapInfo, byId, graph, onClose, onSelect }: {
  node: GraphNode; classroomId: string; trapInfo: Record<string, TrapInfo>; byId: Map<string, GraphNode>; graph: TopicGraph; onClose: () => void; onSelect: (id: string) => void;
}) {
  const linked = [...neighbours(graph, node.id)].filter((id) => id !== node.id).map((id) => byId.get(id)!).filter(Boolean);
  const chip = (n: GraphNode) => (
    <button key={n.id} type="button" onClick={() => onSelect(n.id)} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs hover:border-border-strong">
      {n.kind === "trap" ? <Target className="size-3 text-danger" /> : n.kind === "written" ? <PenLine className="size-3 text-warn" /> : <span className="inline-block size-2 rounded-full" style={{ background: n.kind === "topic" ? TOPIC_FILL[n.status] : n.color }} />}
      {clip(n.label, 40)}
    </button>
  );
  return (
    <div className="relative rounded-xl border border-primary/40 bg-primary-soft/50 p-4 pr-10 text-sm" data-testid="topic-details" aria-live="polite">
      <button type="button" aria-label="Close details" onClick={onClose} className="absolute right-2 top-2 rounded p-1 text-muted hover:text-text"><X className="size-4" /></button>
      {node.kind === "subject" && (
        <>
          <p className="flex items-center gap-2 font-semibold"><Network className="size-4 text-primary" /> {node.label}</p>
          <p className="mt-1 text-muted">{linked.length} topic{linked.length === 1 ? "" : "s"} you can practise.</p>
        </>
      )}
      {node.kind === "topic" && (
        <>
          <p className="flex flex-wrap items-center gap-2 font-semibold">{node.label} <Badge tone={TOPIC_TONE[node.status]}>{TOPIC_LABEL[node.status]}</Badge></p>
          <p className="mt-1" data-testid="topic-sentence">{topicSentence(node.stats)}</p>
          {node.stats.sureWrong > 0 && <p className="mt-1 flex items-start gap-1.5 text-danger"><ShieldAlert className="mt-0.5 size-4 shrink-0" /> You were sure about answers that were wrong here. Fix those ideas first.</p>}
          {node.stats.shakyRight > 0 && node.stats.sureWrong === 0 && <p className="mt-1 text-warn">Some right answers here were guesses. Practise until you&apos;re sure.</p>}
          <Link href={`/classes/${classroomId}/study/${node.chapterId}`} className="mt-2 inline-flex items-center gap-1 font-medium text-primary hover:underline">
            {node.status === "NOT_STARTED" ? "Start practising this topic" : "Practise this topic"} <ArrowRight className="size-4" />
          </Link>
        </>
      )}
      {node.kind === "written" && (
        <>
          <p className="flex flex-wrap items-center gap-2 font-semibold"><PenLine className="size-4 text-warn" /> Written answer to fix <Badge tone="warn">Still to fix</Badge>{node.sure && <Badge tone="danger">You were sure</Badge>}</p>
          <p className="mt-1">{node.label}</p>
          <p className="mt-1 text-muted">Your latest answer wasn&apos;t fully right. The model answer and your marker&apos;s feedback are in the list below the map.</p>
          <Link href={`/classes/${classroomId}/study/${node.chapterId}`} className="mt-2 inline-flex items-center gap-1 font-medium text-primary hover:underline">Try a quiz on this topic <ArrowRight className="size-4" /></Link>
        </>
      )}
      {node.kind === "trap" && (
        <>
          <p className="flex flex-wrap items-center gap-2 font-semibold"><Target className="size-4 text-danger" /> {node.label} <Badge tone={TRAP_TONE[node.status]}>{STATUS_LABEL[node.status]}</Badge></p>
          {trapInfo[node.misconceptionId] && (
            <>
              <p className="mt-1">{trapInfo[node.misconceptionId].sentence}</p>
              {trapInfo[node.misconceptionId].confidenceNote && <p className="mt-1 text-danger">{trapInfo[node.misconceptionId].confidenceNote}</p>}
              <p className="mt-1 text-muted"><span className="font-medium text-text">The right idea:</span> {trapInfo[node.misconceptionId].fix}</p>
            </>
          )}
          <a href={`#trap-${node.misconceptionId}`} className="mt-2 inline-flex items-center gap-1 font-medium text-primary hover:underline">Practise this trap <ArrowRight className="size-4" /></a>
        </>
      )}
      {linked.length > 0 && node.kind !== "subject" && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-muted">{node.kind === "trap" ? `Shows up in ${linked.length} topic${linked.length === 1 ? "" : "s"}` : "Connected to"}</p>
          <div className="flex flex-wrap gap-1.5">{linked.map(chip)}</div>
        </div>
      )}
      {node.kind === "subject" && linked.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{linked.map(chip)}</div>}
    </div>
  );
}
