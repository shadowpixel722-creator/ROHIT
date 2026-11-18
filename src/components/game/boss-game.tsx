"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { answerBoss, chargeBoss, finishBoss, nextBossQuestion, startBoss } from "@/app/actions/game";
import { hitBack, PARRY_HIT, PARRY_SECONDS, TIER_LABEL, tierOf, type ItemCat, type Tier } from "@/lib/game";
import { createBattle, Music, Snd } from "@/lib/knowa/battle-engine";
import { bossFor } from "@/lib/knowa/pixel";
import { VoiceInput } from "../speech";
import { cn } from "../ui";

type Q = { kind: "mcq" | "written"; stem: string; choices: string[]; tier: Tier; energy: number };
type Marked = { verdict: string; feedback: string; modelAnswer: string; score: number };
type Phase =
  | { k: "load" } | { k: "error"; msg: string } | { k: "pick" }
  | { k: "ask"; q: Q; parry?: boolean; picked?: number | null; right?: number; line?: string; why?: string; marked?: Marked; marking?: boolean }
  | { k: "end"; won: boolean; raid: boolean; xp: number; coins: number; damage: number; right: number; turns: number };

const shuffleChance = () => Math.random() < 0.34;

/**
 * A Boss Battle, full screen: spend energy to attack (more energy = a harder question = a bigger hit),
 * charge to gain energy, and block the boss's timed parries. Every answer is graded by the server, which
 * also keeps the energy and decides the result and reward; this screen only animates what happened.
 */
export function BossGame({ chapterId, chapterName, raidId, look, onClose }: {
  chapterId: string; chapterName: string; raidId?: string | null; look: Record<ItemCat, string>; onClose: () => void;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the ported canvas engine is untyped
  const battle = useRef<any>(null);
  const sid = useRef("");
  const stats = useRef({ damage: 0, combo: 0, energy: 5, turnsLeft: null as number | null, parryCool: 1, turn: 0, ok: 0, tot: 0 });
  const [phase, setPhase] = useState<Phase>({ k: "load" });
  const [sel, setSel] = useState(3);
  const [energy, setEnergy] = useState(5);
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(true);
  const [left, setLeft] = useState(PARRY_SECONDS);
  const [text, setText] = useState("");
  const [hasWritten, setHasWritten] = useState(false);
  const boss = bossFor(chapterName);

  const sync = () => {
    const G = battle.current?.G; if (!G) return;
    G.energy = stats.current.energy; G.combo = stats.current.combo; G.turnsLeft = stats.current.turnsLeft;
    setEnergy(stats.current.energy);
  };

  const begin = useCallback(async () => {
    setPhase({ k: "load" });
    stats.current = { damage: 0, combo: 0, energy: 5, turnsLeft: null, parryCool: 1, turn: 0, ok: 0, tot: 0 };
    battle.current?.destroy();
    const res = await startBoss(chapterId, raidId ?? null).catch(() => null);
    if (!res || !res.ok) { setPhase({ k: "error", msg: res && !res.ok ? res.error : "Couldn't reach the server." }); return; }
    sid.current = res.data!.sessionId;
    stats.current.energy = res.data!.energy; stats.current.turnsLeft = res.data!.turnsLeft; setHasWritten(res.data!.written);
    battle.current = createBattle(canvasRef.current!, boss, look, res.data!.hp);
    sync();
    Snd.init(); Music.start();
    setPhase({ k: "pick" });
  }, [chapterId, raidId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void begin();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; Music.stop(); battle.current?.destroy(); };
  }, [begin]); // eslint-disable-line react-hooks/exhaustive-deps

  function close() { Music.stop(); battle.current?.destroy(); onClose(); router.refresh(); }

  async function finish() {
    Music.stop();
    const f = await finishBoss(sid.current).catch(() => null);
    if (!f || !f.ok) { setPhase({ k: "error", msg: "Couldn't save the result. Try again." }); return; }
    const r = f.data!;
    if (r.won) { Snd.play("win"); await battle.current?.win(); } else if (r.lost) { Snd.play("lose"); await battle.current?.lose(); } else Snd.play(r.damage ? "win" : "lose");
    setPhase({ k: "end", won: r.won, raid: r.raid, xp: r.xp, coins: r.coins, damage: r.damage, right: r.right, turns: r.turns });
  }

  async function attack() {
    if (busy) return; setBusy(true);
    const res = await nextBossQuestion(sid.current, sel).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) { setPhase({ k: "error", msg: res && !res.ok ? res.error : "Couldn't reach the server." }); return; }
    setText("");
    setPhase({ k: "ask", q: res.data! });
  }

  async function answer(k: number | null, q: Q, parry = false) {
    if (busy) return; setBusy(true);
    const written = q.kind === "written";
    if (written) setPhase({ k: "ask", q, marking: true });
    const res = await answerBoss(sid.current, k, written ? text : undefined).catch(() => null);
    if (!res || !res.ok) {
      setBusy(false);
      // A marking hiccup keeps the answer on screen to strike again.
      if (written && res && !res.ok) { setPhase({ k: "ask", q, line: res.error }); return; }
      setPhase({ k: "error", msg: res && !res.ok ? res.error : "Couldn't reach the server." }); return;
    }
    const r = res.data!, st = stats.current, b = battle.current;
    const marked = written ? { verdict: r.verdict, feedback: r.feedback, modelAnswer: r.modelAnswer, score: r.score } : undefined;
    setPhase({ k: "ask", q, parry, picked: written ? -2 : k, right: r.correctPosition, why: r.why, marked });
    st.tot++; if (r.correct) st.ok++;
    Snd.play(r.correct ? "ok" : "bad");
    await new Promise((x) => setTimeout(x, 450));
    let line: string;
    if (parry) {
      battle.current.G.warn = false;
      if (r.correct) { await b.bossAttack(0, true, r.heroHp); line = "Parry! You blocked the boss and gained 2 energy."; }
      else { await b.bossAttack(PARRY_HIT, false, r.heroHp); st.combo = 0; line = k === null ? `Too slow! The boss hit you for ${PARRY_HIT}.` : `Parry failed! The boss hit you for ${PARRY_HIT}.`; }
    } else if (r.score > 0 && r.score < 1) {
      const dmg = r.damage - st.damage; st.damage = r.damage;
      await b.heroAttack(dmg, false, r.bossHp);
      line = `Partly right: half a hit, ${dmg} damage.`;
    } else if (r.correct) {
      const dmg = r.damage - st.damage; st.damage = r.damage; st.combo++;
      await b.heroAttack(dmg, q.energy >= 7, r.bossHp);
      line = `Correct! ${dmg} damage.`;
      if (q.energy >= 7 && r.heroHp > b.G.hero.hp) { b.heal(5, r.heroHp); line += " You healed 5 HP."; }
    } else {
      st.combo = 0; await b.bossAttack(hitBack(q.energy), false, r.heroHp);
      line = `Not quite. The boss hit you for ${hitBack(q.energy)}.`;
      if (r.trap) line += ` That's the trap: “${r.trap.label}”.`;
    }
    st.energy = r.energy; st.turnsLeft = r.turnsLeft; if (!parry) { st.parryCool--; st.turn++; }
    sync();
    setPhase({ k: "ask", q, parry, picked: written ? -2 : k, right: r.correctPosition, why: r.trap ? r.trap.fix : r.why, line, marked });
    setBusy(false);
    if (r.won || r.lost || r.turnsLeft === 0) { setTimeout(finish, 700); return; }
  }

  async function next(after: "answer" | "charge") {
    const st = stats.current;
    // Now and then (after a right answer or a charge) the boss winds up a timed attack to parry.
    if (after === "answer" && st.turn >= 2 && st.parryCool <= 0 && shuffleChance()) return parry();
    setPhase({ k: "pick" });
  }

  async function parry() {
    stats.current.parryCool = 3;
    battle.current.G.warn = true; Snd.play("warn");
    setPhase({ k: "load" });
    await new Promise((x) => setTimeout(x, 1100));
    const res = await nextBossQuestion(sid.current, 0).catch(() => null);
    if (!res || !res.ok) { battle.current.G.warn = false; setPhase({ k: "pick" }); return; }
    setLeft(PARRY_SECONDS);
    setPhase({ k: "ask", q: res.data!, parry: true });
  }
  // The parry countdown: answer in time or take the hit.
  const parryQ = phase.k === "ask" && phase.parry && phase.picked === undefined ? phase.q : null;
  useEffect(() => {
    if (!parryQ) return;
    const t0 = Date.now();
    const iv = setInterval(() => {
      const l = Math.max(0, PARRY_SECONDS - Math.floor((Date.now() - t0) / 1000));
      setLeft(l); if (l <= 5 && l > 0) Snd.play("tick");
      if (l <= 0) { clearInterval(iv); void answer(null, parryQ, true); }
    }, 250);
    return () => clearInterval(iv);
  }, [parryQ]); // eslint-disable-line react-hooks/exhaustive-deps

  async function charge() {
    if (busy) return; setBusy(true);
    const res = await chargeBoss(sid.current).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) return;
    stats.current.energy = res.data!.energy; stats.current.turnsLeft = res.data!.turnsLeft; stats.current.combo = 0; stats.current.turn++; stats.current.parryCool--;
    Snd.play("ok"); battle.current?.charge(); sync();
    if (res.data!.turnsLeft === 0) { setTimeout(finish, 600); return; }
    setPhase({ k: "pick" });
  }

  const toggleSound = () => { Snd.on = !Snd.on; setSound(Snd.on); if (Snd.on) { Snd.init(); Music.start(); } else Music.stop(); };
  const mult = 1 + Math.min(stats.current.combo, 5) * 0.1;

  return (
    <div className="bg-overlay" role="dialog" aria-modal="true" aria-label={`Boss battle: ${chapterName}`} data-testid="boss-game" data-phase={phase.k}>
      <div className="bg-wrap">
        <div className="bg-top">
          <button type="button" className="px sm" onClick={close}>Leave</button>
          <b>{raidId ? "RAID: " : ""}{chapterName}</b>
          <button type="button" className="px sm" onClick={toggleSound}>{sound ? "Sound on" : "Sound off"}</button>
        </div>
        <canvas ref={canvasRef} width={320} height={180} className="bg-cv" aria-label={`${boss.name}. Your energy: ${energy}.`} />
        <div className="bg-panel" aria-live="polite">
          {phase.k === "load" && <p className="bg-load"><b>{boss.name}</b> appears!</p>}
          {phase.k === "error" && (
            <div className="bg-load"><p>{phase.msg}</p><div className="bg-btns"><button type="button" className="px go" onClick={() => void begin()}>Try again</button><button type="button" className="px" onClick={close}>Back</button></div></div>
          )}
          {phase.k === "pick" && (
            <>
              <div className="bg-h">Choose your attack: spend energy</div>
              <div className="ech-row" role="group" aria-label="Energy to spend">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" className={cn("px ech", `t${tierOf(n)}`, n === sel && "sel")} disabled={n > energy} aria-pressed={n === sel} onClick={() => { setSel(n); Snd.play("tick"); }}>{n}</button>
                ))}
              </div>
              <p className="bg-info">Spend <b>{Math.min(sel, energy)}</b> energy → <span className={cn("tg", `t${tierOf(sel)}`)}>{TIER_LABEL[tierOf(sel)]}</span> question → deals <b>{Math.round(Math.min(sel, energy) * 10 * mult)}</b> damage{stats.current.combo ? ` (combo +${Math.round((mult - 1) * 100)}%)` : ""}</p>
              <div className="bg-btns">
                <button type="button" className="px go" disabled={busy || sel > energy || energy < 1} onClick={() => void attack()} data-testid="boss-attack">ATTACK!</button>
                <button type="button" className="px" disabled={busy} onClick={() => void charge()} data-testid="boss-charge">Charge +3 energy <small>(skips your attack)</small></button>
              </div>
              {hasWritten && <p className="bg-hint"><b>Written questions</b> can come up too (more often on hard attacks): type or speak your answer. It&apos;s marked like your written quizzes: right is a full hit, partly right is half.</p>}
              <p className="bg-hint">More energy = a harder question and a bigger hit. A wrong answer costs the energy, and the boss hits back. Sometimes it winds up a <b>parry</b>: answer within {PARRY_SECONDS} seconds to block it.</p>
            </>
          )}
          {phase.k === "ask" && (
            <div className={cn("bgq", phase.parry && "parry")}>
              {phase.parry ? (
                <div className="pb-row"><span className="tg tw">PARRY! ANSWER TO BLOCK</span><b className={cn("pbt", left <= 8 && "hot")}>{phase.picked === undefined ? left : ""}</b></div>
              ) : <span className={cn("tg", `t${phase.q.tier}`)}>{TIER_LABEL[phase.q.tier]} · {phase.q.energy} energy</span>}
              {phase.parry && phase.picked === undefined && <div className="pbar"><i style={{ width: `${(left / PARRY_SECONDS) * 100}%` }} /></div>}
              <p className="bg-qt">{phase.q.stem}</p>
              {phase.q.kind === "written" ? (
                <div className="bg-write" data-testid="boss-written">
                  <span className="tg tw2">WRITTEN ANSWER</span>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={600} rows={4} disabled={!!phase.marked || phase.marking}
                    placeholder="Write your answer in your own words…" aria-label="Your answer" className="bg-ta" />
                  {!phase.marked && (
                    <div className="bg-btns">
                      <button type="button" className="px go" disabled={busy || text.trim().length < 2} onClick={() => void answer(null, phase.q)} data-testid="boss-strike">{phase.marking ? "Marking…" : "STRIKE!"}</button>
                      <VoiceInput onText={(t) => setText((v) => `${v}${v ? " " : ""}${t}`.slice(0, 600))} className="text-[#cfe0ff]" />
                    </div>
                  )}
                  {phase.marking && <p className="bg-hint">The judges are marking your answer…</p>}
                  {phase.marked && (
                    <div className="bg-marked">
                      <span className={cn("tg", phase.marked.score >= 1 ? "ok" : phase.marked.score > 0 ? "t2" : "no")}>{phase.marked.score >= 1 ? "CORRECT" : phase.marked.score > 0 ? "PARTLY CORRECT" : phase.marked.verdict === "SKIPPED" ? "BLANK" : "NOT QUITE"}</span>
                      {phase.marked.feedback && <p>{phase.marked.feedback}</p>}
                      <p className="bg-why"><b>Model answer:</b> {phase.marked.modelAnswer}</p>
                    </div>
                  )}
                </div>
              ) : (
              <div className="bg-opts">
                {phase.q.choices.map((c, i) => {
                  const done = phase.picked !== undefined, good = done && i === phase.right, bad = done && i === phase.picked && i !== phase.right;
                  return <button key={i} type="button" className={cn("px opt", good && "good", bad && "bad")} disabled={done || busy} onClick={() => void answer(i, phase.q, !!phase.parry)}><i>{"ABCD"[i]}</i><span>{c}</span></button>;
                })}
              </div>
              )}
              {phase.line && (
                <div className="bg-res">
                  <p><b className={(phase.marked ? phase.marked.score >= 0.5 : phase.picked === phase.right) ? "g" : "r"}>{phase.line}</b></p>
                  {phase.why && !phase.marked && <p className="bg-why">{phase.why}</p>}
                  {battle.current && battle.current.G.bos.hp > 0 && battle.current.G.hero.hp > 0 && stats.current.turnsLeft !== 0 && (
                    <button type="button" className="px go" onClick={() => void next(phase.parry ? "charge" : "answer")} data-testid="boss-next">Next turn</button>
                  )}
                </div>
              )}
            </div>
          )}
          {phase.k === "end" && (
            <div className={cn("bg-end", phase.won || (phase.raid && phase.damage) ? "win" : "lose")} data-testid="boss-end">
              <h3>{phase.raid ? "RAID TURNS OVER" : phase.won ? "VICTORY!" : "DEFEATED"}</h3>
              <p>{phase.raid ? `You dealt ${phase.damage} damage to the team boss.` : phase.won ? `You defeated ${boss.name}!` : `${boss.name} survived. Try lower energy for steady hits, and charge when you need more.`}</p>
              <div className="bg-loot"><span>+{phase.xp} XP</span><span className="pts">+{phase.coins} coins</span><span>{phase.right} right</span><span>{phase.damage} damage</span></div>
              <div className="bg-btns"><button type="button" className="px go" onClick={() => void begin()}>Fight again</button><button type="button" className="px" onClick={close}>Back to bosses</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
