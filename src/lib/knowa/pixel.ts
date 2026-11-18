/* eslint-disable */
// @ts-nocheck
/**
 * Pixel art for Boss Battles and the hero shop (ported from Knowa): 16×16 sprites drawn mirrored from
 * their left half, palettes, the hero's equipment (armour colours, hats, swords, capes, auras) and
 * particles. Canvas only; nothing here talks to the server.
 */
import { itemOf } from "../game";

const HALF = {
  slime: ['........', '........', '........', '........', '....oooo', '..oooaaa', '.oaaaaaa', '.oacaaaa', 'oaccaaaa', 'oaaaeepa', 'oaaaeepa', 'oaaaaaaa', 'oabbbmmm', 'obbbbbbb', '.oobbbbb', '..oooooo'],
  wraith: ['........', '....oooo', '..ooaaaa', '.oaaaaaa', '.oaaaaaa', 'oaaaaaaa', 'oaaaeepa', 'oaaaeepa', 'oaaaaaaa', 'oaaabmmm', 'oaaaammm', 'oaaaaaaa', 'oaaaaaaa', 'oaaoaaoa', 'oao.oao.', '.o..o...'],
  goblin: ['........', '....oooo', '..ooaaaa', 'ooaaaaaa', 'oaaaaaaa', 'ooaaaaaa', '.oaaaaaa', '.oaaeepa', '.oaaeepa', '.oaaaaaa', '.oaaammm', '..oabmmm', '..ooobbb', '.ooccbbb', '.oc..obb', '.ooo.ooo'],
  golem: ['........', '..oooooo', '.oggggcc', '.ogggggg', '.ogggyyg', '.ogggyyg', '.ogggggg', 'oooooooo', 'ogggggcc', 'ogbbggcc', 'ogbbgggg', 'ogggggbb', 'oooooooo', '.ogggbbb', '.ogg.ooo', '.ooo....'],
  dragon: ['..o.....', '..oo.ooo', '..oaooaa', '..oaaaaa', '.oaaaaaa', '.oaayepa', 'oaaaaaaa', 'oaaaaaaa', 'oaabbbbb', 'oabbbbcc', 'obbbbccc', 'obbbbccc', 'oabbbccc', '.oabbbbb', '.oaoo.oo', '.ooo....'],
  skull: ['..y.yyyy', '.yyyyyyy', '..oooooo', '.owwwwww', 'owwwwwww', 'owwoooww', 'owwoyoww', 'owwwwwww', '.owwwwww', '.oowwwww', '..owowow', '..owowow', '..oooooo', '........', '........', '........'],
  hero: ['....mmmm', '...ooooo', '..ogcggg', '.ogggggg', '.ogggggg', '.ogoeeoo', '.ogggggg', '..oooooo', '.oaaaaaa', 'oaacaaaa', 'oaaaaaaa', 'oayyyyyy', '.obbbbbb', '.obbbbbb', '.obbbbo.', '.oooooo.'],
};
export const SPR = {}; Object.keys(HALF).forEach(k => { SPR[k] = HALF[k].map(r => r + r.split('').reverse().join('')) });
export const PAL = {
  slime: { o: '#12301c', a: '#5ad66f', b: '#2e9a4a', c: '#c8ffd0', e: '#ffffff', p: '#111111', m: '#7a1d2b' },
  wraith: { o: '#1b1230', a: '#b9a2ff', b: '#7f63d9', c: '#e6dcff', e: '#ffffff', p: '#111111', m: '#2a0f3a' },
  goblin: { o: '#1a2a10', a: '#7ec850', b: '#4a8a2a', c: '#d4f2a0', e: '#ffffff', p: '#cc0000', m: '#5a1010', y: '#ffd44a' },
  golem: { o: '#171821', g: '#8a93a6', c: '#c3cad8', b: '#5c6478', y: '#ffcf3a', m: '#222222' },
  dragon: { o: '#2a0d0d', a: '#ef5350', b: '#b3302e', c: '#ffd59a', y: '#ffe14a', e: '#ffffff', p: '#111111' },
  skull: { o: '#151520', w: '#eceff4', y: '#ffd23a', p: '#111111' },
  hero: { o: '#0e1330', g: '#aab4c8', c: '#e6ecf8', m: '#ff5a5a', e: '#8fc8ff', a: '#4c7dff', b: '#2a3f99', y: '#ffd23a' },
};
export const BOSSES = [
  { id: 'slime', name: 'Slimey the Sum Slime', sky: ['#0a1736', '#1f4a86'], gr: '#2c6b45', gr2: '#1f4d33' },
  { id: 'wraith', name: 'Wraith of Wrong Answers', sky: ['#150b2e', '#43207a'], gr: '#3a2f66', gr2: '#2a2150' },
  { id: 'goblin', name: 'Goblin Grammarian', sky: ['#0c1a12', '#285c3a'], gr: '#4d7a2d', gr2: '#365a1f' },
  { id: 'golem', name: 'Stone Golem of Doubt', sky: ['#14161f', '#3b4764'], gr: '#59627a', gr2: '#434b5f' },
  { id: 'dragon', name: 'Dragon of Deadlines', sky: ['#240a0a', '#8a2e1e'], gr: '#7a3a26', gr2: '#5a2a1b' },
  { id: 'skull', name: 'Skull King of Exams', sky: ['#05060f', '#1a1f45'], gr: '#2b2f55', gr2: '#1f2240' },
];
export const bossFor = t => { let h = 0; String(t).split('').forEach(c => { h = (h * 31 + c.charCodeAt(0)) >>> 0 }); return BOSSES[h % BOSSES.length] };
const hash = (i, j) => (((i + 1) * 73856093) ^ ((j + 1) * 19349663)) >>> 0;
const hp01 = (i, j) => (hash(i, j) % 1000) / 1000;
export function drawSprite(c, name, x, y, sc, o) {
  o = o || {}; const rows = SPR[name], pal = o.pal || PAL[name];
  for (let j = 0; j < 16; j++) { const r = rows[j]; for (let i = 0; i < 16; i++) { const ch = r[i]; if (ch === '.') continue; if (o.dis && hp01(i, j) < o.dis) continue;
    c.fillStyle = o.flash || pal[ch] || '#f0f'; c.fillRect(Math.round(x + i * sc), Math.round(y + j * sc), sc, sc) } }
}
const iconCache = {};
export function spriteIcon(name, px) { const k = name + px; if (iconCache[k]) return iconCache[k]; const cv = document.createElement('canvas'); cv.width = cv.height = px; drawSprite(cv.getContext('2d'), name, 0, 0, px / 16); return iconCache[k] = cv.toDataURL() }

const HPAL = { y: '#ffd23a', r: '#e5484d', p: '#7c4dff', w: '#f2efe6', g: '#5eead4', o: '#14102a' };
const rb = (now, o) => `hsl(${Math.floor(now / 6 + (o || 0)) % 360},85%,60%)`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Draws the hero wearing `eq` ({ armor, hat, sword, cape, aura }). */
export const Look = {
  pal(eq, now) { const a = itemOf('armor', eq.armor), p = Object.assign({}, PAL.hero); if (a.rb) { p.a = `hsl(${Math.floor(now / 8) % 360},80%,58%)`; p.b = `hsl(${Math.floor(now / 8) % 360},70%,34%)` } else if (a.pal) Object.assign(p, a.pal); return p },
  draw(c, x, y, sc, now, o) {
    o = o || {}; const eq = o.eq, show = !(o.dis > .3);
    const cp = itemOf('cape', eq.cape);
    if (cp.id !== 'none' && show) { for (let j = 0; j < 7; j++) { const len = 2 + Math.floor(j * .45) + Math.round(Math.sin(now / 230 + j * .7) * 1.2); const col = o.flash || (cp.rb ? rb(now, j * 18) : (j % 3 === 2 ? cp.t : cp.c)); c.fillStyle = col; c.fillRect(Math.round(x + (1 - len) * sc), Math.round(y + (8 + j) * sc), len * sc, sc) } }
    drawSprite(c, 'hero', x, y, sc, { flash: o.flash, dis: o.dis, pal: this.pal(eq, now) });
    const h = itemOf('hat', eq.hat);
    if (h.g && show) { Object.keys(h.g).forEach(j => { const half = h.g[j], row = half + half.split('').reverse().join(''); for (let i = 0; i < 16; i++) { const ch = row[i]; if (ch === '.') continue; c.fillStyle = o.flash || HPAL[ch] || '#fff'; c.fillRect(Math.round(x + i * sc), Math.round(y + (+j) * sc), sc, sc) } }) }
  },
  sword(c, hx, hy, sc, ang, now, parts, eq) {
    const s = itemOf('sword', eq.sword), f = sc / 3, sx = hx + 15 * sc, sy = hy + Math.round(7.33 * sc), px = Math.max(2, Math.round(3 * f));
    c.fillStyle = '#6b4a2a'; c.fillRect(Math.round(sx), Math.round(sy + 2 * f * 3), Math.round(5 * f), Math.round(3 * f)); c.fillStyle = '#ffd23a'; c.fillRect(Math.round(sx + f), Math.round(sy + f * 3), Math.max(2, Math.round(2 * f)), Math.round(6 * f));
    let tx = 0, ty = 0;
    for (let k = 0; k < 11; k++) { c.fillStyle = k > 8 ? '#ffffff' : (s.rb ? rb(now, k * 14) : s.col); tx = Math.round(sx + 2 * f + Math.sin(ang) * k * 2.8 * f); ty = Math.round(sy + 2 * f - Math.cos(ang) * k * 2.8 * f); c.fillRect(tx, ty, px, px) }
    if (s.fx && parts && Math.random() < .4) parts.push({ x: tx + px / 2, y: ty, vx: (Math.random() - .5) * .8, vy: -.4 - Math.random() * .6, g: -.01, dl: .04, l: 1, c: s.fx[Math.floor(Math.random() * s.fx.length)], s: Math.max(1, Math.round(2 * f)) });
  },
  aura(parts, x, y, sc, eq) {
    const a = itemOf('aura', eq.aura); if (a.id === 'none' || Math.random() > .32) return;
    const cx = x + 8 * sc, r = Math.random, col = a.cols[Math.floor(r() * a.cols.length)], f = sc / 3;
    const p = { x: cx + (r() - .5) * 14 * sc, y: y + (2 + r() * 13) * sc, vx: 0, vy: -.3, g: 0, dl: .018, l: 1, c: col, s: Math.max(2, Math.round(2 * f)) };
    if (a.id === 'flame') { p.y = y + (10 + r() * 6) * sc; p.vy = -.9 - r(); p.vx = (r() - .5) * .4; p.dl = .03 }
    else if (a.id === 'snow') { p.y = y - 4 * sc; p.vy = .5; p.vx = (r() - .5) * .5; p.dl = .012 }
    else if (a.id === 'hearts') { p.vy = -.5; p.s = Math.max(3, Math.round(3 * f)) }
    else if (a.id === 'stars') { p.s = Math.max(3, Math.round(3 * f)); p.vx = (r() - .5) * .8; p.vy = -.2 - r() * .4 }
    parts.push(p);
  },
  step(c, parts) { for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vy += (p.g == null ? .12 : p.g); p.l -= (p.dl || .022); if (p.l <= 0) { parts.splice(i, 1); continue } c.globalAlpha = clamp(p.l, 0, 1); c.fillStyle = p.c; c.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s) } c.globalAlpha = 1 },
};

/** A night-sky background with a floor, for the shop preview. */
export function previewScene(c, w, h, now) {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0a1736'); g.addColorStop(1, '#1f4a86'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 24; i++) { if (Math.sin(now / 500 + i) > .2) { c.fillStyle = '#cfe0ff'; c.fillRect((i * 53) % w, (i * 31) % (h * .45), i % 5 ? 1 : 2, i % 5 ? 1 : 2) } }
  c.fillStyle = '#2c6b45'; c.fillRect(0, h - 18, w, 18); c.fillStyle = '#1f4d33'; for (let x = 0; x < w; x += 16) c.fillRect(x, h - 10, 8, 4);
}
