"use client";

import { Flame, Lock, Swords, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createRaid } from "@/app/actions/game";
import type { ItemCat } from "@/lib/game";
import { bossFor, spriteIcon } from "@/lib/knowa/pixel";
import { useRunAction } from "../toast";
import { Badge, Button, Card, EmptyState, ProgressBar, Select } from "../ui";
import { BossGame } from "./boss-game";

type Lobby = {
  bosses: { id: string; name: string; subject: string; questions: number; written: number; wins: number }[];
  locked: { id: string; name: string; questions: number }[];
  raids: { id: string; hp: number; total: number; defeated: boolean; ended: boolean; endsAt: string; chapter: { id: string; name: string }; by: string; players: { name: string; damage: number; right: number; you: boolean }[]; played: boolean }[];
};

/** Sprites are drawn on a canvas, so they're made after the page loads. */
function BossIcon({ name, size = 40 }: { name: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => setSrc(spriteIcon(bossFor(name).id, 64)), [name]);
  // eslint-disable-next-line @next/next/no-img-element -- a tiny generated data URL
  return src ? <img src={src} alt="" width={size} height={size} style={{ imageRendering: "pixelated" }} className="shrink-0" /> : <span style={{ width: size, height: size }} className="shrink-0 rounded bg-surface-2" />;
}

/**
 * Boss Battles: every chapter with enough approved practice questions has a boss. Fights use only those
 * questions (no AI), are graded on the server, and their answers feed the Mistake Map. Team raids let the
 * class wear down one big boss together.
 */
export function BossLobby({ lobby, look, streak, coins }: { lobby: Lobby; look: Record<ItemCat, string>; streak: number; coins: number }) {
  const router = useRouter();
  const runAction = useRunAction();
  const [fight, setFight] = useState<{ chapterId: string; name: string; raidId?: string } | null>(null);
  const [raidCh, setRaidCh] = useState(lobby.bosses[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const live = lobby.raids.filter((r) => !r.ended && !r.defeated);

  return (
    <div className="space-y-5" data-testid="boss-lobby">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 bg-[#0b1226] px-5 py-4 text-[#e8f0ff]">
          <BossIcon name="hero" size={48} />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Boss Battles</h2>
            <p className="text-sm text-[#a9b8d6]">Turn revision into a fight. Spend energy to attack: <b className="text-white">more energy = a harder question = a bigger hit</b>. Wrong answers let the boss hit back. Questions come from your class&apos;s approved questions, multiple choice and written; written answers are marked like your quizzes.</p>
          </div>
          <div className="flex gap-2 text-sm">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1"><Flame className="size-4 text-[#ff9a3c]" /> {streak} day streak</span>
            <Link href="/hero" className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 hover:bg-white/20"><span className="inline-block size-3 rounded-full bg-[#ffd23a]" /> {coins} coins</Link>
          </div>
        </div>
      </Card>

      {lobby.bosses.length === 0 ? (
        <Card><EmptyState icon={<Swords className="size-5" />} title="No bosses yet" description={`A chapter gets a boss once it has at least 5 approved multiple-choice questions. Your teacher makes them in Study.${lobby.locked.length ? ` Almost there: ${lobby.locked.map((l) => l.name).join(", ")}.` : ""}`} /></Card>
      ) : (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted">Pick a boss</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {lobby.bosses.map((b) => {
              const boss = bossFor(b.name);
              return (
                <li key={b.id}>
                  <button type="button" onClick={() => setFight({ chapterId: b.id, name: b.name })} data-testid="boss-card"
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left shadow-card transition-colors hover:border-primary/40">
                    <BossIcon name={b.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{b.name}</span>
                      <span className="block truncate text-xs text-muted">{boss.name} · {b.subject} · {b.questions} questions{b.written ? ` (${b.written} written)` : ""}</span>
                    </span>
                    {b.wins ? <Badge tone="success">Beaten ×{b.wins}</Badge> : <Badge tone="danger">Fight</Badge>}
                  </button>
                </li>
              );
            })}
          </ul>
          {lobby.locked.length > 0 && <p className="flex items-center gap-1.5 text-xs text-faint"><Lock className="size-3.5" /> Needs 5 approved questions: {lobby.locked.map((l) => `${l.name} (${l.questions})`).join(", ")}</p>}
        </section>
      )}

      {lobby.bosses.length > 0 && (
        <Card className="space-y-3 p-5" data-testid="raids">
          <div>
            <h3 className="flex items-center gap-2 font-semibold"><Users className="size-4 text-primary" /> Team raids</h3>
            <p className="text-sm text-muted">Everyone in the class fights the same giant boss: 8 turns each, and all the damage adds up. A raid lasts 3 days.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select aria-label="Raid chapter" value={raidCh} onChange={(e) => setRaidCh(e.target.value)} className="w-auto min-w-48 flex-1">
              {lobby.bosses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            <Button variant="secondary" loading={busy} data-testid="raid-start" onClick={async () => {
              setBusy(true); const r = await runAction(createRaid(raidCh), "Raid started. Tell your classmates!"); setBusy(false); if (r.ok) router.refresh();
            }}>Start a raid</Button>
          </div>
          {lobby.raids.length === 0 ? <p className="text-sm text-muted">No raids yet.</p> : (
            <ul className="space-y-3">
              {lobby.raids.map((r) => (
                <li key={r.id} className="rounded-xl border border-border p-3" data-testid="raid-row">
                  <div className="flex flex-wrap items-center gap-3">
                    <BossIcon name={r.chapter.name} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.chapter.name}</p>
                      <p className="text-xs text-muted">{r.defeated ? "Boss defeated!" : r.ended ? "Ended" : `${r.total} / ${r.hp} damage`} · started by {r.by} · {r.players.length} player{r.players.length === 1 ? "" : "s"}</p>
                    </div>
                    {!r.defeated && !r.ended && (r.played ? <Badge>You&apos;ve played</Badge> : <Button size="sm" data-testid="raid-join" onClick={() => setFight({ chapterId: r.chapter.id, name: r.chapter.name, raidId: r.id })}>Join raid</Button>)}
                  </div>
                  <ProgressBar value={Math.min(1, r.total / r.hp)} color="var(--danger)" className="mt-2" label={`${r.total} of ${r.hp} damage`} />
                  {r.players.length > 0 && (
                    <ol className="mt-2 space-y-0.5 text-xs">
                      {r.players.map((p, i) => <li key={i} className="flex justify-between gap-2"><span>{i + 1}. {p.name}{p.you ? " (you)" : ""}</span><span className="tabular-nums text-muted">{p.damage} damage · {p.right} right</span></li>)}
                    </ol>
                  )}
                </li>
              ))}
            </ul>
          )}
          {live.length === 0 && lobby.raids.length > 0 && <p className="text-xs text-faint">Start a new raid any time.</p>}
        </Card>
      )}

      {fight && <BossGame chapterId={fight.chapterId} chapterName={fight.name} raidId={fight.raidId} look={look} onClose={() => setFight(null)} />}
    </div>
  );
}
