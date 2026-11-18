"use client";

import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Pause, Play, RotateCcw, Tag, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Scene, SceneObject } from "@/lib/model3d-schema";
import { Button, cn } from "../ui";

type Api = { setFocus: (ids: Set<string> | null) => void; resetView: () => void };
type Shared = { playing: boolean; labels: boolean; focus: Set<string> | null };

const DEG = Math.PI / 180;

/**
 * Draws a lesson's 3D scene with three.js (loaded only when a model is opened). Drag to rotate, pinch or
 * scroll to zoom, tap a part (or its name in the list) to read about it, and follow the guided tour.
 * The parts list and tour also work as plain text, e.g. for screen readers or if 3D isn't available.
 */
export function ModelViewer({ scene }: { scene: Scene }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  const shared = useRef<Shared>({ playing: true, labels: true, focus: null });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [labels, setLabels] = useState(true);
  const [full, setFull] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [step, setStep] = useState<number | null>(null);

  const byId = useMemo(() => new Map(scene.objects.map((o) => [o.id, o])), [scene]);
  /** Parts grouped by name, so repeated parts (6 protons) are listed once. */
  const groups = useMemo(() => {
    const m = new Map<string, SceneObject[]>();
    for (const o of scene.objects) m.set(o.label, [...(m.get(o.label) ?? []), o]);
    return [...m.entries()].map(([label, objs]) => ({ label, ids: objs.map((o) => o.id), first: objs[0] }));
  }, [scene]);
  const moving = scene.objects.some((o) => o.motion.kind !== "none");

  // Selecting a part highlights every part with the same name; a tour step highlights its parts.
  const focus = useMemo(() => {
    if (selected) { const label = byId.get(selected)?.label; return new Set(scene.objects.filter((o) => o.label === label).map((o) => o.id)); }
    if (step !== null && scene.steps[step]?.focus.length) return new Set(scene.steps[step].focus);
    return null;
  }, [selected, step, byId, scene]);
  useEffect(() => { shared.current.focus = focus; apiRef.current?.setFocus(focus); }, [focus]);
  useEffect(() => { shared.current.playing = playing; }, [playing]);
  useEffect(() => { shared.current.labels = labels; if (labelsRef.current) labelsRef.current.style.display = labels ? "" : "none"; }, [labels]);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
  }, []);

  const select = useCallback((id: string | null) => { setSelected(id); }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const labelLayer = labelsRef.current;
    if (!stage || !labelLayer) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
      if (disposed) return;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        setFailed(true);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.className = "block h-full w-full touch-none";
      renderer.domElement.setAttribute("aria-hidden", "true");
      stage.appendChild(renderer.domElement);

      const world = new THREE.Scene();
      world.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
      const sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
      sunLight.position.set(5, 8, 6);
      world.add(sunLight);
      const fill = new THREE.DirectionalLight(0xffffff, 0.5);
      fill.position.set(-6, -2, -4);
      world.add(fill);

      const root = new THREE.Group();
      world.add(root);
      const disposables: { dispose: () => void }[] = [];
      type Item = {
        o: SceneObject; group: InstanceType<typeof THREE.Group>; inner: InstanceType<typeof THREE.Group>;
        mats: InstanceType<typeof THREE.MeshStandardMaterial>[]; radius: number; anchor: InstanceType<typeof THREE.Vector3>;
        base: InstanceType<typeof THREE.Vector3>; orbit: { r: number; a0: number; dy: number; center: string | null } | null;
        path: InstanceType<typeof THREE.LineLoop> | null; label: HTMLButtonElement | null;
      };
      const items = new Map<string, Item>();
      const pickable: InstanceType<typeof THREE.Mesh>[] = [];

      const material = (o: SceneObject) => {
        const m = new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.55, metalness: 0.05, transparent: o.opacity < 0.99, opacity: o.opacity, depthWrite: o.opacity >= 0.99, side: o.opacity < 0.99 ? THREE.DoubleSide : THREE.FrontSide });
        m.userData.baseOpacity = o.opacity;
        disposables.push(m);
        return m;
      };
      const geometry = (o: SceneObject) => {
        const [a, b, c] = o.size;
        let g;
        switch (o.shape) {
          case "sphere": g = new THREE.SphereGeometry(a, 40, 24); break;
          case "box": g = new THREE.BoxGeometry(a, b, c); break;
          case "cylinder": g = new THREE.CylinderGeometry(a, a, b, 40); break;
          case "cone": g = new THREE.ConeGeometry(a, b, 40); break;
          case "capsule": g = new THREE.CapsuleGeometry(a, b, 8, 20); break;
          // Lying flat, in the same plane as orbits.
          default: g = new THREE.TorusGeometry(a, Math.min(b, a * 0.9), 16, 120).rotateX(Math.PI / 2);
        }
        disposables.push(g);
        return g;
      };

      let containers = 0;
      // Biggest see-through shell first, so the outermost label takes the first spot on the rim.
      const order = [...scene.objects].sort((a, b) => (b.shape === "sphere" && b.opacity < 0.6 ? b.size[0] : 0) - (a.shape === "sphere" && a.opacity < 0.6 ? a.size[0] : 0));
      const containerRank = new Map(order.filter((o) => o.shape === "sphere" && o.opacity < 0.6).map((o, i) => [o.id, i]));
      for (const o of scene.objects) {
        const group = new THREE.Group();
        const inner = new THREE.Group();
        group.add(inner);
        group.position.set(...o.position);
        const mats: InstanceType<typeof THREE.MeshStandardMaterial>[] = [];
        let radius: number;
        const anchor = new THREE.Vector3();
        if (o.shape === "arrow" && o.to) {
          const from = new THREE.Vector3(...o.position);
          const dir = new THREE.Vector3(...o.to).sub(from);
          const len = dir.length();
          const t = Math.max(o.size[0], 0.02);
          const head = Math.min(len * 0.35, Math.max(t * 5, 0.28));
          const mat = material(o);
          mats.push(mat);
          const shaftG = new THREE.CylinderGeometry(t, t, Math.max(len - head, 0.01), 20).translate(0, (len - head) / 2, 0);
          const headG = new THREE.ConeGeometry(Math.max(t * 2.6, 0.09), head, 24).translate(0, len - head / 2, 0);
          disposables.push(shaftG, headG);
          for (const g of [shaftG, headG]) { const mesh = new THREE.Mesh(g, mat); mesh.userData.id = o.id; inner.add(mesh); pickable.push(mesh); }
          inner.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
          radius = len / 2;
          // At the arrow's tail, so the label never covers the head (what it points at).
          anchor.set(0, 0, 0);
        } else {
          group.rotation.set(o.rotation[0] * DEG, o.rotation[1] * DEG, o.rotation[2] * DEG);
          const g = geometry(o);
          const mat = material(o);
          mats.push(mat);
          const mesh = new THREE.Mesh(g, mat);
          mesh.userData.id = o.id;
          inner.add(mesh);
          pickable.push(mesh);
          g.computeBoundingSphere();
          g.computeBoundingBox();
          radius = g.boundingSphere?.radius ?? 0.5;
          if (o.shape === "torus") anchor.set(o.size[0] * 0.71, 0, o.size[0] * 0.71);
          else if (o.shape === "sphere" && o.opacity < 0.6) {
            // See-through shells (cell membrane, Earth's layers) often share a centre: spread their labels
            // around the rim instead of stacking them all at the top.
            const k = containerRank.get(o.id) ?? containers++;
            const a = (120 + k * 38) * DEG;
            anchor.set(Math.cos(a) * o.size[0], Math.sin(a) * o.size[0], 0);
          } else if (o.rotation.some((d) => d !== 0)) anchor.set(0, 0, 0); // tilted parts (a bond): label the middle
          else anchor.set(0, (g.boundingBox?.max.y ?? radius) + 0.12, 0);
        }
        // Inner parts are drawn before the see-through parts around them.
        for (const m of mats) if (m.transparent) inner.children.forEach((c) => { c.renderOrder = 1 + radius; });
        root.add(group);

        let orbit: Item["orbit"] = null;
        let path: Item["path"] = null;
        if (o.motion.kind === "orbit") {
          const c = o.motion.center ? byId.get(o.motion.center)?.position ?? [0, 0, 0] : [0, 0, 0];
          const dx = o.position[0] - c[0];
          const dz = o.position[2] - c[2];
          orbit = { r: Math.hypot(dx, dz), a0: Math.atan2(dz, dx), dy: o.position[1] - c[1], center: o.motion.center };
          if (orbit.r > 0.3) {
            const pts = Array.from({ length: 128 }, (_, i) => new THREE.Vector3(Math.cos((i / 128) * Math.PI * 2) * orbit!.r, 0, Math.sin((i / 128) * Math.PI * 2) * orbit!.r));
            const pg = new THREE.BufferGeometry().setFromPoints(pts);
            const pm = new THREE.LineBasicMaterial({ color: 0x8a9aa8, transparent: true, opacity: 0.35 });
            disposables.push(pg, pm);
            path = new THREE.LineLoop(pg, pm);
            path.position.set(c[0], c[1] + orbit.dy, c[2]);
            root.add(path);
          }
        }

        let label: HTMLButtonElement | null = null;
        if (!o.hideLabel) {
          label = document.createElement("button");
          label.type = "button";
          label.textContent = o.label;
          label.tabIndex = -1; // the parts list below is the keyboard way in
          label.className = "absolute left-0 top-0 whitespace-nowrap rounded-md border border-border bg-surface/85 px-1.5 py-0.5 text-[11px] font-medium text-text shadow-sm backdrop-blur-sm transition-opacity hover:border-primary";
          label.style.pointerEvents = "auto";
          label.addEventListener("click", () => select(o.id));
          labelLayer.appendChild(label);
        }
        items.set(o.id, { o, group, inner, mats, radius, anchor, base: group.position.clone(), orbit, path, label });
      }

      // Fit the camera to the whole model, including orbit paths, from slightly above and to the side.
      // Half the model's largest side (not its bounding sphere, which is far too big for flat models like an
      // atom's shells), fitted to the narrower of the view's two angles so it also fills a phone screen.
      const box = new THREE.Box3().setFromObject(root);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const dims = box.getSize(new THREE.Vector3());
      const fitR = Math.max(dims.x, dims.y, dims.z, 1) / 2;
      const camera = new THREE.PerspectiveCamera(40, 1, fitR / 100, fitR * 40);
      const aspect = stage.clientWidth && stage.clientHeight ? stage.clientWidth / stage.clientHeight : 1.6;
      const half = Math.min(20 * DEG, Math.atan(Math.tan(20 * DEG) * aspect));
      const dist = fitR / Math.tan(half) + fitR * 0.75;
      const home = new THREE.Vector3(0.5, 0.42, 1).normalize().multiplyScalar(dist).add(sphere.center);
      camera.position.copy(home);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(sphere.center);
      controls.enableDamping = true;
      controls.minDistance = fitR * 0.15;
      controls.maxDistance = dist * 3;
      controls.update();

      const resize = () => {
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(stage);
      resize();

      // Tap (not drag) to pick a part. Of the parts under the finger up to the first solid one, the smallest
      // wins, so tapping the middle of a see-through cell picks the nucleus rather than the membrane.
      const ray = new THREE.Raycaster();
      let down: { x: number; y: number } | null = null;
      const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
      const onUp = (e: PointerEvent) => {
        if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return; }
        down = null;
        const r = renderer.domElement.getBoundingClientRect();
        ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
        const hits = ray.intersectObjects(pickable, false);
        const considered: string[] = [];
        for (const h of hits) {
          const id = h.object.userData.id as string;
          if (!considered.includes(id)) considered.push(id);
          if ((items.get(id)?.o.opacity ?? 1) >= 0.95) break;
        }
        if (considered.length === 0) { select(null); return; }
        select(considered.reduce((a, b) => ((items.get(b)?.radius ?? 1) < (items.get(a)?.radius ?? 1) ? b : a)));
      };
      renderer.domElement.addEventListener("pointerdown", onDown);
      renderer.domElement.addEventListener("pointerup", onUp);

      const applyFocus = (ids: Set<string> | null) => {
        for (const it of items.values()) {
          const on = !ids || ids.has(it.o.id);
          for (const m of it.mats) {
            const base = m.userData.baseOpacity as number;
            m.opacity = on ? base : Math.min(base, 0.12);
            m.transparent = m.opacity < 0.99;
            m.depthWrite = !m.transparent;
            m.emissive.set(ids && on ? it.o.color : "#000000");
            m.emissiveIntensity = ids && on ? 0.35 : 0;
            m.needsUpdate = true;
          }
          if (it.label) it.label.style.opacity = on ? "1" : "0.25";
          if (it.path) (it.path.material as InstanceType<typeof THREE.LineBasicMaterial>).opacity = on ? 0.35 : 0.08;
        }
      };
      apiRef.current = {
        setFocus: applyFocus,
        resetView: () => { camera.position.copy(home); controls.target.copy(sphere.center); controls.update(); },
      };
      applyFocus(shared.current.focus);

      let visible = true;
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
      io.observe(stage);

      const clock = new THREE.Clock();
      let t = 0;
      const tmp = new THREE.Vector3();
      /** Label sizes, measured once (reading them every frame would make the browser redo layout). */
      const sizes = new WeakMap<HTMLElement, [number, number]>();
      let frame = 0;
      const tick = () => {
        frame = requestAnimationFrame(tick);
        const dt = Math.min(clock.getDelta(), 0.1);
        if (!visible) return;
        if (shared.current.playing) t += dt;
        // Parts are listed with orbit centres first, so each centre has already moved this frame.
        for (const it of items.values()) {
          const { kind, speed } = it.o.motion;
          if (kind === "orbit" && it.orbit) {
            const c = it.orbit.center ? items.get(it.orbit.center)?.group.position ?? tmp.set(0, 0, 0) : tmp.set(0, 0, 0);
            const a = it.orbit.a0 + t * speed * 0.6;
            it.group.position.set(c.x + Math.cos(a) * it.orbit.r, c.y + it.orbit.dy, c.z + Math.sin(a) * it.orbit.r);
            it.path?.position.set(c.x, c.y + it.orbit.dy, c.z);
          } else if (kind === "spin") it.inner.rotation.y = t * speed * 1.2;
          else if (kind === "bob") it.group.position.y = it.base.y + Math.sin(t * speed * 1.6) * 0.25;
          else if (kind === "pulse") it.inner.scale.setScalar(1 + 0.06 * Math.sin(t * speed * 3));
        }
        controls.update();
        renderer.render(world, camera);

        if (shared.current.labels) {
          const w = stage.clientWidth;
          const h = stage.clientHeight;
          const focusIds = shared.current.focus;
          const spots: { it: Item; x: number; y: number; z: number; first: boolean }[] = [];
          for (const it of items.values()) {
            if (!it.label) continue;
            tmp.copy(it.anchor);
            it.inner.localToWorld(tmp);
            tmp.project(camera);
            if (tmp.z > 1 || tmp.z < -1) { it.label.style.visibility = "hidden"; continue; }
            spots.push({ it, x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h, z: tmp.z, first: !!focusIds?.has(it.o.id) });
          }
          // Highlighted parts first, then nearest first; a label that would overlap one already placed is hidden
          // (its part can still be tapped, and is in the parts list).
          spots.sort((a, b) => Number(b.first) - Number(a.first) || a.z - b.z);
          const placed: [number, number, number, number][] = [];
          for (const s of spots) {
            const el = s.it.label!;
            let size = sizes.get(el);
            if (!size) { size = [el.offsetWidth, el.offsetHeight]; if (size[0] > 0) sizes.set(el, size); }
            const [lw, lh] = size[0] > 0 ? size : [60, 18];
            const r: [number, number, number, number] = [s.x - lw / 2 - 2, s.y - lh - 2, s.x + lw / 2 + 2, s.y + 2];
            if (placed.some((p) => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1])) { el.style.visibility = "hidden"; continue; }
            placed.push(r);
            el.style.visibility = "visible";
            el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
          }
        }
      };
      tick();
      setReady(true);

      cleanup = () => {
        cancelAnimationFrame(frame);
        ro.disconnect();
        io.disconnect();
        renderer.domElement.removeEventListener("pointerdown", onDown);
        renderer.domElement.removeEventListener("pointerup", onUp);
        controls.dispose();
        disposables.forEach((d) => d.dispose());
        renderer.dispose();
        renderer.domElement.remove();
        labelLayer.replaceChildren();
        apiRef.current = null;
      };
    })().catch(() => { if (!disposed) setFailed(true); });

    return () => { disposed = true; cleanup(); };
  }, [scene, byId, select]);

  // Full screen is a fixed layer over the app (works on iPhones); Esc closes it.
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [full]);

  const part = selected ? byId.get(selected) : null;
  const current = step !== null ? scene.steps[step] : null;

  return (
    <div ref={wrapRef} data-testid="model3d-viewer" data-ready={ready ? "true" : "false"}
      className={cn("flex flex-col gap-3", full && "fixed inset-0 z-[70] overflow-y-auto bg-bg p-3 sm:p-5")}>
      {full && <p className="text-sm font-semibold">{scene.title}</p>}
      <div className={cn("relative overflow-hidden rounded-xl border border-border bg-surface-2", full ? "min-h-[55vh] flex-1" : "h-[min(60vh,440px)] min-h-[260px]")}>
        <div ref={stageRef} className="absolute inset-0" />
        <div ref={labelsRef} data-testid="model3d-labels" className="pointer-events-none absolute inset-0 overflow-hidden" />
        {failed && <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-muted">3D isn&apos;t available in this browser. You can still read about each part below.</p>}
        {!ready && !failed && <p className="absolute inset-0 grid place-items-center text-sm text-muted">Loading the 3D model…</p>}
        <div className="absolute right-2 top-2 flex gap-1">
          {moving && <IconButton label={playing ? "Pause motion" : "Play motion"} onClick={() => setPlaying((p) => !p)}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</IconButton>}
          <IconButton label={labels ? "Hide labels" : "Show labels"} pressed={labels} onClick={() => setLabels((l) => !l)}><Tag className="size-4" /></IconButton>
          <IconButton label="Reset view" onClick={() => apiRef.current?.resetView()}><RotateCcw className="size-4" /></IconButton>
          <IconButton label={full ? "Exit full screen" : "Full screen"} onClick={() => setFull((f) => !f)}>{full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</IconButton>
        </div>
        <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-surface/80 px-1.5 py-0.5 text-[11px] text-muted">Drag to turn · pinch or scroll to zoom · tap a part</p>
      </div>

      {part && (
        <div className="relative rounded-xl border border-primary/40 bg-primary-soft p-3 pr-9" data-testid="model3d-info" aria-live="polite">
          <p className="flex items-center gap-2 text-sm font-semibold"><span className="inline-block size-3 rounded-full" style={{ background: part.color }} />{part.label}</p>
          {part.info && <p className="mt-1 text-sm leading-relaxed">{part.info}</p>}
          <button type="button" aria-label="Close" onClick={() => select(null)} className="absolute right-2 top-2 rounded p-1 text-muted hover:text-text"><X className="size-4" /></button>
        </div>
      )}

      {scene.steps.length > 0 && (
        <div className="rounded-xl border border-border p-3" data-testid="model3d-tour">
          {current ? (
            <>
              <p className="text-xs font-medium text-muted">Guided tour · step {step! + 1} of {scene.steps.length}</p>
              <p className="mt-1 text-sm leading-relaxed" data-testid="model3d-step" aria-live="polite">{current.caption}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={step === 0} onClick={() => { select(null); setStep((s) => Math.max(0, s! - 1)); }}><ChevronLeft className="size-3.5" /> Back</Button>
                {step! < scene.steps.length - 1
                  ? <Button size="sm" onClick={() => { select(null); setStep((s) => s! + 1); }}>Next <ChevronRight className="size-3.5" /></Button>
                  : <Button size="sm" onClick={() => { select(null); setStep(null); }}>Finish</Button>}
                <Button size="sm" variant="ghost" onClick={() => { select(null); setStep(null); }}>Show everything</Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">{scene.steps.length} steps that walk you through the model.</p>
              <Button size="sm" onClick={() => { select(null); setStep(0); }}>Start guided tour</Button>
            </div>
          )}
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Parts ({groups.length})</p>
        <ul className="flex flex-wrap gap-1.5" data-testid="model3d-parts">
          {groups.map((g) => {
            const on = !!selected && g.ids.includes(selected);
            return (
              <li key={g.label}>
                <button type="button" aria-pressed={on} onClick={() => select(on ? null : g.first.id)}
                  className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors", on ? "border-primary bg-primary-soft text-text" : "border-border hover:border-border-strong")}>
                  <span className="inline-block size-2.5 rounded-full" style={{ background: g.first.color }} />
                  {g.label}{g.ids.length > 1 && <span className="text-faint">×{g.ids.length}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {full && <div className="pb-2"><Button size="sm" variant="secondary" onClick={() => setFull(false)}><Minimize2 className="size-3.5" /> Exit full screen</Button></div>}
    </div>
  );
}

function IconButton({ label, onClick, pressed, children }: { label: string; onClick: () => void; pressed?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} onClick={onClick}
      className="grid size-8 place-items-center rounded-lg border border-border bg-surface/90 text-muted shadow-sm backdrop-blur-sm hover:text-text">
      {children}
    </button>
  );
}
