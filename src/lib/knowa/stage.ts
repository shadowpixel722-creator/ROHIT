/* eslint-disable */
// @ts-nocheck
/**
 * The 3D stage for narrated lessons (ported from Knowa): WebGL scene, orbit camera with eased "go to view",
 * part focus with dimming and a pulse, floating info tags and labels, the live readout, and the parameter
 * controls (sliders and choices). Driven imperatively by the lesson player.
 */
export type StageEls = { box: HTMLElement; canvas: HTMLCanvasElement; tags: HTMLElement; controls: HTMLElement; readout: HTMLElement };

export function createStage(THREE, MODELS, els) {
  const { box, canvas: el, tags: tagsEl, controls: ctlEl, readout: readEl } = els;
  let renderer = null, ok = true;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.localClippingEnabled = true;
  } catch (e) { ok = false }
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, .1, 300);
  // Modern three.js uses physical light units: π× the original intensities gives the original look.
  const PI = Math.PI;
  const amb = new THREE.AmbientLight(0xaac8ff, .55 * PI), dirL = new THREE.DirectionalLight(0xffffff, .95 * PI); dirL.position.set(5, 9, 7);
  const back = new THREE.DirectionalLight(0x4c9dff, .5 * PI); back.position.set(-6, -3, -6);
  scene.add(amb, dirL, back);
  const grid = new THREE.GridHelper(44, 44, 0x4c9dff, 0x0c2550); grid.material.transparent = true; grid.material.opacity = .16; grid.position.y = -.05; scene.add(grid);

  let inst = null, def = null, params = {}, modelId = null, tagEls = [], stags = [], focusSet = new Set(), focusName = null; const rootHolder = new THREE.Group();
  scene.add(rootHolder);
  const S = { t: new THREE.Vector3(), r: 16, th: 0, ph: 1.2 }, G = { t: new THREE.Vector3(), r: 16, th: 0, ph: 1.2, on: false, k: 3.2, live: null };
  let minR = 5, maxR = 60, lastInput = -1e9, now = 0, disposed = false, raf = 0;
  const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a };
  function sphFrom(pos, target) { const o = pos.clone().sub(target), r = o.length(); return { r, ph: Math.acos(THREE.MathUtils.clamp(o.y / r, -1, 1)), th: Math.atan2(o.x, o.z) } }
  const arr = v => (v && v.toArray ? v.toArray() : v);
  function goPosTarget(p, t, instant) {
    const tv = new THREE.Vector3(...arr(t)), pv = new THREE.Vector3(...arr(p)), s = sphFrom(pv, tv);
    G.t.copy(tv); G.r = s.r; G.ph = s.ph; G.th = S.th + wrap(s.th - S.th); G.on = true; G.live = null; G.k = 3.2;
    if (instant) { S.t.copy(G.t); S.r = G.r; S.ph = G.ph; S.th = G.th; G.on = false }
  }
  function go(v, instant) {
    if (!def) return;
    const view = typeof v === 'string' ? (def.views && def.views[v]) : v;
    if (!view) return;
    const val = typeof view === 'function' ? view(params, inst) : view;
    if (val.live) { G.live = val.live; G.on = true; G.k = 2.4; return }
    goPosTarget(val.pos, val.target, instant);
  }
  function applyGoal(dt) {
    if (G.live) { const v = G.live(inst); const s = sphFrom(new THREE.Vector3(...arr(v.pos)), new THREE.Vector3(...arr(v.target))); G.t.set(...arr(v.target)); G.r = s.r; G.ph = s.ph; G.th = S.th + wrap(s.th - S.th); G.on = true }
    if (!G.on) return;
    const k = 1 - Math.exp(-dt * G.k);
    S.t.lerp(G.t, k); S.r += (G.r - S.r) * k; S.ph += (G.ph - S.ph) * k; S.th += wrap(G.th - S.th) * k;
    if (!G.live && S.t.distanceTo(G.t) < .01 && Math.abs(S.r - G.r) < .02 && Math.abs(S.ph - G.ph) < .002 && Math.abs(wrap(G.th - S.th)) < .002) G.on = false;
  }
  // Views were framed for a wide stage; on a narrow (phone) stage the camera stands further back so the model fits.
  function placeCam() { const fit = Math.min(2, Math.max(1, 1.45 / (camera.aspect || 1.6))), r = S.r * fit, sp = Math.sin(S.ph); camera.position.set(S.t.x + r * sp * Math.sin(S.th), S.t.y + r * Math.cos(S.ph), S.t.z + r * sp * Math.cos(S.th)); camera.lookAt(S.t) }
  const ptrs = new Map(); let pinch = 0;
  const api = { onUser: null as null | (() => void), onModel: null as null | ((id: string) => void) };
  function userInput() { G.on = false; G.live = null; lastInput = now }
  const onDown = e => { el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); userInput(); api.onUser && api.onUser() };
  const onMove = e => {
    if (!ptrs.has(e.pointerId)) return; const p = ptrs.get(e.pointerId); const dx = e.clientX - p[0], dy = e.clientY - p[1]; ptrs.set(e.pointerId, [e.clientX, e.clientY]); userInput();
    if (ptrs.size === 1) { S.th -= dx * .0075; S.ph = THREE.MathUtils.clamp(S.ph - dy * .0075, .12, Math.PI - .12) }
    else if (ptrs.size === 2) { const a = [...ptrs.values()]; const d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); if (pinch) S.r = THREE.MathUtils.clamp(S.r * pinch / d, minR, maxR); pinch = d }
  };
  const up = e => { ptrs.delete(e.pointerId); pinch = 0 };
  const onWheel = e => { e.preventDefault(); userInput(); S.r = THREE.MathUtils.clamp(S.r * Math.exp(e.deltaY * .0011), minR, maxR) };
  el.addEventListener('pointerdown', onDown); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', onWheel, { passive: false });
  function resize() { const w = box.clientWidth, h = box.clientHeight; if (!w || !h || !renderer) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix() }
  const ro = new ResizeObserver(resize); ro.observe(box);

  function dispose(root) { root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()) } }) }
  function collect() {
    if (!inst) return;
    for (const p of Object.values(inst.parts)) {
      const set = new Set();
      p.objs.forEach(o => o.traverse(n => { if (!n.material) return; (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => {
        if (m.userData.base === undefined) m.userData.base = m.opacity;
        if (m.emissiveIntensity !== undefined && m.userData.be === undefined) m.userData.be = m.emissiveIntensity; set.add(m) }) }));
      p.mats = [...set];
    }
    setFocus(focusName, true);
  }
  function resolve(n) { if (!n || !inst) return null; if (inst.alias && inst.alias[n]) n = inst.alias[n](params); return inst.parts[n] || null }
  function partVisible(p) { return p && (!p.vis || p.vis(params)) && p.objs.length > 0 }
  function setFocus(name, quiet) {
    focusName = name || null; focusSet = new Set();
    const names = !name ? [] : Array.isArray(name) ? name : [name];
    names.forEach(n => { const p = resolve(n); if (p) focusSet.add(p) });
    if (inst) for (const p of Object.values(inst.parts)) p.tf = (focusSet.size && !focusSet.has(p) && !p.keep) ? .13 : 1;
    clearTags();
    if (focusSet.size && !quiet) { const p = [...focusSet][0]; if (partVisible(p)) addTag(p) }
  }
  const labelOf = p => typeof p.label === 'function' ? p.label(params) : p.label;
  function infoOf(p) { return typeof p.info === 'function' ? p.info(params) : (p.info || '') }
  function addTag(p) {
    const d = document.createElement('div'); d.className = 'ks-tag';
    d.innerHTML = '<i class="ln"></i><i class="dot"></i><div class="body"><b></b><span></span></div>';
    d.querySelector('b').textContent = labelOf(p); d.querySelector('span').textContent = infoOf(p);
    tagsEl.appendChild(d); tagEls.push({ el: d, part: p });
  }
  function clearTags() { tagEls.forEach(t => t.el.remove()); tagEls = [] }
  function anchorOf(p) {
    if (p.anchor) return p.anchor(params);
    const b = new THREE.Box3(); p.objs.forEach(o => { if (o.visible !== false) b.expandByObject(o) });
    return b.isEmpty() ? new THREE.Vector3() : b.getCenter(new THREE.Vector3());
  }
  function project(v) { const w = box.clientWidth, h = box.clientHeight; const p = v.clone().project(camera); return { x: (p.x * .5 + .5) * w, y: (-p.y * .5 + .5) * h, z: p.z } }
  function screenPosOf(name) { const p = resolve(name); if (!p) return null; const s = project(anchorOf(p)); const r = box.getBoundingClientRect(); return { x: r.left + s.x, y: r.top + s.y } }
  function frame(name) {
    const p = resolve(name); if (!p || p.frame === false || !partVisible(p)) return;
    if (p.view) { go(p.view); return }
    const b = new THREE.Box3(); p.objs.forEach(o => { if (o.visible !== false) b.expandByObject(o) }); if (b.isEmpty()) return;
    const c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3()).length();
    G.t.copy(c); G.r = THREE.MathUtils.clamp(size * 1.7 + 4.5, minR, Math.min(maxR, S.r * 1.05)); G.ph = S.ph; G.th = S.th; G.on = true; G.live = null; G.k = 2.6;
  }
  function load(id) {
    const d = MODELS[id]; if (!d) return false;
    if (inst && inst.root) { rootHolder.remove(inst.root); dispose(inst.root) }
    clearTags(); stags.forEach(s => s.el.remove()); stags = []; focusSet = new Set(); focusName = null;
    def = d; modelId = id; params = {}; d.params.forEach(p => params[p.id] = p.val);
    const ctx = { params, renderer, refresh: () => { collect(); paintLabels() }, uiSet: (k, v) => uiSet(k, v), readout: () => paintReadout() };
    inst = d.build(ctx); rootHolder.add(inst.root);
    amb.intensity = (d.light ? d.light.amb : .55) * PI; dirL.intensity = (d.light ? d.light.dir : .95) * PI;
    grid.position.y = d.floorY !== undefined ? d.floorY : -.05; grid.visible = d.floor !== false;
    minR = d.dist ? d.dist[0] : 5; maxR = d.dist ? d.dist[1] : 60;
    collect(); buildControls(); paintLabels(); paintReadout(); ctlEl.style.display = (d.params.length ? '' : 'none');
    go('default', true);
    if (api.onModel) api.onModel(id);
    return true;
  }
  function paintLabels() {
    stags.forEach(s => s.el.remove()); stags = [];
    if (!inst || !inst.labels) return;
    inst.labels().forEach(l => { const e = document.createElement('div'); e.className = 'ks-stag'; e.textContent = typeof l.text === 'function' ? l.text() : l.text; tagsEl.appendChild(e); stags.push({ el: e, pos: l.pos }) });
  }
  function paintReadout() { const h = inst && inst.readout ? inst.readout(params) : ''; readEl.innerHTML = h; readEl.style.display = h ? '' : 'none' }
  function fmtOf(p, v) { return p.fmt ? p.fmt(v) : String(v) }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function buildControls() {
    ctlEl.innerHTML = '';
    def.params.forEach(p => {
      const w = document.createElement('div'); w.className = 'ks-ctl'; w.dataset.id = p.id;
      if (p.type === 'range') {
        w.innerHTML = `<span>${esc(p.label)}</span><input type="range" id="ks_${p.id}" min="${p.min}" max="${p.max}" step="${p.step}" value="${params[p.id]}" aria-label="${esc(p.label)}"><output>${esc(fmtOf(p, params[p.id]))}</output>`;
        w.querySelector('input').addEventListener('input', e => { set(p.id, parseFloat(e.target.value), true); api.onUser && api.onUser() });
      } else {
        w.innerHTML = `<span>${esc(p.label)}</span><div class="opts">${p.options.map(o => `<button type="button" data-v="${esc(o[0])}" class="${String(params[p.id]) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
        w.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { set(p.id, coerce(p, b.dataset.v), true); api.onUser && api.onUser() }));
      }
      ctlEl.appendChild(w);
    });
  }
  function coerce(p, v) { return typeof p.options[0][0] === 'number' ? parseFloat(v) : v }
  function uiSet(id, v) {
    const p = def.params.find(q => q.id === id); if (!p) return; const w = ctlEl.querySelector(`.ks-ctl[data-id="${id}"]`); if (!w) return;
    if (p.type === 'range') { const i = w.querySelector('input'); i.value = v; w.querySelector('output').textContent = fmtOf(p, v) }
    else w.querySelectorAll('button').forEach(b => b.classList.toggle('on', String(b.dataset.v) === String(v)));
  }
  function set(id, v) {
    if (!def) return; const p = def.params.find(q => q.id === id); if (!p) return;
    if (p.type === 'range') v = THREE.MathUtils.clamp(+v, p.min, p.max);
    else if (!p.options.some(o => String(o[0]) === String(v))) return;
    params[id] = v; uiSet(id, v);
    if (inst.setParam) inst.setParam(id, v);
    if (focusName) { const had = tagEls.length > 0; setFocus(focusName, !had) }
    tagEls.forEach(t => { t.el.querySelector('span').textContent = infoOf(t.part) });
    paintReadout();
  }
  function sliderThumb(id) {
    const i = ctlEl.querySelector(`#ks_${id}`); if (!i) return null; const r = i.getBoundingClientRect(), p = def.params.find(q => q.id === id);
    const f = (params[id] - p.min) / (p.max - p.min); return { x: r.left + 8 + f * (r.width - 16), y: r.top + r.height / 2 }
  }
  function controlEl(id, val) {
    const w = ctlEl.querySelector(`.ks-ctl[data-id="${id}"]`); if (!w) return null;
    if (val !== undefined) { const b = w.querySelector(`button[data-v="${val}"]`); if (b) return b }
    return w.querySelector('input') || w;
  }
  let last = performance.now(), tt = 0;
  function loop(ts) {
    if (disposed) return; raf = requestAnimationFrame(loop); if (document.hidden || !ok || !inst) return;
    const dt = Math.min(.05, (ts - last) / 1000); last = ts; tt += dt; now = ts;
    if (inst.update) inst.update(dt, tt);
    applyGoal(dt);
    if (def.autorotate && !G.on && ts - lastInput > 3500) S.th += dt * .14;
    placeCam();
    const pulse = .5 + .5 * Math.sin(tt * 4.5);
    for (const p of Object.values(inst.parts)) {
      p.f += (p.tf - p.f) * Math.min(1, dt * 7); const foc = focusSet.has(p);
      for (const m of p.mats) {
        m.opacity = m.userData.base * p.f * (foc && m.emissiveIntensity === undefined ? .78 + .22 * pulse : 1);
        if (m.userData.be !== undefined) m.emissiveIntensity = m.userData.be + (foc ? pulse * .55 : 0);
      }
    }
    const w = box.clientWidth;
    for (const t of tagEls) {
      const vis = partVisible(t.part); t.el.style.display = vis ? '' : 'none'; if (!vis) continue;
      const s = project(anchorOf(t.part)); t.el.style.transform = `translate(${s.x}px,${s.y}px)`;
      t.el.classList.toggle('flip', s.x > w * .55); t.el.classList.toggle('below', s.y < 110);
    }
    for (const s of stags) { const q = project(s.pos()); s.el.style.transform = `translate(${q.x}px,${q.y}px) translate(-50%,-50%)`; s.el.style.display = q.z < 1 ? '' : 'none' }
    renderer.render(scene, camera);
  }
  if (ok) raf = requestAnimationFrame(loop);
  function destroy() {
    disposed = true; cancelAnimationFrame(raf); ro.disconnect();
    el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('wheel', onWheel);
    if (inst && inst.root) dispose(inst.root); clearTags(); stags.forEach(s => s.el.remove());
    renderer && renderer.dispose();
  }
  // Live getters (Object.assign would copy their values once, at creation).
  Object.defineProperties(api, {
    id: { get: () => modelId }, params: { get: () => params }, def: { get: () => def },
  });
  return Object.assign(api, {
    load, set, go, frame, focus: setFocus, resolve, screenPosOf, sliderThumb, controlEl, destroy,
    partVisible: n => partVisible(resolve(n)), ok,
  });
}
