/**
 * The student's topic map on the Mistake Map: every topic (chapter) is a node, joined to its subject and to
 * the traps (misconceptions) the student has fallen for in it. A trap met in several topics joins them, so
 * the map shows how one wrong idea spreads. Pure (no database); the layout is deterministic, so the same
 * data always draws the same picture. Unit-tested.
 */
import { topicStats, type Answered, type TopicStats, type TopicStatus } from "./confidence";
import type { TrapStatus } from "./mistakes";

export type GraphInput = {
  subjects: { id: string; name: string; color: string }[];
  /** Topics that can be practised (have approved questions) or that the student has answered */
  chapters: { id: string; name: string; position: number; subjectId: string }[];
  /** The student's answers per chapter id, oldest first (multiple choice and written quizzes together) */
  answers: Map<string, Answered[]>;
  /** Traps the student has fallen for, with the chapter ids where they met them */
  traps: { id: string; label: string; status: TrapStatus; sureFalls: number; falls: number; chances: number; chapterIds: string[] }[];
  /** Written questions (quizzes and boss battles) the student still gets wrong */
  missed?: { id: string; question: string; chapterId: string; sure: boolean }[];
};

export type GraphNode =
  | { kind: "subject"; id: string; label: string; color: string; x: number; y: number; r: number }
  | { kind: "topic"; id: string; chapterId: string; label: string; color: string; status: TopicStatus; stats: TopicStats; trapIds: string[]; x: number; y: number; r: number }
  | { kind: "trap"; id: string; misconceptionId: string; label: string; status: TrapStatus; sureFalls: number; falls: number; chances: number; x: number; y: number; r: number }
  | { kind: "written"; id: string; questionId: string; chapterId: string; label: string; sure: boolean; x: number; y: number; r: number };

export type GraphEdge = { from: string; to: string; kind: "subject" | "trap" | "written" };
export type TopicGraph = { nodes: GraphNode[]; edges: GraphEdge[]; width: number; height: number };

export const WIDTH = 1000;
export const HEIGHT = 680;
const MIN_HEIGHT = 300;
const R = { subject: 30, topic: 20, trap: 11, written: 9 } as const;
const LENGTH = { subject: 120, trap: 85, written: 65 } as const;
/** At most this many written mistakes per topic on the map (the list below the map has them all). */
const MAX_WRITTEN_PER_TOPIC = 3;

/** Shortens "5. Exploring Forces" or "Part 1 · 2. Power Play" to the chapter's name for a node label. */
export const shortName = (s: string) => s.replace(/^\s*(?:part\s*\d+\s*·\s*)?(?:chapter\s*)?\d+\s*[.:)\-–]\s*/i, "");

export function buildGraph(input: GraphInput): TopicGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const subjects = input.subjects.filter((s) => input.chapters.some((c) => c.subjectId === s.id));
  const trapsByChapter = new Map<string, GraphInput["traps"]>();
  for (const t of input.traps) for (const c of t.chapterIds) (trapsByChapter.get(c) ?? trapsByChapter.set(c, []).get(c)!).push(t);

  // Starting positions: subjects around a circle, their topics in a fan around them, traps between their topics.
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const ring = subjects.length <= 1 ? 0 : Math.min(WIDTH, HEIGHT) * 0.3;
  subjects.forEach((s, i) => {
    const a = (i / Math.max(subjects.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const sx = cx + Math.cos(a) * ring;
    const sy = cy + Math.sin(a) * ring;
    nodes.push({ kind: "subject", id: `s:${s.id}`, label: s.name, color: s.color, x: sx, y: sy, r: R.subject });
    const chapters = input.chapters.filter((c) => c.subjectId === s.id).sort((x, y) => x.position - y.position);
    chapters.forEach((c, j) => {
      const b = a + ((j - (chapters.length - 1) / 2) / Math.max(chapters.length, 1)) * Math.PI * 1.6 + (subjects.length <= 1 ? (j / chapters.length) * Math.PI * 2 : 0);
      const traps = trapsByChapter.get(c.id) ?? [];
      const stats = topicStats(input.answers.get(c.id) ?? [], traps);
      nodes.push({
        kind: "topic", id: `c:${c.id}`, chapterId: c.id, label: shortName(c.name), color: s.color, status: stats.status, stats,
        trapIds: traps.map((t) => t.id), x: sx + Math.cos(b) * LENGTH.subject, y: sy + Math.sin(b) * LENGTH.subject, r: R.topic,
      });
      edges.push({ from: `s:${s.id}`, to: `c:${c.id}`, kind: "subject" });
    });
  });
  const pos = new Map(nodes.map((n) => [n.id, n]));
  for (const t of input.traps) {
    const linked = t.chapterIds.filter((c) => pos.has(`c:${c}`));
    if (linked.length === 0) continue;
    const at = linked.map((c) => pos.get(`c:${c}`)!);
    const mx = at.reduce((n, p) => n + p.x, 0) / at.length;
    const my = at.reduce((n, p) => n + p.y, 0) / at.length;
    // Pushed outwards from the middle, a little apart for each trap, so traps don't start on top of their topic.
    const k = nodes.length;
    const ox = mx - cx || Math.cos(k);
    const oy = my - cy || Math.sin(k);
    const len = Math.hypot(ox, oy) || 1;
    nodes.push({
      kind: "trap", id: `m:${t.id}`, misconceptionId: t.id, label: t.label, status: t.status, sureFalls: t.sureFalls, falls: t.falls, chances: t.chances,
      x: mx + (ox / len) * 60 + Math.cos(k * 2.4) * 20, y: my + (oy / len) * 60 + Math.sin(k * 2.4) * 20, r: R.trap,
    });
    for (const c of linked) edges.push({ from: `c:${c}`, to: `m:${t.id}`, kind: "trap" });
  }
  const perTopic = new Map<string, number>();
  for (const m of input.missed ?? []) {
    const topic = pos.get(`c:${m.chapterId}`);
    const n = perTopic.get(m.chapterId) ?? 0;
    if (!topic || n >= MAX_WRITTEN_PER_TOPIC) continue;
    perTopic.set(m.chapterId, n + 1);
    const a = (nodes.length * 2.4) % (Math.PI * 2);
    nodes.push({ kind: "written", id: `q:${m.id}`, questionId: m.id, chapterId: m.chapterId, label: m.question, sure: m.sure, x: topic.x + Math.cos(a) * LENGTH.written, y: topic.y + Math.sin(a) * LENGTH.written, r: R.written });
    edges.push({ from: `c:${m.chapterId}`, to: `q:${m.id}`, kind: "written" });
  }
  const height = layout(nodes, edges);
  return { nodes, edges, width: WIDTH, height };
}

/**
 * A small force layout: every pair of nodes pushes apart, every edge pulls towards its natural length, and
 * everything drifts gently towards the middle. Then the result is scaled to fit the drawing with a margin,
 * and the drawing's height is cropped to what it uses (a small map doesn't leave a big empty box).
 * Returns that height.
 */
function layout(nodes: GraphNode[], edges: GraphEdge[], iterations = 320): number {
  if (nodes.length === 0) return MIN_HEIGHT;
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const links = edges.map((e) => ({ a: index.get(e.from)!, b: index.get(e.to)!, len: LENGTH[e.kind] }));
  const vx = new Float64Array(nodes.length);
  const vy = new Float64Array(nodes.length);
  for (let it = 0; it < iterations; it++) {
    const cool = 1 - it / iterations;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = nodes[j].x - nodes[i].x;
        let dy = nodes[j].y - nodes[i].y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) { dx = (i - j) * 0.1; dy = 0.1; d2 = 0.02; }
        const d = Math.sqrt(d2);
        const min = nodes[i].r + nodes[j].r + 26;
        const f = (2600 / d2) + (d < min ? (min - d) * 0.5 : 0);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        vx[i] -= fx; vy[i] -= fy; vx[j] += fx; vy[j] += fy;
      }
    }
    for (const l of links) {
      const dx = nodes[l.b].x - nodes[l.a].x;
      const dy = nodes[l.b].y - nodes[l.a].y;
      const d = Math.hypot(dx, dy) || 1;
      const f = (d - l.len) * 0.04;
      vx[l.a] += (dx / d) * f; vy[l.a] += (dy / d) * f; vx[l.b] -= (dx / d) * f; vy[l.b] -= (dy / d) * f;
    }
    for (let i = 0; i < nodes.length; i++) {
      vx[i] += (WIDTH / 2 - nodes[i].x) * 0.004;
      vy[i] += (HEIGHT / 2 - nodes[i].y) * 0.004;
      const step = Math.min(30, Math.hypot(vx[i], vy[i])) * cool;
      const len = Math.hypot(vx[i], vy[i]) || 1;
      nodes[i].x += (vx[i] / len) * step;
      nodes[i].y += (vy[i] / len) * step;
      vx[i] *= 0.5; vy[i] *= 0.5;
    }
  }
  // Fit into the drawing, keeping room for labels under the nodes.
  const margin = 70;
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min((WIDTH - margin * 2) / Math.max(maxX - minX, 1), (HEIGHT - margin * 2) / Math.max(maxY - minY, 1), 1.6);
  const used = (maxY - minY) * scale;
  const height = Math.round(Math.min(HEIGHT, Math.max(MIN_HEIGHT, used + margin * 2)));
  const offX = (WIDTH - (maxX - minX) * scale) / 2;
  const offY = (height - used) / 2;
  for (const n of nodes) {
    n.x = Math.round((n.x - minX) * scale + offX);
    n.y = Math.round((n.y - minY) * scale + offY);
  }
  return height;
}

/** Ids of a node and everything directly joined to it (to highlight a node's neighbourhood). */
export function neighbours(graph: Pick<TopicGraph, "edges">, id: string) {
  const out = new Set([id]);
  for (const e of graph.edges) {
    if (e.from === id) out.add(e.to);
    if (e.to === id) out.add(e.from);
  }
  return out;
}
