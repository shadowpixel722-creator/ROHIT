/* eslint-disable */
// @ts-nocheck
/**
 * The Boss Battle canvas (ported from Knowa): sky, hills, floor, the boss and hero sprites, HP bars,
 * energy cells, slashes, particles, floating damage numbers, plus chiptune sound effects and music.
 * It only draws and animates; the battle's result always comes from the server.
 */
import { drawSprite, Look, PAL } from './pixel';

const W = 320, H = 180, GROUND = 142;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ── chiptune sounds and music (WebAudio, made on the device) ── */
export const Snd = { ctx: null, on: true,
  init() { try { if (!this.ctx) { const A = window.AudioContext || window.webkitAudioContext; if (A) this.ctx = new A() } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume() } catch (e) { } },
  beep(f, d, type, vol, to, delay) { if (!this.on || !this.ctx) return; try { const c = this.ctx, t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d); g.gain.setValueAtTime(vol || .05, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + .02) } catch (e) { } },
  play(n) { switch (n) {
    case 'swing': this.beep(300, .12, 'sawtooth', .04, 700); break;
    case 'hit': this.beep(180, .14, 'square', .07, 60); break;
    case 'big': this.beep(140, .25, 'square', .08, 40); this.beep(420, .1, 'triangle', .05, 120); break;
    case 'ok': [523, 659, 784].forEach((f, i) => this.beep(f, .1, 'square', .045, 0, i * .07)); break;
    case 'bad': this.beep(200, .3, 'sawtooth', .05, 70); break;
    case 'hurt': this.beep(120, .22, 'square', .08, 45); break;
    case 'win': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.beep(f, .14, 'square', .05, 0, i * .11)); break;
    case 'lose': [392, 330, 262, 196].forEach((f, i) => this.beep(f, .22, 'triangle', .06, 0, i * .18)); break;
    case 'tick': this.beep(660, .04, 'square', .03); break;
    case 'warn': [880, 660, 880, 660].forEach((f, i) => this.beep(f, .12, 'square', .06, 0, i * .14)); break;
    case 'block': this.beep(900, .08, 'square', .06, 1400); this.beep(500, .2, 'triangle', .06, 900, .06); break } },
};
export const Music = { on: false, timer: 0, step: 0, next: 0, gain: null, noise: null, tense: false,
  CH: [{ r: 110, m: [0, 3, 7] }, { r: 87.31, m: [0, 4, 7] }, { r: 130.81, m: [0, 4, 7] }, { r: 98, m: [0, 4, 7] }],
  hz(base, s) { return base * Math.pow(2, s / 12) },
  tone(f, t, d, type, v) { const c = Snd.ctx; if (!c || !this.gain) return; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(this.gain); o.start(t); o.stop(t + d + .02) },
  drum(t, kind) { const c = Snd.ctx; if (!c || !this.gain) return;
    if (kind === 'k') { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + .12); g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.0001, t + .14); o.connect(g); g.connect(this.gain); o.start(t); o.stop(t + .16); return }
    if (!this.noise) { const n = c.sampleRate * .3, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.noise = buf }
    const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter(); s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = kind === 's' ? 1200 : 6000; g.gain.setValueAtTime(kind === 's' ? .35 : .12, t); g.gain.exponentialRampToValueAtTime(.0001, t + (kind === 's' ? .13 : .04)); s.connect(f); f.connect(g); g.connect(this.gain); s.start(t); s.stop(t + .15) },
  sched() {
    const c = Snd.ctx; if (!c || !this.on) return;
    while (this.next < c.currentTime + .15) {
      const st = this.step % 32, ch = this.CH[Math.floor(st / 8) % 4], i = st % 8, t = this.next, sp = 60 / (this.tense ? 172 : 140) / 2;
      this.tone(this.hz(ch.r, [0, 0, 12, 0, 0, 0, 12, 7][i]), t, sp * .9, 'triangle', .22);
      this.tone(this.hz(ch.r * 4, ch.m[[0, 1, 2, 1, 0, 1, 2, 1][i]]), t, sp * .8, 'square', .045);
      if (st % 8 === 0 && (Math.floor(st / 8) % 2 === 1)) this.tone(this.hz(ch.r * 8, ch.m[2]), t, sp * 3, 'square', .03);
      if (i === 0 || i === 4) this.drum(t, 'k'); if (i === 2 || i === 6) this.drum(t, 's'); if (i % 2 === 1) this.drum(t, 'h');
      this.next += sp; this.step++;
    }
  },
  start() { if (this.on || !Snd.on || !Snd.ctx) return; this.on = true; const c = Snd.ctx; this.gain = c.createGain(); this.gain.gain.value = .16; this.gain.connect(c.destination); this.step = 0; this.next = c.currentTime + .1; this.timer = setInterval(() => this.sched(), 40) },
  stop() { this.on = false; clearInterval(this.timer); if (this.gain) { const g = this.gain; try { g.gain.setTargetAtTime(0, Snd.ctx.currentTime, .08) } catch (e) { } setTimeout(() => { try { g.disconnect() } catch (e) { } }, 500); this.gain = null } },
};

export function createBattle(canvas, boss, look, maxHp) {
  const G = { hero: { x: 40, dx: 0, hp: 100, max: 100, shown: 100, fl: 0, dis: 0, jump: 0 }, bos: { x: 200, dx: 0, dy: 0, hp: maxHp, max: maxHp, shown: maxHp, fl: 0, dis: 0 },
    floats: [], parts: [], shake: 0, energy: 5, combo: 0, score: 0, slash: 0, slashX: 0, slashY: 0, swing: 0, warn: false, shield: 0, turnsLeft: null, open: true };
  let raf = 0;
  const lerp = (a, b2, k) => { const x = parseInt(a.slice(1), 16), y = parseInt(b2.slice(1), 16); const r = Math.round((x >> 16) + (((y >> 16) - (x >> 16)) * k)), g = Math.round(((x >> 8) & 255) + ((((y >> 8) & 255) - ((x >> 8) & 255)) * k)), bl = Math.round((x & 255) + (((y & 255) - (x & 255)) * k)); return `rgb(${r},${g},${bl})` };
  function scene(c, t) {
    const [s0, s1] = boss.sky;
    for (let i = 0; i < 10; i++) { c.fillStyle = lerp(s0, s1, i / 9); c.fillRect(0, i * 14, W, 14) }
    for (let i = 0; i < 36; i++) { const x = (i * 53) % W, y = (i * 31) % 90; if (Math.sin(t / 500 + i) > .2) { c.fillStyle = i % 5 === 0 ? '#ffe9a8' : '#cfe0ff'; c.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1) } }
    c.fillStyle = '#f2efc8'; c.beginPath(); c.arc(268, 26, 11, 0, 7); c.fill(); c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(264, 22, 4, 4); c.fillRect(270, 29, 3, 3);
    const cx = (t / 90) % (W + 60) - 40; c.fillStyle = 'rgba(255,255,255,.10)'; c.fillRect(cx, 36, 34, 6); c.fillRect(cx + 8, 32, 18, 6); c.fillRect((cx + 150) % (W + 60) - 40, 52, 28, 5);
    for (let x = 0; x < W; x += 8) { const h = Math.floor(34 + 14 * Math.sin(x * .05) + 8 * Math.sin(x * .13)); c.fillStyle = 'rgba(10,14,30,.55)'; c.fillRect(x, GROUND - h - 6, 8, h) }
    for (let x = 0; x < W; x += 8) { const h = Math.floor(16 + 8 * Math.sin(x * .09 + 1)); c.fillStyle = 'rgba(6,9,20,.75)'; c.fillRect(x, GROUND - h, 8, h) }
    c.fillStyle = boss.gr; c.fillRect(0, GROUND, W, H - GROUND); c.fillStyle = boss.gr2; for (let x = 0; x < W; x += 16) { c.fillRect(x, GROUND + 10, 8, 4); c.fillRect(x + 8, GROUND + 24, 8, 4) }
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(0, GROUND, W, 2);
  }
  function bar(c, x, y, w, h, v, max, col, label) {
    c.fillStyle = '#05070f'; c.fillRect(x - 2, y - 2, w + 4, h + 4); c.fillStyle = '#2a3558'; c.fillRect(x - 1, y - 1, w + 2, h + 2); c.fillStyle = '#101830'; c.fillRect(x, y, w, h);
    const f = Math.round(w * clamp(v / max, 0, 1)); c.fillStyle = col; c.fillRect(x, y, f, h); c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(x, y, f, 2);
    c.font = 'bold 7px monospace'; c.textBaseline = 'bottom'; c.fillStyle = '#fff'; c.textAlign = 'left'; c.fillText(label, x, y - 3);
  }
  function frame(now) {
    if (!G.open) return; raf = requestAnimationFrame(frame);
    const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
    const sh = G.shake > .3 ? G.shake : 0; G.shake *= .88;
    c.save(); c.clearRect(0, 0, W, H); if (sh) c.translate(Math.round((Math.random() - .5) * sh), Math.round((Math.random() - .5) * sh));
    scene(c, now);
    const H0 = G.hero, B0 = G.bos, bob = Math.round(Math.sin(now / 320) * 2), bob2 = Math.round(Math.sin(now / 430 + 1) * 3);
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(H0.x + 6 + H0.dx, GROUND + 2, 36, 4); c.fillRect(B0.x + 6 + B0.dx, GROUND + 3, 100, 6);
    drawSprite(c, boss.id, B0.x + B0.dx + (G.warn ? Math.round((Math.random() - .5) * 4) : 0), GROUND - 112 + bob2 + B0.dy, 7, { flash: now < B0.fl ? '#ffffff' : null, dis: B0.dis });
    const hy = GROUND - 48 + (H0.jump || 0) + bob;
    Look.draw(c, H0.x + H0.dx, hy, 3, now, { flash: now < H0.fl ? '#ff4a4a' : null, dis: H0.dis, eq: look });
    if (!H0.dis) { const sw = G.swing ? Math.min(1, (now - G.swing) / 260) : 0; Look.sword(c, H0.x + H0.dx, hy, 3, .5 + sw * 1.1, now, G.parts, look); Look.aura(G.parts, H0.x + H0.dx, hy, 3, look) }
    if (G.slash && now - G.slash < 200) { const k = (now - G.slash) / 200; c.fillStyle = `rgba(255,255,255,${1 - k})`; for (let i = 0; i < 9; i++) c.fillRect(Math.round(G.slashX - 24 + i * 6), Math.round(G.slashY - 30 + i * 7 - k * 6), 7, 4) }
    Look.step(c, G.parts);
    G.floats = G.floats.filter(f => now - f.t < 1100); G.floats.forEach(f => { const k = (now - f.t) / 1100; c.font = 'bold 12px monospace'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.globalAlpha = 1 - k * k; c.fillStyle = '#000'; c.fillText(f.txt, f.x + 1, f.y - k * 26 + 1); c.fillStyle = f.col; c.fillText(f.txt, f.x, f.y - k * 26); c.globalAlpha = 1 });
    H0.shown += (H0.hp - H0.shown) * .18; B0.shown += (B0.hp - B0.shown) * .18;
    bar(c, 10, 16, 110, 7, H0.shown, H0.max, H0.hp / H0.max > .3 ? '#4ade80' : '#ff5a5a', `HERO  ${Math.max(0, Math.round(H0.hp))}/${H0.max}`);
    bar(c, 170, 16, 140, 7, B0.shown, B0.max, '#ff5a5a', `${boss.name.toUpperCase().slice(0, 24)}  ${Math.max(0, Math.round(B0.hp))}`);
    for (let i = 0; i < 10; i++) { const x = 10 + i * 11; c.fillStyle = '#05070f'; c.fillRect(x - 1, 28, 10, 9); c.fillStyle = i < G.energy ? (i < 3 ? '#5eead4' : i < 6 ? '#ffd23a' : '#ff7a45') : '#1b2440'; c.fillRect(x, 29, 8, 7); if (i < G.energy) { c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x, 29, 8, 2) } }
    c.font = 'bold 7px monospace'; c.fillStyle = '#8fc8ff'; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText('ENERGY', 10, 46);
    c.textAlign = 'right'; c.fillStyle = '#ffd23a'; if (G.turnsLeft != null) c.fillText(`RAID  TURNS ${G.turnsLeft}`, 310, 36);
    if (G.combo > 1) { c.fillStyle = '#ffd23a'; c.font = 'bold 8px monospace'; c.fillText(`COMBO x${G.combo}`, 310, 46) }
    if (G.warn) { const a = .12 + .12 * Math.sin(now / 80); c.fillStyle = `rgba(255,50,50,${a})`; c.fillRect(0, 0, W, H); c.font = 'bold 18px monospace'; c.textAlign = 'center'; c.fillStyle = Math.floor(now / 160) % 2 ? '#ffd23a' : '#ff5a5a'; c.fillText('PARRY!', 160, 96) }
    if (G.shield && now - G.shield < 450) { const k = (now - G.shield) / 450; c.globalAlpha = 1 - k; c.fillStyle = '#5eead4'; for (let i = 0; i < 9; i++) c.fillRect(H0.x + 52 + Math.round(Math.sin(i / 8 * Math.PI) * 8), GROUND - 58 + i * 5, 4, 5); c.globalAlpha = 1 }
    c.restore();
    Music.tense = B0.hp / B0.max < .3 || H0.hp / H0.max < .3;
  }
  raf = requestAnimationFrame(frame);
  const tween = (ms, fn) => new Promise(res => { const t0 = performance.now(), step = n => { if (!G.open) { fn(1); return res() } const t = Math.min(1, (n - t0) / ms); fn(t); t < 1 ? requestAnimationFrame(step) : res() }; requestAnimationFrame(step) });
  const float = (txt, x, y, col) => G.floats.push({ txt, x, y, col, t: performance.now() });
  const burst = (x, y, cols, n, sp) => { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = (sp || 1) * (.6 + Math.random() * 1.6); G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, l: 1, c: cols[Math.floor(Math.random() * cols.length)], s: 2 + Math.floor(Math.random() * 2) }) } };
  return {
    G,
    async heroAttack(dmg, big, bossHpAfter) {
      Snd.play('swing'); G.swing = performance.now();
      await tween(240, t => { G.hero.dx = Math.round(Math.sin(t * Math.PI / 2) * 112) });
      Snd.play(big ? 'big' : 'hit'); G.slash = performance.now(); G.slashX = G.bos.x + 50; G.slashY = GROUND - 56;
      G.bos.fl = performance.now() + 140; G.shake = big ? 9 : 5; G.bos.hp = bossHpAfter;
      float('-' + dmg, G.bos.x + 56, GROUND - 118, big ? '#ffd23a' : '#ffffff'); burst(G.bos.x + 56, GROUND - 56, ['#ffffff', '#ffd23a', '#ff9a3c'], big ? 26 : 14, big ? 2.6 : 1.8);
      await tween(160, () => { });
      await tween(240, t => { G.hero.dx = Math.round((1 - t) * 112) }); G.hero.dx = 0; G.swing = 0;
    },
    async bossAttack(dmg, blocked, heroHpAfter) {
      await tween(300, t => { G.bos.dx = -Math.round(Math.sin(t * Math.PI / 2) * 100) });
      if (blocked) { Snd.play('block'); G.shield = performance.now(); G.shake = 4; float('PARRY!', G.hero.x + 30, GROUND - 70, '#5eead4'); burst(G.hero.x + 50, GROUND - 34, ['#5eead4', '#ffffff', '#bff'], 16, 2.2) }
      else { Snd.play('hurt'); G.hero.fl = performance.now() + 220; G.shake = 9; G.hero.hp = heroHpAfter; float('-' + dmg, G.hero.x + 24, GROUND - 70, '#ff6b6b'); burst(G.hero.x + 24, GROUND - 32, ['#ff5a5a', '#ffb4b4'], 12, 2) }
      await tween(180, () => { });
      await tween(260, t => { G.bos.dx = -Math.round((1 - t) * 100) }); G.bos.dx = 0;
    },
    heal(n, heroHpAfter) { G.hero.hp = heroHpAfter; float('+' + n, G.hero.x + 24, GROUND - 70, '#4ade80'); burst(G.hero.x + 24, GROUND - 40, ['#4ade80', '#bbf7d0'], 8, 1.2) },
    charge() { float('+3 ENERGY', G.hero.x + 24, GROUND - 80, '#5eead4'); burst(G.hero.x + 24, GROUND - 30, ['#5eead4', '#e6fffb'], 14, 1.4) },
    async win() { await tween(900, t => { G.bos.dis = t }); burst(G.bos.x + 56, GROUND - 56, Object.values(PAL[boss.id]), 50, 3.2); for (let i = 0; i < 60; i++) burst(Math.random() * W, -4, ['#ffd23a', '#5eead4', '#ff7a45', '#8fc8ff', '#ffffff'], 1, .6); G.hero.jump = -10; setTimeout(() => { G.hero.jump = 0 }, 300) },
    async lose() { await tween(700, t => { G.hero.dis = t }) },
    destroy() { G.open = false; cancelAnimationFrame(raf) },
  };
}
