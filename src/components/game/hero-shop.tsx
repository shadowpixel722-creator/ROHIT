"use client";

import { Flame, Snowflake, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buyItem, equipItem } from "@/app/actions/game";
import { CATS, DEFAULT_LOOK, FREEZE_EVERY, ITEMS, itemOf, MAX_FREEZES, streakDays, type ItemCat } from "@/lib/game";
import type { GameView } from "@/lib/game-server";
import { Look, previewScene } from "@/lib/knowa/pixel";
import { useRunAction } from "../toast";
import { Button, Card, cn, ProgressBar } from "../ui";

/** A small looping canvas of the hero wearing `look`. */
function HeroCanvas({ look, width, height, scale, still }: { look: Record<ItemCat, string>; width: number; height: number; scale: number; still?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const c = cv.getContext("2d")!; c.imageSmoothingEnabled = false;
    const parts: unknown[] = []; let raf = 0;
    const x = Math.round((width - 16 * scale) / 2) - scale, y0 = height - 18 - 16 * scale;
    const draw = (now: number) => {
      previewScene(c, width, height, now);
      const y = y0 + (still ? 0 : Math.round(Math.sin(now / 320) * 3));
      Look.draw(c, x, y, scale, now, { eq: look });
      Look.sword(c, x, y, scale, 0.5 + (still ? 0 : (Math.sin(now / 900) + 1) * 0.12), now, still ? null : parts, look);
      if (!still) { Look.aura(parts, x, y, scale, look); Look.step(c, parts); }
    };
    if (still) { draw(3000); return; }
    const loop = (now: number) => { raf = requestAnimationFrame(loop); draw(now); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [look, width, height, scale, still]);
  return <canvas ref={ref} width={width} height={height} className="block h-auto w-full rounded-lg" style={{ imageRendering: "pixelated" }} aria-hidden />;
}

/** Streak, level, coins and the cosmetics shop. Try anything on; buy with coins; equip what you own. */
export function HeroShop({ game }: { game: GameView }) {
  const router = useRouter();
  const runAction = useRunAction();
  const [cat, setCat] = useState<ItemCat>("armor");
  const [trying, setTrying] = useState<string>(game.look[cat]);
  const [busy, setBusy] = useState(false);
  useEffect(() => setTrying(game.look[cat]), [cat, game.look]);
  const item = itemOf(cat, trying);
  const owned = item.p === 0 || game.owned.includes(`${cat}:${item.id}`);
  const equipped = game.look[cat] === item.id;
  const preview = { ...game.look, [cat]: trying };
  const days = streakDays({ streak: game.streak, best: game.best, lastDay: null, freezes: game.freezes, days: game.days }, game.today);
  const toNext = FREEZE_EVERY - (game.streak % FREEZE_EVERY);

  const act = async (fn: () => Promise<{ ok: boolean }>, msg: string) => { setBusy(true); const r = await runAction(fn() as never, msg); setBusy(false); if ((r as { ok: boolean }).ok) router.refresh(); };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="space-y-5">
        <Card className="space-y-4 p-5" data-testid="streak-card">
          <div className="flex items-center gap-3">
            <span className={cn("grid size-12 place-items-center rounded-2xl", game.doneToday ? "bg-warn-soft text-warn" : "bg-surface-2 text-faint")}><Flame className="size-6" /></span>
            <div>
              <p className="text-2xl font-semibold tabular-nums" data-testid="streak-count">{game.streak} day{game.streak === 1 ? "" : "s"}</p>
              <p className="text-sm text-muted">{game.doneToday ? "You learned today. Streak safe!" : game.streak ? "Learn something today to keep your streak." : "Learn something today to start a streak."}</p>
            </div>
          </div>
          <ol className="grid grid-cols-7 gap-1.5" aria-label="The last two weeks">
            {days.map((d) => (
              <li key={d.d} title={d.d} className={cn("flex flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] text-muted",
                d.state === "on" ? "bg-warn-soft" : d.state === "ice" ? "bg-primary-soft" : "bg-surface-2", d.state === "today" && "ring-2 ring-primary")}>
                {new Date(d.d + "T12:00:00").toLocaleDateString(undefined, { weekday: "narrow" })}
                {d.state === "on" ? <Flame className="size-3.5 text-warn" /> : d.state === "ice" ? <Snowflake className="size-3.5 text-primary" /> : <span className="size-3.5 rounded-full border border-dashed border-border-strong" />}
              </li>
            ))}
          </ol>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2"><Snowflake className="size-4 text-primary" /> <span><b>{game.freezes}</b> / {MAX_FREEZES} freezes</span></p>
            <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2"><Trophy className="size-4 text-warn" /> <span>Best <b>{game.best}</b> days</span></p>
          </div>
          <p className="text-xs text-muted">{game.freezes >= MAX_FREEZES ? "You're holding the most freezes." : `${toNext} more day${toNext === 1 ? "" : "s"} in a row earns a Streak Freeze.`} A freeze covers one missed day, so your streak doesn&apos;t break. Practice, quizzes, lessons and boss fights all count.</p>
        </Card>

        <Card className="space-y-2 p-5" data-testid="level-card">
          <div className="flex items-baseline justify-between"><p className="font-semibold">Level {game.level.level}</p><p className="text-sm text-muted tabular-nums">{game.xp} XP</p></div>
          <ProgressBar value={game.level.into / game.level.need} label={`${game.level.into} of ${game.level.need} XP to the next level`} />
          <p className="text-xs text-muted">{game.level.need - game.level.into} XP to level {game.level.level + 1}.</p>
        </Card>
      </div>

      <Card className="space-y-4 p-5" data-testid="shop">
        <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-xl border border-border"><HeroCanvas look={preview} width={200} height={170} scale={7} /></div>
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-xl font-semibold tabular-nums" data-testid="coins"><span className="inline-block size-4 rounded-full bg-[#ffd23a] shadow-[inset_-2px_-2px_0_#c9971c]" /> {game.coins} coins</p>
            <div><p className="font-semibold">{item.n}</p><p className="text-xs text-muted">{item.p ? `${item.p} coins` : "Free"}{owned && item.p ? " · you own this" : ""}</p></div>
            <div className="flex flex-wrap gap-2">
              {equipped ? (
                <>
                  <Button size="sm" variant="secondary" disabled>Equipped</Button>
                  {item.id !== DEFAULT_LOOK[cat] && <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => equipItem(cat, DEFAULT_LOOK[cat]), "Taken off")}>Take off</Button>}
                </>
              ) : owned ? (
                <Button size="sm" loading={busy} onClick={() => act(() => equipItem(cat, item.id), `${item.n} equipped`)} data-testid="shop-equip">Equip</Button>
              ) : game.coins >= item.p ? (
                <Button size="sm" loading={busy} onClick={() => act(() => buyItem(cat, item.id), `You bought ${item.n}!`)} data-testid="shop-buy">Buy for {item.p} coins</Button>
              ) : <Button size="sm" variant="secondary" disabled>Need {item.p - game.coins} more coins</Button>}
            </div>
            <p className="text-xs text-muted">Tap an item to try it on. It shows on your hero in Boss Battles.</p>
          </div>
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto" role="tablist">
          {CATS.map(([k, n]) => (
            <button key={k} type="button" role="tab" aria-selected={k === cat} onClick={() => setCat(k)}
              className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium", k === cat ? "border-primary/30 bg-primary-soft text-primary" : "border-border text-muted hover:text-text")}>{n}</button>
          ))}
        </div>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
          {ITEMS[cat].map((it) => {
            const own = it.p === 0 || game.owned.includes(`${cat}:${it.id}`), eq = game.look[cat] === it.id;
            return (
              <li key={it.id}>
                <button type="button" onClick={() => setTrying(it.id)} aria-pressed={trying === it.id} data-testid="shop-item"
                  className={cn("flex w-full flex-col items-center gap-1 rounded-xl border-2 p-2 text-center", eq ? "border-success" : "border-border", trying === it.id && "ring-2 ring-primary ring-offset-1 ring-offset-surface")}>
                  <span className="w-20 overflow-hidden rounded-md"><HeroCanvas look={{ ...game.look, [cat]: it.id }} width={80} height={76} scale={3} still /></span>
                  <span className="text-xs font-semibold">{it.n}</span>
                  <span className={cn("text-xs", eq ? "text-success" : own ? "text-primary" : "text-warn")}>{eq ? "Equipped" : own ? "Owned" : `${it.p} coins`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
