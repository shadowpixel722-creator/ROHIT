"use client";

import { Crop, RotateCcw, RotateCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../ui";

type Rect = { x: number; y: number; w: number; h: number }; // in preview pixels

/**
 * Post-scan alignment before upload: rotate in 90° steps, straighten (±15°) and crop.
 * Everything happens in the browser on a canvas; the result replaces the picked photo.
 * (The server also auto-straightens small tilts after upload.)
 */
export function PageAdjuster({ file, onDone, onCancel }: { file: File; onDone: (f: File) => void; onCancel: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [bmp, setBmp] = useState<ImageBitmap | null>(null);
  const [quarter, setQuarter] = useState(0); // 0..3 × 90°
  const [fine, setFine] = useState(0); // degrees
  const [crop, setCrop] = useState<Rect | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(false);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    let alive = true;
    createImageBitmap(file, { imageOrientation: "from-image" }).then((b) => alive && setBmp(b)).catch(() => alive && onCancelRef.current());
    return () => { alive = false; };
  }, [file]);

  /** Draws the rotated image onto a canvas at the given scale; returns its size. */
  function render(target: HTMLCanvasElement, s: number) {
    if (!bmp) return { w: 0, h: 0 };
    const angle = ((quarter * 90 + fine) * Math.PI) / 180;
    const w = bmp.width * s;
    const h = bmp.height * s;
    const cw = Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle));
    const ch = Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle));
    target.width = Math.round(cw);
    target.height = Math.round(ch);
    const ctx = target.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cw, ch);
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate(angle);
    ctx.drawImage(bmp, -w / 2, -h / 2, w, h);
    return { w: cw, h: ch };
  }

  useEffect(() => {
    if (!bmp || !canvas.current) return;
    const maxW = Math.min(560, window.innerWidth - 64);
    const s = Math.min(1, maxW / Math.max(bmp.width, bmp.height));
    setScale(s);
    render(canvas.current, s);
    setCrop(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bmp, quarter, fine]);

  function point(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(r.width, e.clientX - r.left)), y: Math.max(0, Math.min(r.height, e.clientY - r.top)) };
  }

  async function apply() {
    if (!bmp) return;
    setBusy(true);
    const full = document.createElement("canvas");
    render(full, 1);
    let out = full;
    if (crop && crop.w > 10 && crop.h > 10) {
      const k = 1 / scale;
      out = document.createElement("canvas");
      out.width = Math.round(crop.w * k);
      out.height = Math.round(crop.h * k);
      out.getContext("2d")!.drawImage(full, crop.x * k, crop.y * k, crop.w * k, crop.h * k, 0, 0, out.width, out.height);
    }
    const blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/jpeg", 0.9));
    setBusy(false);
    if (blob) onDone(new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Adjust page" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-full w-full max-w-2xl overflow-auto rounded-2xl bg-surface p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Adjust page</h2>
          <button onClick={onCancel} className="grid size-8 place-items-center rounded-lg text-faint hover:bg-surface-2" aria-label="Close"><X className="size-4" /></button>
        </div>
        <div className="flex justify-center">
          <div className="relative touch-none select-none" style={{ cursor: "crosshair" }}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); const p = point(e); setDrag(p); setCrop({ x: p.x, y: p.y, w: 0, h: 0 }); }}
            onPointerMove={(e) => { if (!drag) return; const p = point(e); setCrop({ x: Math.min(drag.x, p.x), y: Math.min(drag.y, p.y), w: Math.abs(p.x - drag.x), h: Math.abs(p.y - drag.y) }); }}
            onPointerUp={() => setDrag(null)}>
            <canvas ref={canvas} className="block max-w-full rounded-lg border border-border" data-testid="adjust-canvas" />
            {crop && crop.w > 2 && (
              <div className="pointer-events-none absolute border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }} />
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-muted"><Crop className="mr-1 inline size-3.5" />Drag on the page to crop it to the writing.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setQuarter((q) => (q + 3) % 4)} aria-label="Rotate left"><RotateCcw className="size-4" /></Button>
            <Button size="sm" variant="secondary" onClick={() => setQuarter((q) => (q + 1) % 4)} aria-label="Rotate right"><RotateCw className="size-4" /></Button>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <span className="shrink-0 text-muted">Straighten</span>
            <input type="range" min={-15} max={15} step={0.5} value={fine} onChange={(e) => setFine(Number(e.target.value))} className="w-full accent-[var(--primary)]" aria-label="Straighten" />
            <span className="w-12 shrink-0 text-right tabular-nums text-muted">{fine > 0 ? "+" : ""}{fine}°</span>
          </label>
        </div>
        <div className="mt-4 flex justify-between gap-2">
          <Button variant="ghost" onClick={() => { setQuarter(0); setFine(0); setCrop(null); }}>Reset</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button onClick={apply} loading={busy} disabled={!bmp}>Apply</Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
