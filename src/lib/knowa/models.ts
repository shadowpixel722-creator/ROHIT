/* eslint-disable */
// @ts-nocheck
/**
 * Interactive 3D teaching models, ported from Knowa. Each model has parameters (sliders and choices),
 * named parts the tutor can point at, camera views, and build(ctx) → { root, parts, setParam, readout, labels, update }.
 * Built with three.js passed in, so the library is only downloaded when a lesson is opened.
 * Ported code is kept close to the original and is not type-checked (see the lesson player for the typed edge).
 */
export function createModels(THREE) {
const MODELS = {};
const C = { g: 0x4c9dff, lime: 0xa78bfa, amb: 0xffb347, mint: 0xe6f0ff, teal: 0x2fd8c8, cyan: 0x59c7ff, coral: 0xff7a59, dark: 0x0b2a55 };
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function mat(color, o = {}) {
  const op = o.opacity === undefined ? 1 : o.opacity;
  return new THREE.MeshStandardMaterial({ color, roughness: o.rough !== undefined ? o.rough : .45, metalness: o.metal !== undefined ? o.metal : .1, transparent: true, opacity: op,
    emissive: o.emissive !== undefined ? o.emissive : 0x000000, emissiveIntensity: o.ei || 0, side: o.side !== undefined ? o.side : THREE.FrontSide,
    depthWrite: o.depthWrite !== undefined ? o.depthWrite : op > .85, clippingPlanes: o.clip || null, flatShading: !!o.flat });
}
function lmat(color, op, clip) { return new THREE.LineBasicMaterial({ color, transparent: true, opacity: op === undefined ? .6 : op, clippingPlanes: clip || null }) }
function wire(geo, color, op, clip) { return new THREE.LineSegments(new THREE.WireframeGeometry(geo), lmat(color === undefined ? C.g : color, op === undefined ? .4 : op, clip)) }
function mkParts() {
  const map = {};
  const mk = (name, label, info, o) => { const p = Object.assign({ name, label, info, objs: [], f: 1, tf: 1, mats: [], vis: null }, o || {}); p.add = (...a) => { p.objs.push(...a); return p }; map[name] = p; return p };
  return { map, mk };
}
function clearGroup(g) {
  while (g.children.length) { const c = g.children[0]; g.remove(c); c.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()) }) }
}
function between(a, b, rad, m, seg) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, seg || 10, 1), m);
  mesh.position.copy(a).addScaledVector(d, .5); mesh.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); return mesh;
}
function setBase(m, v) { m.userData.base = v }
function ease(p) { return p * p * (3 - 2 * p) }
const fnum = v => { const r = Math.round(v * 100) / 100; return String(r).replace('-', '−') };
const sgn = (v, t) => (v < 0 ? ' − ' : ' + ') + (Math.abs(v) === 1 && t ? '' : fnum(Math.abs(v))) + t;
function boxMesh(w, h, d, color, op, ei) {
  const g = new THREE.BoxGeometry(w, h, d), m = new THREE.Mesh(g, mat(color, { opacity: op, emissive: color, ei: ei || .2, depthWrite: op > .85 }));
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), lmat(color, Math.min(1, op + .35))); m.add(e); m.userData.e = e; return m
}

/* ───────── Cone · Sphere · Cylinder ───────── */
MODELS.mensuration = {
  id: 'mensuration', title: 'Cone, Sphere and Cylinder', short: 'Mensuration', subject: 'Maths', listed: true,
  topics: 'volume and surface area of cone, sphere, cylinder; Archimedes; the 1:2:3 volume ratio',
  parts: ['cylinder', 'cone', 'sphere'], dist: [8, 34], floorY: -.03, autorotate: false,
  views: { default: { pos: [0, 5.2, 17], target: [0, 1.9, 0] }, cylinder: { pos: [7, 4.4, 10], target: [5.4, 1.9, 0] }, cone: { pos: [-7, 4.4, 10], target: [-5.4, 1.9, 0] }, sphere: { pos: [0, 4.4, 9.5], target: [0, 1.9, 0] } },
  params: [
    { id: 'cones', type: 'range', label: 'Cones poured', min: 0, max: 3, step: .05, val: 0, fmt: v => v.toFixed(1) },
    { id: 'spheres', type: 'range', label: 'Spheres poured', min: 0, max: 1.5, step: .05, val: 0, fmt: v => v.toFixed(1) }],
  build(ctx) {
    const P = ctx.params, root = new THREE.Group(), { map, mk } = mkParts();
    const r = 1.8, H = 3.6, X = { cone: -5.4, sph: 0, cyl: 5.4 };
    const cylC = new THREE.Plane(V3(0, -1, 0), H), coneC = new THREE.Plane(V3(0, -1, 0), 0), sphC = new THREE.Plane(V3(0, -1, 0), 0);
    const glass = () => mat(0xa6c4ff, { opacity: .1, side: THREE.DoubleSide, depthWrite: false });
    const liquid = (clip) => mat(C.lime, { opacity: .62, side: THREE.DoubleSide, depthWrite: false, emissive: C.lime, ei: .14, clip: [clip] });
    const pc = mk('cylinder', 'Cylinder', 'V = πr²h. Here h = 2r, so V = 2πr³.');
    const cg = new THREE.Mesh(new THREE.CylinderGeometry(r, r, H, 40, 1, true), glass()); cg.position.set(X.cyl, H / 2, 0);
    const cw = wire(new THREE.CylinderGeometry(r, r, H, 24, 4), C.g, .42); cw.position.copy(cg.position);
    const cl = new THREE.Mesh(new THREE.CylinderGeometry(r * .96, r * .96, H, 40), liquid(cylC)); cl.position.copy(cg.position);
    const cb = new THREE.Mesh(new THREE.CircleGeometry(r, 40), glass()); cb.rotation.x = -Math.PI / 2; cb.position.set(X.cyl, .01, 0);
    pc.add(cg, cw, cl, cb);
    const pn = mk('cone', 'Cone', 'V = ⅓πr²h. Same base and height as the cylinder.');
    const ng = new THREE.Mesh(new THREE.ConeGeometry(r, H, 40, 1, true), glass()); ng.rotation.x = Math.PI; ng.position.set(X.cone, H / 2, 0);
    const nw = wire(new THREE.ConeGeometry(r, H, 24, 4), C.g, .42); nw.rotation.x = Math.PI; nw.position.copy(ng.position);
    const nl = new THREE.Mesh(new THREE.ConeGeometry(r * .96, H * .96, 40), liquid(coneC)); nl.rotation.x = Math.PI; nl.position.copy(ng.position);
    pn.add(ng, nw, nl);
    const ps = mk('sphere', 'Sphere', 'V = 4⁄3 πr³. It fits snugly inside the cylinder.');
    const sg = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), glass()); sg.position.set(X.sph, r, 0);
    const sw = wire(new THREE.SphereGeometry(r, 20, 14), C.g, .4); sw.position.copy(sg.position);
    const sl = new THREE.Mesh(new THREE.SphereGeometry(r * .96, 40, 28), liquid(sphC)); sl.position.copy(sg.position);
    ps.add(sg, sw, sl);
    const hm = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([V3(X.cyl + r + .4, 0, 0), V3(X.cyl + r + .4, H, 0), V3(X.cyl + r + .25, 0, 0), V3(X.cyl + r + .55, 0, 0), V3(X.cyl + r + .25, H, 0), V3(X.cyl + r + .55, H, 0)]), lmat(C.amb, .8));
    pc.add(hm);
    root.add(...pc.objs, ...pn.objs, ...ps.objs);
    function capHeight(f, R) { let lo = 0, hi = 2 * R; for (let i = 0; i < 40; i++) { const h = (lo + hi) / 2; const v = h * h * (3 * R - h) / (4 * R * R * R); v < f ? lo = h : hi = h } return (lo + hi) / 2 }
    const fillOf = c => c <= 1e-4 ? 1 : clamp(1 - (c - Math.floor(c - 1e-6)), 0, 1);
    function apply() {
      const c = P.cones, s = P.spheres, frac = Math.min(1, (c + 2 * s) / 3);
      cylC.constant = frac * H;
      const fc = fillOf(c), fs = fillOf(s);
      coneC.constant = H * .02 + H * .96 * Math.pow(fc, 1 / 3) + .001;
      sphC.constant = r * .04 + capHeight(fs, r * .96) + .001;
      if (fc <= 0) coneC.constant = -1; if (fs <= 0) sphC.constant = -1; if (frac <= 0) cylC.constant = -1;
    }
    apply();
    return { root, parts: map, setParam() { apply() },
      readout(p) { const frac = Math.min(1, (p.cones + 2 * p.spheres) / 3);
        return `Cones poured <b>${p.cones.toFixed(1)}</b> · Spheres poured <b>${p.spheres.toFixed(1)}</b><br>Cylinder is <b>${Math.round(frac * 100)}%</b> full ${frac > .995 ? '<span class="ok">✓ full</span>' : ''}` } };
  }
};

/* ───────── Pythagoras by rearrangement ───────── */
MODELS.pythag = {
  id: 'pythag', title: 'Pythagoras Theorem', short: 'Pythagoras', subject: 'Maths', listed: true,
  topics: 'Pythagoras theorem, right-angled triangle, hypotenuse, proof by rearrangement, Pythagorean triples',
  parts: ['triangles', 'outer', 'csquare', 'asq', 'bsq'], dist: [8, 36], floor: false,
  views: { default: { pos: [0, 1.5, 15], target: [0, 0, 0] }, tilt: { pos: [7, -5, 13], target: [0, 0, 0] } },
  params: [
    { id: 'a', type: 'range', label: 'Leg a', min: 1, max: 12, step: 1, val: 3, fmt: v => v },
    { id: 'b', type: 'range', label: 'Leg b', min: 1, max: 12, step: 1, val: 4, fmt: v => v },
    { id: 'proof', type: 'range', label: 'Rearrange', min: 0, max: 1, step: .01, val: 0, fmt: v => Math.round(v * 100) + '%' }],
  build(ctx) {
    const P = ctx.params, root = new THREE.Group(), g = new THREE.Group(), { map, mk } = mkParts(); root.add(g);
    const pT = mk('triangles', 'Four identical right triangles', () => `Each has legs a = ${P.a} and b = ${P.b}. Area ½ab = ${P.a * P.b / 2}.`, { frame: false });
    const pO = mk('outer', 'Big square of side a + b', () => `Its area is (a + b)² = ${(P.a + P.b) ** 2}.`, { frame: false });
    const pC = mk('csquare', 'Tilted square, side c', () => `Its side is the hypotenuse, so area = c² = ${P.a ** 2 + P.b ** 2}.`, { frame: false, vis: p => p.proof < .9 });
    const pA = mk('asq', 'Square on side a', () => `Area a² = ${P.a ** 2}.`, { frame: false, vis: p => p.proof > .5 });
    const pB = mk('bsq', 'Square on side b', () => `Area b² = ${P.b ** 2}.`, { frame: false, vis: p => p.proof > .5 });
    let tri = [], cs, as, bs, Apos = [], Bpos = [], k = 1;
    function ext(shape, color, op, thick) { return new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false }), mat(color, { opacity: op, emissive: color, ei: .16, depthWrite: false, side: THREE.DoubleSide })) }
    function edge(m, color, op) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), lmat(color, op)); m.add(e); return e }
    function rebuild() {
      clearGroup(g); [pT, pO, pC, pA, pB].forEach(p => p.objs.length = 0); tri = [];
      const a = P.a, b = P.b, s = a + b; k = 7.2 / s; g.scale.setScalar(k); g.position.set(-3.6, -3.5, 0);
      const th = .3 / k, V2 = THREE.Vector2;
      Apos = [[0, 0], [s, 0], [s, s], [0, s]]; Bpos = [[b, 0], [b, b], [s, b], [0, s]];
      const shape = new THREE.Shape([new V2(0, 0), new V2(a, 0), new V2(0, b)]);
      for (let i = 0; i < 4; i++) { const gr = new THREE.Group(), m = ext(shape, C.lime, .55, th); edge(m, C.lime, .95); gr.add(m); gr.position.set(Apos[i][0], Apos[i][1], 0); gr.rotation.z = i * Math.PI / 2; g.add(gr); pT.add(gr); tri.push(gr) }
      const outer = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([V3(0, 0, 0), V3(s, 0, 0), V3(s, s, 0), V3(0, s, 0)]), lmat(C.mint, .7)); g.add(outer); pO.add(outer);
      const csh = new THREE.Shape([new V2(a, 0), new V2(s, a), new V2(b, s), new V2(0, b)]);
      cs = ext(csh, C.amb, .55, th * .7); cs.userData.e = edge(cs, C.amb, .95); g.add(cs); pC.add(cs);
      const ash = new THREE.Shape([new V2(b, b), new V2(s, b), new V2(s, s), new V2(b, s)]);
      as = ext(ash, C.cyan, .5, th * .7); as.userData.e = edge(as, C.cyan, .95); g.add(as); pA.add(as);
      const bsh = new THREE.Shape([new V2(0, 0), new V2(b, 0), new V2(b, b), new V2(0, b)]);
      bs = ext(bsh, C.teal, .5, th * .7); bs.userData.e = edge(bs, C.teal, .95); g.add(bs); pB.add(bs);
      ctx.refresh(); apply();
    }
    function apply() {
      const p = P.proof, ep = ease(p);
      tri.forEach((gr, i) => { gr.position.x = Apos[i][0] + (Bpos[i][0] - Apos[i][0]) * ep; gr.position.y = Apos[i][1] + (Bpos[i][1] - Apos[i][1]) * ep; gr.position.z = Math.sin(ep * Math.PI) * .45 / k });
      const set = (m, v) => { setBase(m.material, .55 * v); setBase(m.userData.e.material, .95 * v); m.visible = v > .02 };
      set(cs, 1 - ep); set(as, ep); set(bs, ep);
    }
    rebuild();
    return { root, parts: map,
      setParam(id) { if (id === 'a' || id === 'b') rebuild(); else apply() },
      labels() { const loc = (x, y) => () => tri[0].localToWorld(V3(x, y, 0));
        return [{ text: 'a = ' + P.a, pos: loc(P.a / 2, -.55 / k) }, { text: 'b = ' + P.b, pos: loc(-.7 / k, P.b / 2) }, { text: 'c', pos: loc(P.a / 2 + .5 / k, P.b / 2 + .5 / k) }] },
      readout(p) { const c2 = p.a * p.a + p.b * p.b, c = Math.sqrt(c2);
        return `a² + b² = <b>${p.a * p.a}</b> + <b>${p.b * p.b}</b> = <b>${c2}</b> = c²<br>c = √${c2} = <b>${Number.isInteger(c) ? c : c.toFixed(2)}</b> ${Number.isInteger(c) ? '<span class="ok">(a Pythagorean triple)</span>' : ''}` } };
  }
};

/* ───────── Euler's formula on polyhedra ───────── */
MODELS.solids = {
  id: 'solids', title: "Polyhedra and Euler's Formula", short: 'Polyhedra', subject: 'Maths', listed: true,
  topics: 'faces edges vertices, polyhedron, Euler formula V - E + F = 2, platonic solids',
  parts: ['vertices', 'edges', 'faces'], dist: [6, 26], autorotate: true,
  views: { default: { pos: [0, 3, 12], target: [0, 0, 0] }, close: { pos: [0, 2, 8.5], target: [0, 0, 0] } }, floorY: -4.2,
  params: [
    { id: 'solid', type: 'choice', label: 'Solid', options: [['tetra', 'Tetrahedron'], ['cube', 'Cube'], ['octa', 'Octahedron'], ['dodeca', 'Dodecahedron'], ['icosa', 'Icosahedron']], val: 'cube' },
    { id: 'count', type: 'range', label: 'Counting', min: 0, max: 1, step: .005, val: 1, fmt: v => Math.round(v * 100) + '%' },
    { id: 'explode', type: 'range', label: 'Pull faces apart', min: 0, max: 1, step: .01, val: 0, fmt: v => Math.round(v * 100) + '%' }],
  build(ctx) {
    const P = ctx.params, root = new THREE.Group(), g = new THREE.Group(), { map, mk } = mkParts(); root.add(g);
    const SOL = { tetra: { n: 'Tetrahedron', V: 4, E: 6, F: 4, geo: () => new THREE.TetrahedronGeometry(3.1) }, cube: { n: 'Cube', V: 8, E: 12, F: 6, geo: () => new THREE.BoxGeometry(3.6, 3.6, 3.6) },
      octa: { n: 'Octahedron', V: 6, E: 12, F: 8, geo: () => new THREE.OctahedronGeometry(3.3) }, dodeca: { n: 'Dodecahedron', V: 20, E: 30, F: 12, geo: () => new THREE.DodecahedronGeometry(2.9) }, icosa: { n: 'Icosahedron', V: 12, E: 30, F: 20, geo: () => new THREE.IcosahedronGeometry(3.1) } };
    const pV = mk('vertices', 'Vertices', () => `A vertex is a corner where edges meet. The ${SOL[P.solid].n.toLowerCase()} has ${SOL[P.solid].V}.`, { frame: false });
    const pE = mk('edges', 'Edges', () => `An edge is a line segment where two faces meet. It has ${SOL[P.solid].E}.`, { frame: false });
    const pF = mk('faces', 'Faces', () => `A face is one flat polygon on the surface. It has ${SOL[P.solid].F}.`, { frame: false });
    let sv = [], se = [], sf = [], edgeLines = null;
    const vm = mat(C.amb, { emissive: C.amb, ei: .6 }), em = mat(C.lime, { emissive: C.lime, ei: .5 });
    function rebuild() {
      clearGroup(g); [pV, pE, pF].forEach(p => p.objs.length = 0); sv = []; se = []; sf = [];
      const d = SOL[P.solid]; let geo = d.geo(); if (geo.index) geo = geo.toNonIndexed();
      const pos = geo.attributes.position, key = v => Math.round(v.x * 100) + ',' + Math.round(v.y * 100) + ',' + Math.round(v.z * 100);
      const seen = new Set(), verts = [], faces = new Map();
      for (let i = 0; i < pos.count; i += 3) {
        const a = V3().fromBufferAttribute(pos, i), b = V3().fromBufferAttribute(pos, i + 1), c = V3().fromBufferAttribute(pos, i + 2);
        [a, b, c].forEach(v => { const k = key(v); if (!seen.has(k)) { seen.add(k); verts.push(v.clone()) } });
        const n = V3().subVectors(b, a).cross(V3().subVectors(c, a)).normalize(), fk = Math.round(n.x * 40) + ',' + Math.round(n.y * 40) + ',' + Math.round(n.z * 40);
        if (!faces.has(fk)) faces.set(fk, { n, tris: [] }); faces.get(fk).tris.push(a, b, c);
      }
      const eg = new THREE.EdgesGeometry(geo, 1), ep = eg.attributes.position, edges = [];
      for (let i = 0; i < ep.count; i += 2) edges.push([V3().fromBufferAttribute(ep, i), V3().fromBufferAttribute(ep, i + 1)]);
      verts.sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z); edges.sort((a, b) => (a[0].y + a[1].y) - (b[0].y + b[1].y));
      verts.forEach(v => { const m = new THREE.Mesh(new THREE.SphereGeometry(.15, 14, 10), vm); m.position.copy(v); m.visible = false; g.add(m); pV.add(m); sv.push(m) });
      edges.forEach(e => { const m = between(e[0], e[1], .055, em, 8); m.visible = false; g.add(m); pE.add(m); se.push(m) });
      edgeLines = new THREE.LineSegments(eg, lmat(C.g, .45)); g.add(edgeLines); pE.add(edgeLines);
      const fl = [...faces.values()].map(f => { const c = V3(); f.tris.forEach(v => c.add(v)); c.multiplyScalar(1 / f.tris.length); f.c = c; return f }).sort((a, b) => a.c.y - b.c.y);
      fl.forEach(f => {
        const arr = new Float32Array(f.tris.length * 3); f.tris.forEach((v, i) => { arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z });
        const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(arr, 3)); bg.computeVertexNormals();
        const m = new THREE.Mesh(bg, mat(C.g, { opacity: .05, side: THREE.DoubleSide, depthWrite: false, emissive: C.g, ei: .2 })); m.userData.n = f.n; g.add(m); pF.add(m); sf.push(m);
      });
      ctx.refresh(); apply();
    }
    function counts() { const d = SOL[P.solid], c = P.count; return { nV: Math.round(clamp(c * 3, 0, 1) * d.V), nE: Math.round(clamp(c * 3 - 1, 0, 1) * d.E), nF: Math.round(clamp(c * 3 - 2, 0, 1) * d.F) } }
    function apply() {
      const { nV, nE, nF } = counts();
      sv.forEach((m, i) => m.visible = i < nV); se.forEach((m, i) => m.visible = i < nE);
      sf.forEach((m, i) => { const on = i < nF; setBase(m.material, on ? .4 : .05); m.position.copy(m.userData.n).multiplyScalar(P.explode * 1.7) });
      edgeLines.visible = P.explode < .05;
    }
    rebuild();
    return { root, parts: map,
      update(dt) { g.rotation.y += dt * .28 },
      setParam(id) { if (id === 'solid') rebuild(); else apply() },
      readout(p) { const { nV, nE, nF } = counts(), d = SOL[p.solid], done = nV === d.V && nE === d.E && nF === d.F;
        return `<b>${d.n}</b> · V ${nV}/${d.V} · E ${nE}/${d.E} · F ${nF}/${d.F}<br>V − E + F = ${nV} − ${nE} + ${nF} = <b>${nV - nE + nF}</b> ${done ? '<span class="ok">✓ always 2</span>' : ''}` } };
  }
};

/* ───────── Bohr atom ───────── */
const EL = ['H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca'];
const ELN = ['Hydrogen', 'Helium', 'Lithium', 'Beryllium', 'Boron', 'Carbon', 'Nitrogen', 'Oxygen', 'Fluorine', 'Neon', 'Sodium', 'Magnesium', 'Aluminium', 'Silicon', 'Phosphorus', 'Sulphur', 'Chlorine', 'Argon', 'Potassium', 'Calcium'];
const ELA = [1, 4, 7, 9, 11, 12, 14, 16, 19, 20, 23, 24, 27, 28, 31, 32, 35, 40, 39, 40];
function shellsOf(z) { const k = Math.min(z, 2); let r = z - k; const l = Math.min(r, 8); r -= l; const m = Math.min(r, 8); r -= m; return [k, l, m, r].filter(n => n > 0) }
function valencyOf(sh) { const o = sh[sh.length - 1]; if (sh.length === 1) return o === 2 ? 0 : o; if (o === 8) return 0; return o <= 4 ? o : 8 - o }
MODELS.atom = {
  id: 'atom', title: "Bohr's Model of the Atom", short: 'Atom', subject: 'Science', listed: true,
  topics: 'atomic structure, protons neutrons electrons, atomic number, mass number, electron shells, valency',
  parts: ['nucleus', 'K', 'L', 'M', 'N'], aliases: ['valence'], dist: [7, 24], autorotate: true, floorY: -6,
  views: { default: { pos: [0, 5, 15], target: [0, 0, 0] }, near: { pos: [0, 1.5, 6], target: [0, 0, 0] } },
  params: [{ id: 'Z', type: 'range', label: 'Atomic number Z', min: 1, max: 20, step: 1, val: 6, fmt: v => v + ' · ' + EL[v - 1] }],
  build(ctx) {
    const P = ctx.params, root = new THREE.Group(), g = new THREE.Group(), { map, mk } = mkParts(); root.add(g);
    const R = [2.2, 3.4, 4.6, 5.8], tilt = [[.5, 0, .2], [-.35, .6, 0], [.2, -.7, .4], [-.5, .3, -.5]], names = ['K', 'L', 'M', 'N'];
    const pN = mk('nucleus', 'Nucleus', () => { const z = P.Z, a = ELA[z - 1]; return `${z} proton${z > 1 ? 's' : ''} (+) and ${a - z} neutron${a - z !== 1 ? 's' : ''} (neutral). Mass number A = ${a}.` }, { frame: false });
    const sp = {}; names.forEach((n, i) => { sp[n] = mk(n, n + ' shell', () => { const sh = shellsOf(P.Z); const c = sh[i] || 0; return `n = ${i + 1}. Can hold at most ${i === 0 ? 2 : 8} electrons (outermost). Holds ${c} here.` }, { frame: false, vis: () => shellsOf(P.Z).length > i }) });
    let electrons = [];
    function rebuild() {
      clearGroup(g); Object.values(map).forEach(p => p.objs.length = 0); electrons = [];
      const z = P.Z, A = ELA[z - 1], sh = shellsOf(z);
      const pm = mat(C.amb, { emissive: C.amb, ei: .5, rough: .35 }), nm = mat(0x8a9ab5, { emissive: 0x1d2f4e, ei: .25, rough: .6 }), em = mat(0x59c7ff, { emissive: 0x2aa0ff, ei: 1.1, rough: .2 });
      const ng = new THREE.Group(), pg = new THREE.SphereGeometry(.34, 14, 10), rho = .34 * Math.cbrt(A) + .05;
      for (let i = 0; i < A; i++) {
        const y = 1 - 2 * (i + .5) / A, rr = Math.sqrt(Math.max(0, 1 - y * y)), ph = i * 2.399963, s = rho * Math.cbrt((i + .5) / A);
        const isP = Math.floor((i + 1) * z / A) > Math.floor(i * z / A);
        const m = new THREE.Mesh(pg, isP ? pm : nm); m.position.set(Math.cos(ph) * rr * s, y * s, Math.sin(ph) * rr * s); ng.add(m);
      }
      g.add(ng); pN.add(ng);
      sh.forEach((cnt, i) => {
        const sg = new THREE.Group(); sg.rotation.set(...tilt[i]); g.add(sg);
        const pts = []; for (let k = 0; k <= 96; k++) { const a = k / 96 * Math.PI * 2; pts.push(V3(Math.cos(a) * R[i], 0, Math.sin(a) * R[i])) }
        const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lmat(C.g, .65)); sg.add(ring); sp[names[i]].add(sg);
        const emat = em.clone();
        for (let e = 0; e < cnt; e++) { const m = new THREE.Mesh(new THREE.SphereGeometry(.22, 14, 10), emat); sg.add(m); electrons.push({ m, r: R[i], a0: e / cnt * Math.PI * 2, w: 1.1 / Math.pow(i + 1, 1.15) }) }
      });
      ctx.refresh();
    }
    rebuild();
    return { root, parts: map, alias: { valence: p => names[shellsOf(p.Z).length - 1] },
      update(dt, t) { electrons.forEach(e => { const a = e.a0 + t * e.w; e.m.position.set(Math.cos(a) * e.r, 0, Math.sin(a) * e.r) }) },
      setParam() { rebuild() },
      readout(p) { const z = p.Z, a = ELA[z - 1], sh = shellsOf(z);
        return `<b>${EL[z - 1]}</b> ${ELN[z - 1]} · Z = <b>${z}</b> · A = <b>${a}</b><br>p = ${z} · n = ${a - z} · e⁻ = ${z}<br>Configuration <b>${sh.join(', ')}</b> · valency <b>${valencyOf(sh)}</b>` } };
  }
};

/* ───────── Plant and animal cell ───────── */
MODELS.cell = {
  id: 'cell', title: 'The Cell: Plant and Animal', short: 'Cell', subject: 'Science', listed: true,
  topics: 'cell structure, organelles, nucleus, mitochondria, ER, Golgi, lysosome, ribosome, vacuole, chloroplast, cell wall',
  parts: ['membrane', 'wall', 'nucleus', 'mitochondria', 'er', 'ribosome', 'golgi', 'lysosome', 'vacuole', 'chloroplast'], dist: [5, 22], floorY: -4.2, autorotate: true,
  views: { default: { pos: [0, 2.4, 12.5], target: [0, 0, 0] }, inside: { pos: [0, .5, 8], target: [0, 0, 0] } },
  params: [
    { id: 'type', type: 'choice', label: 'Cell type', options: [['animal', 'Animal'], ['plant', 'Plant']], val: 'animal' },
    { id: 'cut', type: 'range', label: 'Cut-away', min: 0, max: 1, step: .01, val: .6, fmt: v => Math.round(v * 100) + '%' }],
  build(ctx) {
    const P = ctx.params, root = new THREE.Group(), g = new THREE.Group(), { map, mk } = mkParts(); root.add(g);
    const clipP = new THREE.Plane(V3(0, 0, -1), 3.6), CL = [clipP];
    mk('membrane', 'Cell membrane', 'A thin, flexible boundary that controls what enters and leaves. It is selectively permeable.');
    mk('wall', 'Cell wall', 'A rigid cellulose layer outside the membrane. It gives plant cells a fixed shape and protects them.', { vis: p => p.type === 'plant' });
    mk('nucleus', 'Nucleus', 'The control room. It holds the DNA as chromosomes, and its double membrane has pores.');
    mk('mitochondria', 'Mitochondria', 'The powerhouse. They release energy from glucose as ATP. The folded inner membrane is called cristae.');
    mk('er', 'Endoplasmic reticulum', 'A network of tubes. Rough ER, dotted with ribosomes, makes proteins. Smooth ER makes lipids.');
    mk('ribosome', 'Ribosomes', 'Tiny protein factories, found free in the cytoplasm and on the rough ER.');
    mk('golgi', 'Golgi apparatus', 'Packs and dispatches proteins and lipids, like the cell’s post office.');
    mk('lysosome', 'Lysosomes', 'Digestive bags full of enzymes. They break down waste and worn-out cell parts.', { vis: p => p.type === 'animal' });
    mk('vacuole', 'Large central vacuole', 'A big sac of cell sap. It stores water and keeps the cell firm, or turgid.', { vis: p => p.type === 'plant' });
    mk('chloroplast', 'Chloroplasts', 'Contain green chlorophyll. They make food by photosynthesis.', { vis: p => p.type === 'plant' });
    const ellipsoid = (rx, ry, rz, seg) => { const geo = new THREE.SphereGeometry(1, seg || 36, 26); geo.scale(rx, ry, rz); return geo };
    function mito(pos, ry, rz) {
      const gr = new THREE.Group(), body = mat(C.amb, { opacity: .55, emissive: C.amb, ei: .2, rough: .4, side: THREE.DoubleSide, depthWrite: false });
      gr.add(new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, .72, 14, 1, true), body));
      [-.36, .36].forEach(y => { const s = new THREE.Mesh(new THREE.SphereGeometry(.25, 14, 10), body); s.position.y = y; gr.add(s) });
      const pts = []; for (let i = 0; i <= 9; i++) pts.push(V3(i % 2 ? .14 : -.14, -.5 + i * .111, 0));
      gr.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lmat(C.lime, .95)));
      gr.position.copy(pos); gr.rotation.set(0, ry, rz); return gr;
    }
    function rnd(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 } }
    function rebuild() {
      clearGroup(g); Object.values(map).forEach(p => p.objs.length = 0);
      const plant = P.type === 'plant', add = (n, ...o) => { g.add(...o); map[n].add(...o) };
      if (plant) {
        const wm = mat(C.lime, { opacity: .12, side: THREE.DoubleSide, depthWrite: false, clip: CL });
        add('wall', new THREE.Mesh(new THREE.BoxGeometry(7.4, 5.2, 5.2), wm), wire(new THREE.BoxGeometry(7.4, 5.2, 5.2, 5, 3, 3), C.lime, .5, CL));
        const mm = mat(C.g, { opacity: .1, side: THREE.DoubleSide, depthWrite: false, clip: CL });
        add('membrane', new THREE.Mesh(new THREE.BoxGeometry(7.0, 4.8, 4.8), mm), wire(new THREE.BoxGeometry(7.0, 4.8, 4.8, 4, 3, 3), C.g, .25, CL));
      } else {
        const mm = mat(C.g, { opacity: .13, side: THREE.DoubleSide, depthWrite: false, clip: CL });
        add('membrane', new THREE.Mesh(ellipsoid(3.7, 2.9, 3.2), mm), new THREE.LineSegments(new THREE.WireframeGeometry(ellipsoid(3.7, 2.9, 3.2, 22)), lmat(C.g, .28, CL)));
      }
      const nc = plant ? V3(-2.3, 1.2, -.6) : V3(-.5, .3, -.2), ng = new THREE.Group();
      ng.add(new THREE.Mesh(new THREE.SphereGeometry(plant ? .8 : 1, 28, 20), mat(C.cyan, { opacity: .42, emissive: C.cyan, ei: .15, depthWrite: false })));
      const nuc = new THREE.Mesh(new THREE.SphereGeometry(plant ? .25 : .32, 16, 12), mat(C.amb, { emissive: C.amb, ei: .5 })); nuc.position.set(.12, .08, .05); ng.add(nuc);
      ng.add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.TorusKnotGeometry(plant ? .3 : .4, .045, 60, 6, 2, 3)), lmat(C.lime, .8)));
      const pores = new THREE.SphereGeometry(.06, 8, 6), pm = mat(0xffffff, { emissive: 0xffffff, ei: .9 });
      for (let i = 0; i < 16; i++) { const y = 1 - 2 * (i + .5) / 16, rr = Math.sqrt(1 - y * y), ph = i * 2.4, R = plant ? .8 : 1; const m = new THREE.Mesh(pores, pm); m.position.set(Math.cos(ph) * rr * R, y * R, Math.sin(ph) * rr * R); ng.add(m) }
      ng.position.copy(nc); add('nucleus', ng);
      const rs = plant ? .7 : 1, epts = [];
      for (let i = 0; i <= 90; i++) { const u = i / 90, th = u * Math.PI * 5, R = (1.45 + .22 * Math.sin(th * 3.1)) * rs; epts.push(V3(nc.x + Math.cos(th) * R, nc.y + (u - .5) * 2.4 * rs + .16 * Math.sin(th * 4), nc.z + Math.sin(th) * R * .9)) }
      const curve = new THREE.CatmullRomCurve3(epts);
      add('er', new THREE.Mesh(new THREE.TubeGeometry(curve, 240, .07, 6, false), mat(C.teal, { opacity: .78, emissive: C.teal, ei: .2 })));
      const rp = [], cp = curve.getPoints(90); cp.forEach((p, i) => { if (i % 2 === 0) rp.push(p.x + .07, p.y + .07, p.z) });
      const R2 = rnd(7), count = plant ? 50 : 90; for (let i = 0; i < count; i++) { const a = R2() * 6.28, b = Math.acos(2 * R2() - 1), r = Math.cbrt(R2()); rp.push(Math.sin(b) * Math.cos(a) * r * 3.2, Math.cos(b) * r * (plant ? 2.2 : 2.5), Math.sin(b) * Math.sin(a) * r * (plant ? 2.2 : 2.8)) }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
      add('ribosome', new THREE.Points(rg, new THREE.PointsMaterial({ color: C.lime, size: .12, transparent: true, opacity: .95, sizeAttenuation: true })));
      const mp = plant ? [[V3(-1.3, -1.9, 1.3), .3, 1.2], [V3(2.9, .4, 1.6), 1, .5], [V3(-3, .9, -1.6), .7, .3]] : [[V3(1.9, 1.2, .5), .4, .9], [V3(-2.1, -1.0, .8), 1.1, .3], [V3(1.2, -1.7, -.6), .2, 1.3], [V3(2.3, -.1, -1.0), .9, .6]];
      add('mitochondria', ...mp.map(m => mito(m[0], m[1], m[2])));
      const gg = new THREE.Group();
      for (let i = 0; i < 5; i++) { const r = 1 - Math.abs(i - 2) * .08, m = new THREE.Mesh(new THREE.TorusGeometry(r, .075, 8, 28, Math.PI * .85), mat(0xffd36b, { emissive: 0xffa020, ei: .22 })); m.position.y = i * .24 - .48; m.rotation.x = Math.PI / 2; m.rotation.z = -Math.PI * .42; gg.add(m) }
      gg.position.copy(plant ? V3(-1.4, -1.0, -1.5) : V3(1.7, -.7, 1.0)); gg.rotation.set(.3, .5, .2); gg.scale.setScalar(.85); add('golgi', gg);
      if (plant) {
        const vg = new THREE.Group(); vg.add(new THREE.Mesh(ellipsoid(2.1, 1.6, 1.5), mat(C.teal, { opacity: .28, depthWrite: false, emissive: C.teal, ei: .1 })), new THREE.LineSegments(new THREE.WireframeGeometry(ellipsoid(2.1, 1.6, 1.5, 18)), lmat(C.teal, .4)));
        vg.position.set(.7, -.1, 0); add('vacuole', vg);
        const cpos = [[-2.8, -1.7, .8], [.6, 2.0, .9], [3.0, 1.5, -.5], [3.0, -1.5, .6], [-.8, -2.0, -.9], [-2.7, 0, 1.5], [2.0, -.2, -2.0]], chs = [];
        cpos.forEach((c, i) => { const gr = new THREE.Group(); gr.add(new THREE.Mesh(ellipsoid(.62, .34, .34, 18), mat(0x2ddf5c, { opacity: .88, emissive: 0x0f8a2e, ei: .35 })));
          for (let k = 0; k < 3; k++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .06, 10), mat(C.lime, { emissive: C.lime, ei: .6 })); d.position.set(-.25 + k * .25, 0, .3); d.rotation.x = Math.PI / 2; gr.add(d) }
          gr.position.set(...c); gr.rotation.set(0, i * .9, i * .5); chs.push(gr) }); add('chloroplast', ...chs);
      } else {
        const lp = [[-2.3, 1.4, .4], [-1.2, -1.8, .7], [.3, 1.9, -.9], [.1, -1.0, 1.5], [2.7, .9, -.5]], lm = mat(C.coral, { emissive: C.coral, ei: .35, opacity: .9 });
        add('lysosome', ...lp.map(p => { const m = new THREE.Mesh(new THREE.SphereGeometry(.22, 14, 10), lm); m.position.set(...p); return m }));
      }
      ctx.refresh(); apply();
    }
    function apply() { clipP.constant = 3.6 - 4.4 * P.cut }
    rebuild();
    return { root, parts: map, setParam(id) { if (id === 'type') rebuild(); else apply() },
      readout(p) { return p.type === 'plant' ? '<b>Plant cell</b> · has a cell wall, chloroplasts and one big vacuole' : '<b>Animal cell</b> · no cell wall, no chloroplasts, small vacuoles' } };
  }
};

/* ───────── Molecules and covalent bonds ───────── */
MODELS.molecule = {
  id: 'molecule', title: 'Molecules and Covalent Bonds', short: 'Molecules', subject: 'Science', listed: true,
  topics: 'covalent bond, sharing of electrons, molecule shape, bond angle, water, carbon dioxide, methane, ammonia, lone pairs',
  parts: ['central', 'outer', 'bonds', 'lonepairs', 'electrons', 'angle'], dist: [5, 20], autorotate: true, floorY: -3.4,
  views: { default: { pos: [0, 2.6, 8], target: [0, .2, 0] }, close: { pos: [0, 1.2, 6], target: [0, 0, 0] } },
  params: [
    { id: 'mol', type: 'choice', label: 'Molecule', options: [['water', 'H₂O'], ['co2', 'CO₂'], ['ch4', 'CH₄'], ['nh3', 'NH₃']], val: 'water' },
    { id: 'electrons', type: 'choice', label: 'Electrons', options: [[0, 'Hide'], [1, 'Show']], val: 0 }],
  build(ctx) {
    const P = ctx.params, root = new THREE.Group(), g = new THREE.Group(), { map, mk } = mkParts(); root.add(g);
    const k = 1.9, rad = { H: .42, C: .66, O: .6, N: .6 }, col = { H: 0xeaf2ff, C: 0x6d7f9b, O: 0xff7a59, N: 0x59c7ff };
    const tet = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(a => V3(...a).normalize());
    const D = {
      water: { n: 'Water', f: 'H₂O', shape: 'Bent', ang: 104.5, central: 'Oxygen: 2 bonds and 2 lone pairs. Lone pairs push the bonds closer.',
        atoms() { const d = .96 * k, t = 52.25 * Math.PI / 180; return [['O', V3()], ['H', V3(Math.sin(t) * d, Math.cos(t) * d, 0)], ['H', V3(-Math.sin(t) * d, Math.cos(t) * d, 0)]] },
        bonds: [[0, 1, 1], [0, 2, 1]], lone(a) { const b = V3().subVectors(a[0][1], V3()).sub(a[1][1]).sub(a[2][1]).normalize(), n = V3(0, 0, 1); return [[0, [b.clone().multiplyScalar(.5).addScaledVector(n, .85).normalize(), b.clone().multiplyScalar(.5).addScaledVector(n, -.85).normalize()]]] } },
      co2: { n: 'Carbon dioxide', f: 'CO₂', shape: 'Linear', ang: 180, central: 'Carbon: shares 2 pairs with each oxygen, so it forms two double bonds.',
        atoms() { const d = 1.16 * k; return [['C', V3()], ['O', V3(d, 0, 0)], ['O', V3(-d, 0, 0)]] }, bonds: [[0, 1, 2], [0, 2, 2]],
        lone() { return [[1, [V3(.45, .9, 0).normalize(), V3(.45, -.9, 0).normalize()]], [2, [V3(-.45, .9, 0).normalize(), V3(-.45, -.9, 0).normalize()]]] } },
      ch4: { n: 'Methane', f: 'CH₄', shape: 'Tetrahedral', ang: 109.5, central: 'Carbon: valency 4, so it makes four single bonds spread out in 3D.',
        atoms() { const d = 1.09 * k; return [['C', V3()], ...tet.map(t => ['H', t.clone().multiplyScalar(d)])] }, bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]], lone() { return [] } },
      nh3: { n: 'Ammonia', f: 'NH₃', shape: 'Trigonal pyramidal', ang: 107, central: 'Nitrogen: 3 bonds and 1 lone pair. The lone pair squeezes the angle to 107°.',
        atoms() { const d = 1.01 * k, al = 68.2 * Math.PI / 180; return [['N', V3()], ...[0, 1, 2].map(i => ['H', V3(Math.sin(al) * Math.cos(i * 2.0944) * d, -Math.cos(al) * d, Math.sin(al) * Math.sin(i * 2.0944) * d)])] },
        bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]], lone() { return [[0, [V3(0, 1, 0)]]] } }
    };
    mk('central', 'Central atom', () => D[P.mol].central);
    mk('outer', 'Outer atoms', () => P.mol === 'co2' ? 'Each oxygen needs 2 more electrons to complete its octet.' : 'Each hydrogen needs 1 more electron to complete its duet of 2.');
    mk('bonds', 'Covalent bonds', () => P.mol === 'co2' ? 'Double bonds: each shares 2 pairs of electrons.' : 'Each single bond is one pair of electrons shared by both atoms.');
    mk('lonepairs', 'Lone pairs', 'Pairs of electrons that stay on one atom and are not shared.', { vis: p => p.electrons == 1 });
    mk('electrons', 'Shared electrons', 'Each shared pair holds the two atoms together. This sharing is the covalent bond.', { vis: p => p.electrons == 1 });
    let angAnchor = V3();
    mk('angle', 'Bond angle', () => `${D[P.mol].ang}°. ${D[P.mol].shape} shape.`, { anchor: () => g.localToWorld(angAnchor.clone()), frame: false });
    function rebuild() {
      clearGroup(g); Object.values(map).forEach(p => p.objs.length = 0);
      const d = D[P.mol], at = d.atoms();
      at.forEach((a, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(rad[a[0]], 28, 20), mat(col[a[0]], { emissive: col[a[0]], ei: .12, rough: .35 })); m.position.copy(a[1]); g.add(m); map[i === 0 ? 'central' : 'outer'].add(m) });
      const bm = mat(0xb9c8e0, { emissive: 0x1d3a66, ei: .3, rough: .3 }), em = mat(C.amb, { emissive: C.amb, ei: 1, rough: .2 }), dots = new THREE.SphereGeometry(.085, 10, 8);
      d.bonds.forEach(b => {
        const p = at[b[0]][1], q = at[b[1]][1], v = V3().subVectors(q, p).normalize(); let perp = V3().crossVectors(v, V3(0, 0, 1)); if (perp.length() < .1) perp = V3().crossVectors(v, V3(0, 1, 0)); perp.normalize();
        for (let i = 0; i < b[2]; i++) {
          const off = perp.clone().multiplyScalar((i - (b[2] - 1) / 2) * .3), m = between(p.clone().add(off), q.clone().add(off), b[2] > 1 ? .075 : .1, bm); g.add(m); map.bonds.add(m);
          const mid = p.clone().add(q).multiplyScalar(.5).add(off);
          [-1, 1].forEach(s => { const e = new THREE.Mesh(dots, em); e.position.copy(mid).addScaledVector(v, s * .13); e.scale.setScalar(1.15); g.add(e); map.electrons.add(e) });
        }
      });
      d.lone(at).forEach(([ai, dirs]) => dirs.forEach(dir => {
        let w = V3().crossVectors(dir, V3(0, 0, 1)); if (w.length() < .1) w = V3().crossVectors(dir, V3(0, 1, 0)); w.normalize();
        const c = at[ai][1].clone().addScaledVector(dir, rad[at[ai][0]] + .28);
        [-1, 1].forEach(s => { const e = new THREE.Mesh(dots, em); e.position.copy(c).addScaledVector(w, s * .11); g.add(e); map.lonepairs.add(e) });
      }));
      const v1 = at[d.bonds[0][1]][1].clone().normalize(), v2 = at[d.bonds[1][1]][1].clone().normalize();
      let n = V3().crossVectors(v1, v2); if (n.length() < 1e-3) n = V3(0, 0, 1); n.normalize(); const th = v1.angleTo(v2), pts = [];
      for (let i = 0; i <= 28; i++) pts.push(v1.clone().applyAxisAngle(n, i / 28 * th).multiplyScalar(1.15));
      const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lmat(C.amb, .95)); g.add(arc); map.angle.add(arc);
      angAnchor = v1.clone().applyAxisAngle(n, th / 2).multiplyScalar(1.5);
      ctx.refresh();
    }
    rebuild();
    return { root, parts: map, setParam() { rebuild() },
      readout(p) { const d = D[p.mol], pairs = d.bonds.reduce((s, b) => s + b[2], 0); return `<b>${d.f}</b> ${d.n} · <b>${d.shape}</b><br>Bond angle <b>${d.ang}°</b> · ${pairs} shared pair${pairs > 1 ? 's' : ''}` } };
  }
};

/* ───────── Lens ray diagrams ───────── */
MODELS.lens = {
  id: 'lens', title: 'Lenses and Ray Diagrams', short: 'Lens', subject: 'Science', listed: true,
  topics: 'convex lens, concave lens, ray diagram, focal length, image formation, real and virtual image, lens formula, magnification, power',
  parts: ['lens', 'axis', 'focus', 'object', 'image', 'ray1', 'ray2', 'ray3'], dist: [10, 34], floor: false, autorotate: false,
  views: { default: { pos: [2, 2.5, 21], target: [0, 0, 0] }, front: { pos: [0, 0, 20], target: [0, 0, 0] } },
  params: [
    { id: 'lens', type: 'choice', label: 'Lens', options: [['convex', 'Convex'], ['concave', 'Concave']], val: 'convex' },
    { id: 'u', type: 'range', label: 'Object distance', min: 4, max: 38, step: .5, val: 25, fmt: v => v + ' cm' },
    { id: 'f', type: 'range', label: 'Focal length', min: 6, max: 14, step: 1, val: 10, fmt: v => v + ' cm' }],
  build(ctx) {
    const P = ctx.params, root = new THREE.Group(), { map, mk } = mkParts(), k = .2, hO = 4, XM = 44, LH = 18;
    const NF = { frame: false };
    const calc = { v: 0, m: 0, inf: false, hide: false, text: '', ray3: true, y0: 0, r1y: 0 };
    const pLens = mk('lens', () => P.lens === 'convex' ? 'Convex lens' : 'Concave lens', () => P.lens === 'convex' ? 'Thicker in the middle. It converges parallel rays to the principal focus F.' : 'Thinner in the middle. It diverges parallel rays as if they came from F.', { ...NF, anchor: () => V3(.4, LH * k * .55, 0) });
    const pAxis = mk('axis', 'Principal axis', 'The straight line through the optical centre, perpendicular to the lens.', { ...NF, anchor: () => V3(-XM * k * .8, 0, 0) });
    const pFocus = mk('focus', 'Foci F and 2F', () => `Each focus is ${P.f} cm from the optical centre; 2F is ${2 * P.f} cm.`, { ...NF, anchor: () => V3(P.f * k, 0, 0) });
    const pObj = mk('object', 'Object', () => `The object is ${P.u} cm from the lens, 4 cm tall.`, { ...NF, anchor: () => V3(-P.u * k, hO * k * .6, 0) });
    const pImg = mk('image', 'Image', () => calc.text, { ...NF, anchor: () => V3((calc.inf ? 0 : calc.v) * k, (calc.inf ? 0 : calc.m * hO) * k * .6, 0), vis: () => !calc.hide });
    const pR1 = mk('ray1', 'Ray 1: parallel to axis', () => P.lens === 'convex' ? 'Bends and passes through the far focus F.' : 'Bends away as if it came from the near focus F.', { ...NF, anchor: () => V3(5, calc.r1y * k, 0) });
    const pR2 = mk('ray2', 'Ray 2: through the centre', 'Passes through the optical centre and goes straight, undeviated.', { ...NF, anchor: () => V3(-P.u * k * .5, hO * k * .5, 0) });
    const pR3 = mk('ray3', 'Ray 3: towards the focus', 'Aimed at the focus on the other side, it emerges parallel to the axis.', { ...NF, anchor: () => V3(5, calc.y0 * k, 0), vis: () => calc.ray3 });
    function segs(color, op, max) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3)); geo.setDrawRange(0, 0); const l = new THREE.LineSegments(geo, lmat(color, op)); l.frustumCulled = false; return l }
    function fill(l, pairs) { const a = l.geometry.attributes.position.array; let n = 0; for (const [p, q] of pairs) { if (n + 6 > a.length) break; a[n++] = p[0] * k; a[n++] = p[1] * k; a[n++] = 0; a[n++] = q[0] * k; a[n++] = q[1] * k; a[n++] = 0 } l.geometry.attributes.position.needsUpdate = true; l.geometry.setDrawRange(0, n / 3) }
    function dashed(p, q, out) { const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy); if (L < 1e-6) return; const ux = dx / L, uy = dy / L; for (let s = 0; s < L; s += 2.4) { const e = Math.min(L, s + 1.3); out.push([[p[0] + ux * s, p[1] + uy * s], [p[0] + ux * e, p[1] + uy * e]]) } }
    const axis = segs(C.mint, .5, 8), ticks = segs(C.mint, .8, 60), l1 = segs(C.lime, 1, 900), l2 = segs(C.amb, 1, 900), l3 = segs(C.cyan, 1, 900);
    fill(axis, [[[-XM, 0], [XM, 0]]]);
    root.add(axis, ticks, l1, l2, l3); pAxis.add(axis); pFocus.add(ticks); pR1.add(l1); pR2.add(l2); pR3.add(l3);
    function arrow(color) {
      const gr = new THREE.Group(), m = mat(color, { emissive: color, ei: .5, depthWrite: true }), sh = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, 1, 8), m), hd = new THREE.Mesh(new THREE.ConeGeometry(.17, .36, 12), m);
      gr.add(sh, hd); gr.userData = { sh, hd, m }; return gr;
    }
    function setArrow(gr, x, h) { const dir = h >= 0 ? 1 : -1, len = Math.max(.45, Math.abs(h)), { sh, hd } = gr.userData; gr.position.x = x; sh.scale.y = Math.max(len - .3, .05); sh.position.y = dir * (len - .3) / 2; hd.position.y = dir * (len - .16); hd.rotation.z = dir > 0 ? 0 : Math.PI }
    const objA = arrow(C.mint), imgA = arrow(C.lime); root.add(objA, imgA); pObj.add(objA); pImg.add(imgA);
    let lensMesh = null;
    function buildLens() {
      if (lensMesh) { root.remove(lensMesh); pLens.objs.length = 0; lensMesh.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose() }) }
      const H = LH * k, w = .55, s = new THREE.Shape();
      if (P.lens === 'convex') { s.moveTo(0, -H); s.quadraticCurveTo(2 * w, 0, 0, H); s.quadraticCurveTo(-2 * w, 0, 0, -H) }
      else { s.moveTo(-w, -H); s.lineTo(w, -H); s.quadraticCurveTo(-.42, 0, w, H); s.lineTo(-w, H); s.quadraticCurveTo(.42, 0, -w, -H) }
      const geo = new THREE.ExtrudeGeometry(s, { depth: .34, bevelEnabled: false }); geo.translate(0, 0, -.17);
      lensMesh = new THREE.Mesh(geo, mat(C.cyan, { opacity: .3, emissive: C.cyan, ei: .2, depthWrite: false, side: THREE.DoubleSide }));
      lensMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), lmat(C.cyan, .95)));
      root.add(lensMesh); pLens.add(lensMesh);
    }
    function solve() {
      const s = P.lens === 'convex' ? 1 : -1, f = s * P.f, u = -P.u, den = 1 / f + 1 / u, inf = Math.abs(den) < 1e-3, v = inf ? Infinity : 1 / den, m = inf ? Infinity : v / u, X = XM;
      const r1 = [], r2 = [], r3 = [], tip = [u, hO];
      const tk = []; [0, P.f, -P.f, 2 * P.f, -2 * P.f].forEach(x => tk.push([[x, -.9], [x, .9]])); fill(ticks, tk);
      const d1y = -s * hO / Math.abs(f); r1.push([tip, [0, hO]]); r1.push([[0, hO], [X, hO + d1y * X]]); calc.r1y = hO + d1y * (X * .3);
      if (!inf && v < 0) dashed([0, hO], [v, m * hO], r1);
      r2.push([tip, [X, hO / u * X]]);
      const y0 = Math.abs(u + f) < 1e-6 ? null : hO * f / (u + f); calc.ray3 = y0 !== null && Math.abs(y0) < LH - .5; calc.y0 = y0 || 0;
      if (calc.ray3) { r3.push([tip, [0, y0]]); r3.push([[0, y0], [X, y0]]); if (!inf && v < 0) dashed([0, y0], [v, y0], r3) }
      fill(l1, r1); fill(l2, r2); fill(l3, r3);
      calc.inf = inf; calc.v = v; calc.m = m;
      calc.hide = inf || Math.abs(v) > XM - 2 || Math.abs(m * hO) > LH; imgA.visible = !calc.hide;
      if (!calc.hide) { setArrow(imgA, v * k, m * hO * k); const real = v > 0; setBase(imgA.userData.m, real ? 1 : .5); imgA.userData.m.opacity = real ? 1 : .5; imgA.userData.m.color.setHex(real ? C.lime : C.amb); imgA.userData.m.emissive.setHex(real ? C.lime : C.amb) }
      setArrow(objA, u * k, hO * k);
      let txt;
      if (inf) txt = 'The object is at F, so the rays come out parallel. The image forms at infinity.';
      else if (calc.hide) txt = 'The image falls off the diagram. It is far away and very large.';
      else { const real = v > 0, am = Math.abs(m); txt = `${real ? 'Real' : 'Virtual'}, ${m < 0 ? 'inverted' : 'erect'}, ${am > 1.02 ? 'magnified' : am < .98 ? 'diminished' : 'same size'}. v = ${v.toFixed(1)} cm.` }
      calc.text = txt; calc.s = s; calc.f = f; calc.u = u;
    }
    buildLens(); solve();
    return { root, parts: map,
      setParam(id) { if (id === 'lens') buildLens(); solve(); ctx.refresh() },
      labels() { const t = (x, tx) => ({ text: tx, pos: () => V3(x() * k, -1.3, 0) }); return [t(() => 0, 'O'), t(() => P.f, 'F₂'), t(() => -P.f, 'F₁'), t(() => 2 * P.f, '2F₂'), t(() => -2 * P.f, '2F₁')] },
      readout(p) { const c = calc, sg = n => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(1);
        if (c.inf) return `u = <b>−${p.u}</b> cm · f = <b>${sg(c.f)}</b> cm<br>1/v = 1/f + 1/u = <b>0</b> → image at infinity`;
        return `u = <b>${sg(c.u)}</b> · v = <b>${sg(c.v)}</b> · f = <b>${sg(c.f)}</b> cm<br>m = v/u = <b>${sg(c.m)}</b> → ${c.text}` } };
  }
};

/* ───────── Earth, tilt and seasons ───────── */
MODELS.seasons = {
  id: 'seasons', title: 'Why We Have Seasons', short: 'Seasons', subject: 'Geography', listed: true,
  topics: 'seasons, tilt of Earth axis 23.5 degrees, rotation and revolution, solstice, equinox, Tropic of Cancer',
  parts: ['sun', 'earth', 'axis', 'orbit', 'equator', 'tropics', 'india'], dist: [4, 46], floor: false, light: { amb: .14, dir: 0 }, autorotate: false,
  views: { default: { pos: [0, 13, 17.5], target: [0, 0, 0] }, top: { pos: [0, 27, .1], target: [0, 0, 0] }, earth: () => ({ live: inst => inst.earthView() }) },
  params: [
    { id: 'day', type: 'range', label: 'Date', min: 1, max: 365, step: 1, val: 172, fmt: v => new Date(2025, 0, Math.round(v)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) },
    { id: 'run', type: 'choice', label: 'Time-lapse', options: [[0, 'Pause'], [1, 'Run the year']], val: 0 }],
  build(ctx) {
    const P = ctx.params, root = new THREE.Group(), { map, mk } = mkParts(), R = 9, TILT = 23.44 * Math.PI / 180;
    const pS = mk('sun', 'The Sun', 'The source of light and heat. Sunlight always hits the half of Earth facing it.', { frame: false });
    const pE = mk('earth', 'Earth', () => 'Spins once in 24 hours (day and night) and goes around the Sun in about 365¼ days.', { frame: false });
    const pA = mk('axis', 'Earth’s axis', () => 'Tilted 23.5° from the vertical, and it keeps pointing the same way (towards the Pole Star) all year.', { frame: false });
    const pO = mk('orbit', 'Orbit', () => 'Earth’s path around the Sun. It is almost a circle. Seasons do not come from distance.', { frame: false, anchor: () => V3(-R * .7, 0, R * .7) });
    const pEq = mk('equator', 'Equator', '0° latitude. Day and night are about equal here all year.', { frame: false });
    const pT = mk('tropics', 'Tropic of Cancer and Capricorn', '23.5° N and 23.5° S. The Sun is directly overhead at noon on the Tropic of Cancer on 21 June, and Capricorn on 22 December.', { frame: false });
    const pI = mk('india', 'India (about 22° N)', 'The Tropic of Cancer passes through the middle of India.', { frame: false });
    const sun = new THREE.Mesh(new THREE.SphereGeometry(1.7, 32, 24), new THREE.MeshBasicMaterial({ color: 0xffc766, transparent: true }));
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,200,100,.9)'); gr.addColorStop(.35, 'rgba(255,170,60,.28)'); gr.addColorStop(1, 'rgba(255,170,60,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.setScalar(9);
    // Modern three.js lights are physical: no fall-off (decay 0) and π× intensity match the original look.
    const light = new THREE.PointLight(0xfff0d0, 1.9 * Math.PI, 0, 0);
    root.add(sun, glow, light); pS.add(sun, glow);
    const op = []; for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 2; op.push(V3(Math.cos(a) * R, 0, Math.sin(a) * R)) }
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(op), lmat(C.mint, .28)); root.add(ring); pO.add(ring);
    const epos = d => { const th = 2 * Math.PI * (d - 172) / 365; return V3(R * Math.cos(th), 0, -R * Math.sin(th)) };
    const marks = [[79, '20 Mar'], [172, '21 Jun'], [265, '22 Sep'], [355, '21 Dec']];
    marks.forEach(m => { const s = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), mat(C.lime, { emissive: C.lime, ei: .8 })); s.position.copy(epos(m[0])); root.add(s); pO.add(s) });
    const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(), V3(1, 0, 0)]), lmat(C.amb, .35)); beam.frustumCulled = false; root.add(beam); pO.add(beam);
    const eg = new THREE.Group(), tilt = new THREE.Group(), spin = new THREE.Group(); root.add(eg); eg.add(tilt); tilt.add(spin); tilt.rotation.z = TILT;
    const sg = new THREE.SphereGeometry(1, 72, 52), sp = sg.attributes.position, cols = new Float32Array(sp.count * 3);
    const h3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s) };
    const vn = (x, y, z) => { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi, u = t => t * t * (3 - 2 * t); let r = 0;
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) r += h3(xi + a, yi + b, zi + c) * (a ? u(fx) : 1 - u(fx)) * (b ? u(fy) : 1 - u(fy)) * (c ? u(fz) : 1 - u(fz)); return r };
    for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i), n = vn(x * 1.9 + 5, y * 1.9 + 3, z * 1.9) * .62 + vn(x * 4.1, y * 4.1, z * 4.1) * .28 + vn(x * 8.3, y * 8.3, z * 8.3) * .1;
      const land = n > .5, t = land ? Math.min(1, (n - .5) * 3) : 0, pol = Math.abs(y) > .93;
      const c = pol ? [.86, 1, .92] : land ? [.18 + .2 * t, .72 + .15 * t, .36] : [.03, .26, .36 + .1 * n]; cols[i * 3] = c[0]; cols[i * 3 + 1] = c[1]; cols[i * 3 + 2] = c[2] }
    sg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const globe = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: 0, emissive: 0x020a18, emissiveIntensity: .9, transparent: true }));
    spin.add(globe); pE.add(globe);
    const gp = [];
    for (let lat = -60; lat <= 60; lat += 30) { const y = Math.sin(lat * Math.PI / 180) * 1.004, r = Math.cos(lat * Math.PI / 180) * 1.004; for (let i = 0; i < 48; i++) { const a = i / 48 * 6.2832, b = (i + 1) / 48 * 6.2832; gp.push(r * Math.cos(a), y, r * Math.sin(a), r * Math.cos(b), y, r * Math.sin(b)) } }
    for (let lon = 0; lon < 360; lon += 30) { const t = lon * Math.PI / 180; for (let i = -18; i < 18; i++) { const a = i * 5 * Math.PI / 180, b = (i + 1) * 5 * Math.PI / 180; gp.push(Math.cos(a) * Math.sin(t) * 1.004, Math.sin(a) * 1.004, Math.cos(a) * Math.cos(t) * 1.004, Math.cos(b) * Math.sin(t) * 1.004, Math.sin(b) * 1.004, Math.cos(b) * Math.cos(t) * 1.004) } }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); const grid = new THREE.LineSegments(gg, lmat(C.lime, .32)); spin.add(grid); pE.add(grid);
    const circ = (lat, color, op2) => { const y = Math.sin(lat * Math.PI / 180) * 1.012, r = Math.cos(lat * Math.PI / 180) * 1.012, pts = []; for (let i = 0; i < 64; i++) { const a = i / 64 * 6.2832; pts.push(V3(Math.cos(a) * r, y, Math.sin(a) * r)) } return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lmat(color, op2)) };
    const eq = circ(0, C.amb, .95), tc = circ(23.44, C.lime, 1), tp = circ(-23.44, C.lime, 1); tilt.add(eq, tc, tp); pEq.add(eq); pT.add(tc, tp);
    const ax = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(0, -1.9, 0), V3(0, 1.9, 0)]), lmat(C.amb, .95)); tilt.add(ax); pA.add(ax);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.09, .25, 10), mat(C.amb, { emissive: C.amb, ei: .8 })); tip.position.y = 1.95; tilt.add(tip); pA.add(tip);
    const lat = 22 * Math.PI / 180, lon = 78 * Math.PI / 180, pin = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 10), mat(C.coral, { emissive: C.coral, ei: 1 }));
    pin.position.set(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)).multiplyScalar(1.03); spin.add(pin); pI.add(pin);
    pI.anchor = () => pin.localToWorld(V3()); pA.anchor = () => tilt.localToWorld(V3(0, 2.0, 0)); pT.anchor = () => tilt.localToWorld(V3(0, Math.sin(TILT) * 1.05, Math.cos(TILT) * 1.05)); pE.anchor = () => eg.position.clone();
    pEq.anchor = () => tilt.localToWorld(V3(1.05, 0, 0)); pS.anchor = () => V3(0, 1.9, 0);
    function apply() { eg.position.copy(epos(P.day)); const a = beam.geometry.attributes.position.array, e = eg.position; a[3] = e.x; a[4] = e.y; a[5] = e.z; beam.geometry.attributes.position.needsUpdate = true }
    apply();
    const decl = d => -23.44 * Math.cos(2 * Math.PI * (d + 10) / 365);
    const season = d => d >= 79 && d < 172 ? 'spring' : d >= 172 && d < 265 ? 'summer' : d >= 265 && d < 355 ? 'autumn' : 'winter';
    return { root, parts: map,
      earthView() { const e = eg.position, dir = e.clone().normalize(), side = V3(-dir.z, 0, dir.x); return { pos: e.clone().addScaledVector(side, 5).addScaledVector(dir, 1.9).add(V3(0, 1.7, 0)), target: e.clone() } },
      update(dt) { spin.rotation.y += dt * 3.2; if (P.run == 1) { P.day += dt * 55; if (P.day > 365) P.day -= 364; ctx.uiSet('day', P.day); ctx.readout && ctx.readout() } apply() },
      setParam() { apply() },
      labels() { return marks.map(m => ({ text: m[1], pos: () => epos(m[0]).add(V3(0, 1.1, 0)) })) },
      readout(p) { const d = Math.round(p.day), de = decl(d), phi = 22 * Math.PI / 180, dl = 2 * Math.acos(clamp(-Math.tan(phi) * Math.tan(de * Math.PI / 180), -1, 1)) * 180 / Math.PI / 15;
        return `<b>${new Date(2025, 0, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</b> · northern ${season(d)}<br>Sun overhead at <b>${de >= 0 ? de.toFixed(1) + '° N' : (-de).toFixed(1) + '° S'}</b> · daylight at 22° N ≈ <b>${dl.toFixed(1)} h</b>` } };
  }
};

/* ───────── Quadratic graph ───────── */
MODELS.graph = {
  id: 'graph', title: 'Graph of a Quadratic', short: 'Quadratic', subject: 'Maths', listed: true,
  topics: 'quadratic equation, parabola, roots, discriminant, vertex, factorisation, y = ax² + bx + c',
  parts: ['curve', 'roots', 'vertex', 'yint', 'axis'], dist: [6, 36], floorY: -7, autorotate: false,
  views: { default: { pos: [0, 2.2, 15], target: [0, .9, 0] }, roots: { pos: [0, .6, 9], target: [0, 0, 0] }, side: { pos: [11, 5, 10], target: [0, .8, 0] } },
  params: [
    { id: 'a', type: 'range', label: 'a', min: -2, max: 2, step: .5, val: 1, fmt: v => fnum(v) },
    { id: 'b', type: 'range', label: 'b', min: -10, max: 10, step: 1, val: -5, fmt: v => fnum(v) },
    { id: 'c', type: 'range', label: 'c', min: -12, max: 12, step: 1, val: 6, fmt: v => fnum(v) }],
  build(ctx) {
    const P = ctx.params, root = new THREE.Group(), dyn = new THREE.Group(), { map, mk } = mkParts(), SX = .9, SY = .5, XR = 6, YR = 12; root.add(dyn);
    const pCurve = mk('curve', 'The parabola', () => P.a === 0 ? 'With a = 0 the x² term vanishes, so this is just a straight line. That is why a can never be zero in a quadratic.' : `Every point on this curve has y = ${fnum(P.a)}x²${sgn(P.b, 'x')}${sgn(P.c, '')}. It opens ${P.a > 0 ? 'upwards, since a is positive' : 'downwards, since a is negative'}.`, { frame: false });
    const pRoots = mk('roots', 'Roots (where it crosses the x-axis)', () => { const D = P.b * P.b - 4 * P.a * P.c; return D < 0 ? 'The curve never touches the x-axis, so there are no real roots.' : 'At these points y = 0, so the x-values here are the roots of the equation.' }, { view: 'roots' });
    const pVertex = mk('vertex', 'Vertex (turning point)', () => `The lowest or highest point. It sits exactly halfway between the roots, at x = −b / 2a = ${fnum(-P.b / (2 * P.a || 1))}.`, { frame: false });
    const pY = mk('yint', 'y-intercept', () => `Where the curve crosses the y-axis. Put x = 0 and you get y = c = ${fnum(P.c)}.`, { frame: false });
    const pAxis = mk('axis', 'Axis of symmetry', () => 'The curve is a mirror image on either side of this vertical line.', { frame: false });
    const am = mat(C.mint, { opacity: .6, emissive: C.mint, ei: .1 });
    root.add(between(V3(-XR * SX - .5, 0, 0), V3(XR * SX + .5, 0, 0), .04, am, 8)); root.add(between(V3(0, -YR * SY - .3, 0), V3(0, YR * SY + .5, 0), .04, am, 8));
    const gp = []; for (let i = -XR; i <= XR; i++) gp.push(V3(i * SX, -YR * SY, -.9), V3(i * SX, YR * SY, -.9)); for (let j = -YR; j <= YR; j += 2) gp.push(V3(-XR * SX, j * SY, -.9), V3(XR * SX, j * SY, -.9));
    root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gp), lmat(0x4c9dff, .12)));
    const tk = mat(C.mint, { opacity: .7 }); for (let i = -XR; i <= XR; i++) { if (!i) continue; const t = new THREE.Mesh(new THREE.BoxGeometry(.04, .22, .04), tk); t.position.set(i * SX, 0, 0); root.add(t) }
    let labs = [];
    function rebuild() {
      clearGroup(dyn); [pCurve, pRoots, pVertex, pY, pAxis].forEach(p => p.objs.length = 0); labs = [];
      const a = P.a, b = P.b, c = P.c, f = x => a * x * x + b * x + c, runs = []; let run = [];
      for (let i = 0; i <= 240; i++) { const x = -XR + i * (2 * XR / 240), y = f(x); if (Math.abs(y) <= YR) run.push([x, y]); else { if (run.length > 1) runs.push(run); run = [] } }
      if (run.length > 1) runs.push(run);
      const rm = mat(C.lime, { opacity: .3, side: THREE.DoubleSide, emissive: C.lime, ei: .3, depthWrite: false });
      runs.forEach(r => {
        const pos = [], idx = []; r.forEach((p, i) => { pos.push(p[0] * SX, p[1] * SY, .8, p[0] * SX, p[1] * SY, -.8); if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k) } });
        const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setIndex(idx); bg.computeVertexNormals();
        const mesh = new THREE.Mesh(bg, rm); dyn.add(mesh); pCurve.add(mesh);
        [.8, -.8].forEach(z => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(r.map(p => V3(p[0] * SX, p[1] * SY, z))), new THREE.LineBasicMaterial({ color: 0xcbb8ff, transparent: true, opacity: .95 })); dyn.add(l); pCurve.add(l) });
      });
      setBase(rm, .3);
      const dot = (x, y, color, part) => { const m = new THREE.Mesh(new THREE.SphereGeometry(.27, 20, 14), mat(color, { emissive: color, ei: .6 })); m.position.set(x * SX, y * SY, 0); dyn.add(m); part.add(m); return m };
      let rootsX = []; const D = b * b - 4 * a * c;
      if (a === 0) { if (b !== 0) rootsX = [-c / b] } else if (D >= 0) { const s = Math.sqrt(D); rootsX = D === 0 ? [-b / (2 * a)] : [(-b - s) / (2 * a), (-b + s) / (2 * a)] }
      rootsX = rootsX.filter(x => Math.abs(x) <= XR); rootsX.forEach(x => { dot(x, 0, C.amb, pRoots); labs.push({ text: 'x = ' + fnum(x), pos: () => V3(x * SX, -.75, 0) }) });
      if (a !== 0) { const vx = -b / (2 * a), vy = f(vx); if (Math.abs(vx) <= XR && Math.abs(vy) <= YR) { dot(vx, vy, C.teal, pVertex); labs.push({ text: 'vertex', pos: () => V3(vx * SX, vy * SY + (a > 0 ? -1.7 : 1.7), 0) });
        const ax = boxMesh(.05, YR * SY * 2, .05, C.teal, .45, .1); ax.position.set(vx * SX, 0, 0); dyn.add(ax); pAxis.add(ax) } }
      if (Math.abs(c) <= YR) { dot(0, c, C.coral, pY); labs.push({ text: 'c = ' + fnum(c), pos: () => V3(.95, c * SY + .45, 0) }) }
      ctx.refresh();
    }
    rebuild();
    return { root, parts: map, setParam: rebuild, labels: () => labs,
      readout(p) { const D = p.b * p.b - 4 * p.a * p.c;
        const eq = `y = ${p.a === 1 ? '' : p.a === -1 ? '−' : fnum(p.a)}x²${sgn(p.b, 'x')}${sgn(p.c, '')}`;
        const r = p.a === 0 ? 'a = 0: not a quadratic' : D < 0 ? 'D < 0: no real roots' : D === 0 ? `D = 0: one root, x = ${fnum(-p.b / (2 * p.a))}` : `D = ${D} > 0: two roots, x = ${fnum((-p.b - Math.sqrt(D)) / (2 * p.a))} and ${fnum((-p.b + Math.sqrt(D)) / (2 * p.a))}`;
        return `<b>${eq}</b><br>${r}` } };
  }
};

/* ───────── Binary bits ───────── */
const BIN_COL = [C.lime, C.g, C.cyan, C.teal, C.amb, C.coral, C.lime, C.g];
MODELS.binary = {
  id: 'binary', title: 'Binary Number Bits', short: 'Binary', subject: 'Computer Science', listed: true,
  topics: 'binary number system, bits and bytes, place values, converting decimal to binary, ASCII',
  parts: ['bits', 'msb', 'lsb'], dist: [6, 30], floorY: -1.4, autorotate: false,
  views: { default: { pos: [0, 4.8, 22], target: [0, 1.2, 0] }, msb: { pos: [-8, 3.5, 9], target: [-7, 0, 0] }, lsb: { pos: [8, 3.5, 9], target: [7, 0, 0] } },
  params: [
    { id: 'value', type: 'range', label: 'Number', min: 0, max: 255, step: 1, val: 13, fmt: v => v },
    { id: 'bits', type: 'choice', label: 'Bits', options: [[4, '4 bits'], [8, '8 bits']], val: 8 }],
  build(ctx) {
    const P = ctx.params, root = new THREE.Group(), { map, mk } = mkParts(), cubes = [];
    const pAll = mk('bits', 'Bits', () => 'Each cube is one bit, a switch that is either 0 (off) or 1 (on). Bright and raised means 1.', { frame: false });
    const pMsb = mk('msb', 'Left-most bit', () => `The biggest place value, ${Math.pow(2, P.bits - 1)}. It is called the most significant bit.`, { frame: false });
    const pLsb = mk('lsb', 'Right-most bit', () => 'The smallest place value, 1. It decides whether the number is odd or even.', { frame: false });
    for (let i = 0; i < 8; i++) { const m = boxMesh(1.5, 1.5, 1.5, BIN_COL[i], .9); m.position.x = (i - 3.5) * 2; root.add(m); cubes.push(m) }
    const base = new THREE.Mesh(new THREE.BoxGeometry(17, .12, 2.6), mat(0x0b2a55, { opacity: .6 })); base.position.set(0, -.85, 0); root.add(base);
    const n = () => P.bits === 4 ? 4 : 8, val = () => Math.min(P.value, Math.pow(2, n()) - 1), bitOn = i => { const k = 7 - i; return (val() >> k) & 1 };
    let labs = [];
    function apply() {
      cubes.forEach((m, i) => { const used = i >= 8 - n(), on = used && bitOn(i); m.visible = used;
        m.material.color.setHex(on ? BIN_COL[i] : 0x16335f); m.material.emissive.setHex(on ? BIN_COL[i] : 0x000000); m.material.emissiveIntensity = on ? .55 : 0;
        m.userData.e.material.color.setHex(on ? BIN_COL[i] : 0x4c7bd1); setBase(m.material, on ? .95 : .35); setBase(m.userData.e.material, on ? 1 : .55);
        m.position.y = on ? .55 : 0; m.scale.setScalar(on ? 1 : .9) });
      pAll.objs.length = 0; cubes.forEach((m, i) => { if (i >= 8 - n()) pAll.add(m) }); pMsb.objs.length = 0; pLsb.objs.length = 0; pMsb.add(cubes[8 - n()]); pLsb.add(cubes[7]);
      labs = []; cubes.forEach((m, i) => { if (i < 8 - n()) return; labs.push({ text: String(Math.pow(2, 7 - i)), pos: () => V3((i - 3.5) * 2, -1.35, 0) }); labs.push({ text: String(bitOn(i)), pos: () => V3((i - 3.5) * 2, m.position.y + 1.35, 0) }) });
      ctx.refresh();
    }
    apply();
    return { root, parts: map, setParam: apply, labels: () => labs,
      readout(p) { const k = Math.min(p.value, Math.pow(2, p.bits) - 1), s = k.toString(2).padStart(p.bits, '0'), on = []; for (let i = 0; i < p.bits; i++) if (s[i] === '1') on.push(Math.pow(2, p.bits - 1 - i));
        const ch = k >= 65 && k <= 122 && (k <= 90 || k >= 97) ? ` · ASCII “${String.fromCharCode(k)}”` : '';
        return `<b>${s}₂</b> = ${on.length ? on.join(' + ') : '0'} = <b>${k}</b>${ch}` } };
  }
};

/* ───────── Loop track ───────── */
MODELS.loop = {
  id: 'loop', title: 'A for Loop, Step by Step', short: 'for loop', subject: 'Computer Science', listed: true,
  topics: 'for loop, range(start, stop, step), iteration, programming, python loop',
  parts: ['track', 'pointer', 'first', 'stop'], dist: [6, 32], floorY: -1.2, autorotate: false,
  views: { default: { pos: [0, 5, 19], target: [0, 1, 0] }, start: { pos: [-9, 3, 8], target: [-8, 0, 0] }, end: { pos: [9, 3, 8], target: [8, 0, 0] } },
  params: [
    { id: 'start', type: 'range', label: 'start', min: 0, max: 4, step: 1, val: 0, fmt: v => v },
    { id: 'stop', type: 'range', label: 'stop', min: 1, max: 12, step: 1, val: 5, fmt: v => v },
    { id: 'step', type: 'range', label: 'step', min: 1, max: 3, step: 1, val: 1, fmt: v => v },
    { id: 'run', type: 'range', label: 'Run the loop', min: 0, max: 1, step: .005, val: 0, fmt: v => Math.round(v * 100) + '%' }],
  build(ctx) {
    const P = ctx.params, root = new THREE.Group(), { map, mk } = mkParts();
    const pTrack = mk('track', 'The values i takes', () => `range(${P.start}, ${P.stop}, ${P.step}) gives these values, one per round of the loop.`, { frame: false });
    const pPtr = mk('pointer', 'The loop variable i', () => 'This glowing ball is the variable i. It hops to the next value each round, and the indented code runs once per hop.', { frame: false });
    const pFirst = mk('first', 'First value', () => `The loop begins at start = ${P.start}.`, { frame: false });
    const pStop = mk('stop', 'Stop value', () => `The loop stops BEFORE reaching ${P.stop}. The stop value itself is never used.`, { frame: false });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.45, 24, 16), mat(C.amb, { emissive: C.amb, ei: .9 })); root.add(ball); pPtr.add(ball);
    const dyn = new THREE.Group(); root.add(dyn); let vals = [], cubes = [], labs = [];
    const X = i => (i - (Math.max(vals.length, 1) - 1) / 2) * 2.3;
    function rebuild() {
      clearGroup(dyn); [pTrack, pFirst, pStop].forEach(p => p.objs.length = 0); cubes = []; labs = []; vals = [];
      for (let v = P.start; v < P.stop && vals.length < 10; v += P.step) vals.push(v);
      vals.forEach((v, i) => { const m = boxMesh(1.6, 1.6, 1.6, BIN_COL[i % 8], .8); m.position.set(X(i), 0, 0); dyn.add(m); cubes.push(m); pTrack.add(m); if (!i) pFirst.add(m); labs.push({ text: String(v), pos: () => V3(X(i), -1.4, 0) }) });
      const gx = X(vals.length); const gg = new THREE.BoxGeometry(1.6, 1.6, 1.6); const ghost = new THREE.LineSegments(new THREE.EdgesGeometry(gg), lmat(C.coral, .9)); ghost.position.set(gx, 0, 0); dyn.add(ghost); pStop.add(ghost);
      labs.push({ text: `stop = ${P.stop} (never used)`, pos: () => V3(gx, -1.4, 0) });
      if (!vals.length) labs.push({ text: 'empty: start is not below stop', pos: () => V3(0, 1.5, 0) });
      ctx.refresh(); apply();
    }
    function idxNow() { const N = vals.length; if (!N || P.run <= 0) return -1; return Math.min(N - 1, Math.floor(P.run * N)) }
    function apply() {
      const N = vals.length, t = P.run * N, i = idxNow();
      cubes.forEach((m, k) => { const done = i >= 0 && k <= i; m.material.color.setHex(done ? 0xffb454 : 0x2a5bb0); m.material.emissive.setHex(done ? 0xffb454 : 0x000000); m.material.emissiveIntensity = done ? .35 : 0;
        m.userData.e.material.color.setHex(done ? 0xffd9a0 : 0x6fa0ff); setBase(m.material, done ? .9 : .5); m.position.y = done ? .35 : 0 });
      if (i < 0 || !N) { ball.position.set(X(0) - 2.4, 1.6, 0) }
      else { const f = Math.min(1, t - i), prev = i > 0 ? X(i - 1) : X(0) - 2.4, x = prev + (X(i) - prev) * Math.min(1, f * 1.6); ball.position.set(x, 1.7 + Math.sin(Math.min(1, f * 1.6) * Math.PI) * 1.1, 0) }
    }
    rebuild();
    return { root, parts: map, setParam(id) { if (id === 'run') apply(); else rebuild() }, labels: () => labs,
      update(dt) { ball.rotation.y += dt * 2 },
      readout(p) { const i = idxNow(); const loopTxt = `for i in range(${p.start}, ${p.stop}, ${p.step}):`;
        if (!vals.length) return `<b>${loopTxt}</b><br>Nothing runs: the range is empty.`;
        const so = vals.slice(0, i + 1), sum = so.reduce((a, b) => a + b, 0);
        return `<b>${loopTxt}</b><br>${i < 0 ? 'Press play: i has not moved yet.' : `i = <b>${vals[i]}</b> · round ${i + 1} of ${vals.length}<br>values so far: ${so.join(', ')} · running total = <b>${sum}</b>`}` } };
  }
};

/* ───────── Active and passive voice ───────── */
const VOICE_S = {
  letter: { dA: 'Riya', aA: 'wrote', rA: 'a letter', rP: 'A letter', aP: 'was written', dP: 'by Riya', tense: 'Past simple: was/were + V3' },
  window: { dA: 'The boys', aA: 'broke', rA: 'the window', rP: 'The window', aP: 'was broken', dP: 'by the boys', tense: 'Past simple: was/were + V3' },
  food: { dA: 'The cook', aA: 'prepares', rA: 'food', rP: 'Food', aP: 'is prepared', dP: 'by the cook', tense: 'Present simple: is/are + V3' } };
MODELS.voice = {
  id: 'voice', title: 'Active and Passive Voice', short: 'Voice', subject: 'English', listed: true,
  topics: 'active voice, passive voice, subject object verb, grammar, rewriting sentences',
  parts: ['doer', 'action', 'receiver', 'arrow'], dist: [6, 28], floorY: -1.6, autorotate: false,
  views: { default: { pos: [0, 3.2, 14], target: [0, .3, 0] }, close: { pos: [0, 2, 9.5], target: [0, .3, 0] } },
  params: [
    { id: 'sentence', type: 'choice', label: 'Sentence', options: [['letter', 'Riya wrote…'], ['window', 'The boys broke…'], ['food', 'The cook prepares…']], val: 'letter' },
    { id: 'voice', type: 'range', label: 'Active ↔ Passive', min: 0, max: 1, step: .01, val: 0, fmt: v => v < .5 ? 'Active' : 'Passive' }],
  build(ctx) {
    const P = ctx.params, root = new THREE.Group(), { map, mk } = mkParts();
    const pD = mk('doer', 'The doer', () => 'The doer is the one who performs the action. In the passive it moves to the end and gets “by” in front.', { frame: false });
    const pA = mk('action', 'The verb', () => P.voice < .5 ? 'The action in its normal form.' : 'In the passive the verb changes to a form of “to be” plus the past participle (V3).', { frame: false });
    const pR = mk('receiver', 'The receiver', () => 'The receiver is the one the action happens to. In the passive it becomes the subject and moves to the front.', { frame: false });
    const pArr = mk('arrow', 'Direction of the action', () => 'This arrow always points from the doer to the receiver. The sentence order flips, but who did what to whom never changes.', { frame: false });
    const bd = boxMesh(3.6, 1.6, 1.6, C.g, .85), ba = boxMesh(3.6, 1.6, 1.6, C.amb, .85), br = boxMesh(3.6, 1.6, 1.6, C.lime, .85);
    [bd, ba, br].forEach(b => root.add(b)); pD.add(bd); pA.add(ba); pR.add(br);
    const arrow = new THREE.Group(), am = mat(C.mint, { opacity: .95, side: THREE.DoubleSide, emissive: C.mint, ei: .3 });
    arrow.add(between(V3(-4.2, 0, 0), V3(3.4, 0, 0), .07, am, 8)); const cone = new THREE.Mesh(new THREE.ConeGeometry(.3, .7, 16), am); cone.rotation.z = -Math.PI / 2; cone.position.x = 4.2; arrow.add(cone);
    arrow.position.y = 1.9; root.add(arrow); pArr.add(...arrow.children);
    let labs = [], mode = -1, sent = '';
    const S = () => VOICE_S[P.sentence] || VOICE_S.letter;
    function layout() {
      const e = ease(P.voice), x1 = -4.2, x2 = 4.2;
      bd.position.set(x1 + (x2 - x1) * e, 0, 0); br.position.set(x2 + (x1 - x2) * e, 0, 0); ba.position.set(0, 0, 0); arrow.scale.x = 1 - 2 * e;
      const m = P.voice < .5 ? 0 : 1; if (m !== mode || sent !== P.sentence) { mode = m; sent = P.sentence; const s = S();
        labs = [{ text: m ? s.dP : s.dA, pos: () => bd.position.clone() }, { text: m ? s.aP : s.aA, pos: () => ba.position.clone() }, { text: m ? s.rP : s.rA, pos: () => br.position.clone() }]; ctx.refresh() }
    }
    layout();
    return { root, parts: map, setParam: layout, labels: () => labs,
      readout(p) { const s = VOICE_S[p.sentence] || VOICE_S.letter, m = p.voice >= .5;
        return m ? `<b>Passive:</b> ${s.rP} ${s.aP} ${s.dP}.<br>Receiver + be + V3 + by + doer<br>${s.tense}` : `<b>Active:</b> ${s.dA} ${s.aA} ${s.rA}.<br>Doer + verb + receiver` } };
  }
};

/* idle scene, shown before a lesson's first model loads */
MODELS.idle = {
  id: 'idle', title: 'Ready', short: 'Ready', subject: '', listed: false, parts: [], params: [], dist: [8, 30], floor: true, autorotate: true, floorY: -5,
  views: { default: { pos: [0, 3, 15], target: [0, 0, 0] } },
  build() {
    const root = new THREE.Group(), a = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2, 1), mat(C.g, { opacity: .18, flat: true, emissive: C.g, ei: .15, depthWrite: false }));
    a.add(wire(new THREE.IcosahedronGeometry(3.2, 1), C.lime, .7)); root.add(a);
    const b = wire(new THREE.OctahedronGeometry(4.6, 0), C.g, .5); root.add(b);
    const rings = [0, 1, 2].map(i => { const r = new THREE.Mesh(new THREE.TorusGeometry(5.6 + i * .7, .012, 6, 120), mat(C.mint, { opacity: .4 })); r.rotation.set(i * 1.1, i * .7, 0); root.add(r); return r });
    return { root, parts: {}, update(dt) { a.rotation.y += dt * .3; a.rotation.x += dt * .12; b.rotation.y -= dt * .2; rings.forEach((r, i) => { r.rotation.z += dt * (.08 + i * .04) }) } };
  }
};

return MODELS;
}

/** The ids of the ported models (usable without loading three.js). */
export const MODEL_IDS = ["mensuration", "pythag", "solids", "atom", "cell", "molecule", "lens", "seasons", "graph", "binary", "loop", "voice"] as const;
